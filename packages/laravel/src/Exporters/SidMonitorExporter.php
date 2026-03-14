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
 * Sends inbound, outbound, job, and scheduled task metrics to SidMonitor backend.
 * Data is buffered and flushed in batches for efficiency.
 * Includes circuit breaker to avoid blocking when backend is down.
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

    protected array $scheduledTaskBuffer = [];

    protected int $batchSize;

    protected int $maxBufferSize;

    protected int $timeout;

    protected int $lastFlush;

    // Circuit breaker state
    protected int $consecutiveFailures = 0;

    protected int $circuitOpenUntil = 0;

    protected int $circuitBreakerThreshold;

    protected int $circuitBreakerCooldown;

    public function __construct(Application $app)
    {
        $this->app = $app;
        $this->endpoint = rtrim(config('observatory.sidmonitor.endpoint', ''), '/');
        $this->apiKey = config('observatory.sidmonitor.api_key', '');
        $this->batchSize = config('observatory.sidmonitor.batch.size', 100);
        $this->maxBufferSize = config('observatory.sidmonitor.batch.max_buffer_size', 1000);
        $this->timeout = config('observatory.sidmonitor.timeout', 5);
        $this->circuitBreakerThreshold = config('observatory.circuit_breaker.threshold', 3);
        $this->circuitBreakerCooldown = config('observatory.circuit_breaker.cooldown', 30);
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
            'parent_request_id' => $data['parent_request_id'] ?? null,
            'timestamp' => $data['timestamp'] ?? now()->toIso8601String(),
            'target_url' => $data['full_url'] ?? ($host . ($data['path'] ?? '')),
            'method' => $data['method'] ?? 'GET',
            'status_code' => (int) ($data['status_code'] ?? 0),
            'latency_ms' => round(($data['duration'] ?? 0) * 1000, 2),
            'service_name' => $this->detectService($host),
            'user_id' => $data['user_id'] ?? $this->getAuthUserId(),
            'user_name' => $data['user_name'] ?? $this->getAuthUserName(),
            'module' => null,
            'tags' => array_values($data['labels'] ?? []),
            'request_body' => $data['request_body'] ?? null,
            'response_body' => $data['response_body'] ?? null,
            'request_size' => $data['request_size'] ?? null,
            'response_size' => $data['response_size'] ?? null,
            'error_message' => $data['error_message'] ?? null,
            'error_code' => $data['error_code'] ?? null,
            'retry_count' => $data['retry_count'] ?? 0,
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
            'metadata' => new \stdClass(),
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

    public function recordScheduledTask(array $data): void
    {
        $this->scheduledTaskBuffer[] = [
            'task_id' => $data['task_id'] ?? Str::uuid()->toString(),
            'command' => $data['command'] ?? 'Unknown',
            'description' => $data['description'] ?? null,
            'expression' => $data['expression'] ?? '* * * * *',
            'timezone' => $data['timezone'] ?? config('app.timezone', 'UTC'),
            'status' => $data['status'] ?? 'completed',
            'scheduled_at' => $data['scheduled_at'] ?? now()->toIso8601String(),
            'started_at' => $data['started_at'] ?? now()->toIso8601String(),
            'completed_at' => $data['completed_at'] ?? now()->toIso8601String(),
            'duration_ms' => (int) ($data['duration_ms'] ?? 0),
            'exit_code' => $data['exit_code'] ?? null,
            'output' => $data['output'] ?? null,
            'error_message' => $data['error_message'] ?? null,
            'error_trace' => $data['error_trace'] ?? null,
            'without_overlapping' => $data['without_overlapping'] ?? false,
            'mutex_name' => $data['mutex_name'] ?? null,
            'expected_run_time' => $data['scheduled_at'] ?? now()->toIso8601String(),
            'delay_ms' => $data['delay_ms'] ?? 0,
            'memory_usage_mb' => $data['memory_usage_mb'] ?? null,
            'metadata' => $data['metadata'] ?? new \stdClass(),
        ];

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
                'scheduled_tasks' => count($this->scheduledTaskBuffer),
            ],
            'circuit_breaker' => [
                'consecutive_failures' => $this->consecutiveFailures,
                'is_open' => $this->isCircuitOpen(),
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

        if ($this->isCircuitOpen()) {
            $this->trimBufferIfNeeded();

            return;
        }

        try {
            $response = Http::withHeaders([
                'X-API-Key' => $this->apiKey,
                'Content-Type' => 'application/json',
            ])->timeout($this->timeout)->post($this->endpoint . '/api/ingest/batch', [
                'inbound_logs' => $this->inboundBuffer,
                'outbound_logs' => $this->outboundBuffer,
            ]);

            if ($response->successful()) {
                $this->inboundBuffer = [];
                $this->outboundBuffer = [];
                $this->recordFlushSuccess();
            } else {
                Log::warning('Observatory: SidMonitor ingest failed', [
                    'status' => $response->status(),
                ]);
                $this->recordFlushFailure();
                $this->trimBufferIfNeeded();
            }
        } catch (\Exception $e) {
            Log::warning('Observatory: SidMonitor connection error', [
                'error' => $e->getMessage(),
            ]);
            $this->recordFlushFailure();
            $this->trimBufferIfNeeded();
        }
    }

    protected function flushJobs(): void
    {
        if (empty($this->jobBuffer) && empty($this->scheduledTaskBuffer)) {
            return;
        }

        if (empty($this->apiKey)) {
            $this->jobBuffer = [];
            $this->scheduledTaskBuffer = [];

            return;
        }

        if ($this->isCircuitOpen()) {
            $this->trimBufferIfNeeded();

            return;
        }

        try {
            $response = Http::withHeaders([
                'X-API-Key' => $this->apiKey,
                'Content-Type' => 'application/json',
            ])->timeout($this->timeout)->post($this->endpoint . '/api/ingest/jobs/batch', [
                'job_logs' => $this->jobBuffer,
                'scheduled_task_logs' => $this->scheduledTaskBuffer,
            ]);

            if ($response->successful()) {
                $this->jobBuffer = [];
                $this->scheduledTaskBuffer = [];
                $this->recordFlushSuccess();
            } else {
                Log::warning('Observatory: SidMonitor job ingest failed', [
                    'status' => $response->status(),
                ]);
                $this->recordFlushFailure();
                $this->trimBufferIfNeeded();
            }
        } catch (\Exception $e) {
            Log::warning('Observatory: SidMonitor job connection error', [
                'error' => $e->getMessage(),
            ]);
            $this->recordFlushFailure();
            $this->trimBufferIfNeeded();
        }
    }

    protected function autoFlushIfNeeded(): void
    {
        $total = count($this->inboundBuffer) + count($this->outboundBuffer)
            + count($this->jobBuffer) + count($this->scheduledTaskBuffer);

        if ($total >= $this->batchSize) {
            $this->flush();

            return;
        }

        $interval = config('observatory.sidmonitor.batch.interval', 10);
        if (time() - $this->lastFlush >= $interval) {
            $this->flush();
        }
    }

    // --- Circuit Breaker ---

    protected function isCircuitOpen(): bool
    {
        if ($this->consecutiveFailures < $this->circuitBreakerThreshold) {
            return false;
        }

        if (time() >= $this->circuitOpenUntil) {
            // Cooldown expired, allow a retry (half-open)
            return false;
        }

        return true;
    }

    protected function recordFlushSuccess(): void
    {
        $this->consecutiveFailures = 0;
        $this->circuitOpenUntil = 0;
    }

    protected function recordFlushFailure(): void
    {
        $this->consecutiveFailures++;

        if ($this->consecutiveFailures >= $this->circuitBreakerThreshold) {
            $this->circuitOpenUntil = time() + $this->circuitBreakerCooldown;
            Log::warning('Observatory: Circuit breaker opened — pausing flush for ' . $this->circuitBreakerCooldown . 's', [
                'consecutive_failures' => $this->consecutiveFailures,
            ]);
        }
    }

    // --- Buffer Management ---

    protected function trimBufferIfNeeded(): void
    {
        $max = $this->maxBufferSize;

        if (count($this->inboundBuffer) > $max) {
            $this->inboundBuffer = array_slice($this->inboundBuffer, -$max);
        }
        if (count($this->outboundBuffer) > $max) {
            $this->outboundBuffer = array_slice($this->outboundBuffer, -$max);
        }
        if (count($this->jobBuffer) > $max) {
            $this->jobBuffer = array_slice($this->jobBuffer, -$max);
        }
        if (count($this->scheduledTaskBuffer) > $max) {
            $this->scheduledTaskBuffer = array_slice($this->scheduledTaskBuffer, -$max);
        }
    }

    // --- Helpers ---

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
