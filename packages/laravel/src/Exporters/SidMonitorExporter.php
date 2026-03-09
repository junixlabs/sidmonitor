<?php

namespace JunixLabs\Observatory\Exporters;

use Illuminate\Contracts\Foundation\Application;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use JunixLabs\Observatory\Contracts\ExporterInterface;

/**
 * SidMonitor Exporter - Push-based exporter for SidMonitor platform
 *
 * Sends inbound, outbound, and job metrics to SidMonitor backend.
 * Data is buffered and flushed in batches for efficiency.
 *
 * Config: observatory.sidmonitor.*
 * Auth: X-API-Key header
 * Endpoints: /api/ingest/batch, /api/ingest/jobs/batch
 */
class SidMonitorExporter implements ExporterInterface
{
    protected Application $app;

    protected string $endpoint;

    protected string $apiKey;

    protected array $inboundBuffer = [];

    protected array $outboundBuffer = [];

    protected array $jobBuffer = [];

    protected int $batchSize;

    protected int $lastFlush;

    public function __construct(Application $app)
    {
        $this->app = $app;
        $this->endpoint = rtrim(config('observatory.sidmonitor.endpoint', ''), '/');
        $this->apiKey = config('observatory.sidmonitor.api_key', '');
        $this->batchSize = config('observatory.sidmonitor.batch.size', 100);
        $this->lastFlush = time();

        if (empty($this->apiKey)) {
            Log::warning('Observatory: SidMonitor API key not configured. Metrics will not be sent.');
        }
    }

    public function recordInbound(array $data): void
    {
        $this->inboundBuffer[] = [
            'request_id' => $data['request_id'] ?? $this->getRequestId(),
            'timestamp' => $data['timestamp'] ?? now()->toIso8601String(),
            'endpoint' => '/' . ltrim($data['uri'] ?? '', '/'),
            'method' => $data['method'] ?? 'GET',
            'status_code' => (int) ($data['status_code'] ?? 200),
            'response_time_ms' => round(($data['duration'] ?? 0) * 1000, 2),
            'user_id' => $data['user_id'] ?? $this->getAuthUserId(),
            'user_name' => $data['user_name'] ?? $this->getAuthUserName(),
            'module' => $data['route'] ?? null,
            'tags' => array_values($data['labels'] ?? []),
            'request_body' => $data['request_body'] ?? null,
            'response_body' => $data['response_body'] ?? null,
        ];

        $this->autoFlushIfNeeded();
    }

    public function recordOutbound(array $data): void
    {
        $host = $data['host'] ?? '';

        $this->outboundBuffer[] = [
            'request_id' => $data['request_id'] ?? $this->getRequestId(),
            'timestamp' => $data['timestamp'] ?? now()->toIso8601String(),
            'endpoint' => $data['full_url'] ?? ($host . ($data['path'] ?? '')),
            'method' => $data['method'] ?? 'GET',
            'status_code' => (int) ($data['status_code'] ?? 0),
            'response_time_ms' => round(($data['duration'] ?? 0) * 1000, 2),
            'third_party_service' => $this->detectService($host),
            'user_id' => $data['user_id'] ?? $this->getAuthUserId(),
            'user_name' => $data['user_name'] ?? $this->getAuthUserName(),
            'module' => null,
            'tags' => array_values($data['labels'] ?? []),
            'request_body' => $data['request_body'] ?? null,
            'response_body' => $data['response_body'] ?? null,
        ];

        $this->autoFlushIfNeeded();
    }

    public function recordJob(array $data): void
    {
        $duration = $data['duration'] ?? 0;
        $startedAt = $data['started_at'] ?? now()->subSeconds($duration)->toIso8601String();
        $status = $this->mapJobStatus($data['status'] ?? 'processed');

        $entry = [
            'job_id' => (string) ($data['job_id'] ?? Str::uuid()->toString()),
            'job_uuid' => $data['job_uuid'] ?? null,
            'job_class' => $data['job_name'] ?? 'Unknown',
            'job_name' => $this->humanizeJobName($data['job_name'] ?? 'Unknown'),
            'queue_name' => $data['queue'] ?? 'default',
            'connection' => $data['connection'] ?? 'sync',
            'status' => $status,
            'started_at' => $startedAt,
            'completed_at' => now()->toIso8601String(),
            'duration_ms' => (int) round($duration * 1000),
            'attempt_number' => (int) ($data['attempts'] ?? 1),
            'max_attempts' => (int) ($data['max_attempts'] ?? 1),
            'user_id' => $data['user_id'] ?? $this->getAuthUserId(),
            'memory_usage_mb' => isset($data['memory']) ? round($data['memory'] / 1048576, 2) : null,
            'metadata' => [],
        ];

        // Add payload if present
        if (isset($data['payload'])) {
            $entry['payload'] = is_string($data['payload']) ? $data['payload'] : json_encode($data['payload']);
        }

        // Flatten exception data
        if (isset($data['exception'])) {
            $exc = $data['exception'];
            $entry['exception_class'] = $exc['class'] ?? null;
            $entry['exception_message'] = $exc['message'] ?? null;
            $entry['exception_trace'] = isset($exc['file'], $exc['line'])
                ? $exc['file'] . ':' . $exc['line']
                : null;
        }

        $this->jobBuffer[] = $entry;

        $this->autoFlushIfNeeded();
    }

    public function recordException(\Throwable $exception, array $context = []): void
    {
        // Exceptions are recorded via job/inbound context, no separate endpoint needed
    }

    public function incrementCounter(string $name, array $labels = [], float $value = 1): void
    {
        // SidMonitor handles counters server-side from ingested logs
    }

    public function setGauge(string $name, float $value, array $labels = []): void
    {
        // SidMonitor handles gauges server-side from ingested logs
    }

    public function observeHistogram(string $name, float $value, array $labels = []): void
    {
        // SidMonitor handles histograms server-side from ingested logs
    }

    public function getOutput(): string
    {
        return json_encode([
            'exporter' => 'sidmonitor',
            'endpoint' => $this->endpoint,
            'buffer' => [
                'inbound' => count($this->inboundBuffer),
                'outbound' => count($this->outboundBuffer),
                'jobs' => count($this->jobBuffer),
            ],
        ], JSON_PRETTY_PRINT);
    }

    public function flush(): void
    {
        $this->flushLogs();
        $this->flushJobs();
        $this->lastFlush = time();
    }

    protected function flushLogs(): void
    {
        if (empty($this->inboundBuffer) && empty($this->outboundBuffer)) {
            return;
        }

        if (empty($this->apiKey)) {
            $this->inboundBuffer = [];
            $this->outboundBuffer = [];

            return;
        }

        try {
            $response = Http::withHeaders([
                'X-API-Key' => $this->apiKey,
                'Content-Type' => 'application/json',
            ])->timeout(5)->post($this->endpoint . '/api/ingest/batch', [
                'inbound_logs' => $this->inboundBuffer,
                'outbound_logs' => $this->outboundBuffer,
            ]);

            if (! $response->successful()) {
                Log::warning('Observatory: SidMonitor ingest failed', [
                    'status' => $response->status(),
                ]);
            }
        } catch (\Exception $e) {
            Log::warning('Observatory: SidMonitor connection error', [
                'error' => $e->getMessage(),
            ]);
        }

        $this->inboundBuffer = [];
        $this->outboundBuffer = [];
    }

    protected function flushJobs(): void
    {
        if (empty($this->jobBuffer)) {
            return;
        }

        if (empty($this->apiKey)) {
            $this->jobBuffer = [];

            return;
        }

        try {
            $response = Http::withHeaders([
                'X-API-Key' => $this->apiKey,
                'Content-Type' => 'application/json',
            ])->timeout(5)->post($this->endpoint . '/api/ingest/jobs/batch', [
                'job_logs' => $this->jobBuffer,
                'scheduled_task_logs' => [],
            ]);

            if (! $response->successful()) {
                Log::warning('Observatory: SidMonitor job ingest failed', [
                    'status' => $response->status(),
                ]);
            }
        } catch (\Exception $e) {
            Log::warning('Observatory: SidMonitor job connection error', [
                'error' => $e->getMessage(),
            ]);
        }

        $this->jobBuffer = [];
    }

    protected function autoFlushIfNeeded(): void
    {
        $total = count($this->inboundBuffer) + count($this->outboundBuffer) + count($this->jobBuffer);

        if ($total >= $this->batchSize) {
            $this->flush();

            return;
        }

        $interval = config('observatory.sidmonitor.batch.interval', 10);
        if (time() - $this->lastFlush >= $interval) {
            $this->flush();
        }
    }

    protected function detectService(string $host): string
    {
        $services = config('observatory.outbound.services', []);

        foreach ($services as $pattern => $name) {
            if (fnmatch($pattern, $host)) {
                return $name;
            }
        }

        // Fallback: extract service name from host
        $parts = explode('.', $host);
        if (count($parts) >= 2) {
            return $parts[count($parts) - 2];
        }

        return $host ?: 'unknown';
    }

    protected function mapJobStatus(string $status): string
    {
        return match ($status) {
            'processed' => 'completed',
            'failed' => 'failed',
            'processing' => 'running',
            default => $status,
        };
    }

    protected function humanizeJobName(string $className): string
    {
        // App\Jobs\ProcessPayment -> ProcessPayment
        $parts = explode('\\', $className);

        return end($parts);
    }

    protected function getRequestId(): string
    {
        $header = config('observatory.request_id.header', 'X-Request-Id');

        return request()?->header($header) ?? Str::uuid()->toString();
    }

    protected function getAuthUserId(): ?string
    {
        try {
            return auth()->id() ? (string) auth()->id() : null;
        } catch (\Throwable) {
            return null;
        }
    }

    protected function getAuthUserName(): ?string
    {
        try {
            $user = auth()->user();

            return $user?->name ?? $user?->email ?? null;
        } catch (\Throwable) {
            return null;
        }
    }
}
