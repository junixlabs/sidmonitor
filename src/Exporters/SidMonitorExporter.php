<?php

namespace JunixLabs\Observatory\Exporters;

use Illuminate\Contracts\Foundation\Application;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use JunixLabs\Observatory\Contracts\ExporterInterface;

/**
 * SidMonitor Exporter - Push-based exporter for SidMonitor platform
 *
 * Coming soon! This exporter will send metrics and logs to the SidMonitor
 * platform for advanced monitoring, alerting, and visualization.
 *
 * Features (planned):
 * - Real-time metrics and log streaming
 * - Rich contextual data (not just metrics)
 * - Distributed tracing
 * - Alerting integration
 * - Custom dashboards
 *
 * For now, please use the PrometheusExporter.
 */
class SidMonitorExporter implements ExporterInterface
{
    protected Application $app;

    protected string $endpoint;

    protected string $apiKey;

    protected string $projectId;

    protected array $buffer = [];

    protected int $batchSize;

    protected int $lastFlush;

    public function __construct(Application $app)
    {
        $this->app = $app;
        $this->endpoint = config('observatory.sidmonitor.endpoint', 'https://api.sidmonitor.com');
        $this->apiKey = config('observatory.sidmonitor.api_key', '');
        $this->projectId = config('observatory.sidmonitor.project_id', '');
        $this->batchSize = config('observatory.sidmonitor.batch.size', 100);
        $this->lastFlush = time();

        if (empty($this->apiKey)) {
            Log::warning('Observatory: SidMonitor API key not configured. Metrics will not be sent.');
        }
    }

    public function recordInbound(array $data): void
    {
        $this->addToBuffer('inbound', $data);
    }

    public function recordOutbound(array $data): void
    {
        $this->addToBuffer('outbound', $data);
    }

    public function recordJob(array $data): void
    {
        $this->addToBuffer('job', $data);
    }

    public function recordException(\Throwable $exception, array $context = []): void
    {
        $data = [
            'exception_class' => get_class($exception),
            'message' => $exception->getMessage(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => $exception->getTraceAsString(),
            'context' => $context,
            'timestamp' => now()->toIso8601String(),
        ];

        $this->addToBuffer('exception', $data);
    }

    public function incrementCounter(string $name, array $labels = [], float $value = 1): void
    {
        $this->addToBuffer('metric', [
            'type' => 'counter',
            'name' => $name,
            'value' => $value,
            'labels' => $labels,
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    public function setGauge(string $name, float $value, array $labels = []): void
    {
        $this->addToBuffer('metric', [
            'type' => 'gauge',
            'name' => $name,
            'value' => $value,
            'labels' => $labels,
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    public function observeHistogram(string $name, float $value, array $labels = []): void
    {
        $this->addToBuffer('metric', [
            'type' => 'histogram',
            'name' => $name,
            'value' => $value,
            'labels' => $labels,
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    public function getOutput(): string
    {
        // SidMonitor is push-based, but we can return a summary
        return json_encode([
            'status' => 'SidMonitor exporter active',
            'endpoint' => $this->endpoint,
            'project_id' => $this->projectId,
            'buffer_size' => count($this->buffer),
            'note' => 'SidMonitor integration coming soon. Please use Prometheus exporter for now.',
        ], JSON_PRETTY_PRINT);
    }

    public function flush(): void
    {
        if (empty($this->buffer)) {
            return;
        }

        if (empty($this->apiKey)) {
            // Clear buffer but don't send - API key not configured
            $this->buffer = [];

            return;
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
                'X-Project-ID' => $this->projectId,
            ])->timeout(5)->post($this->endpoint . '/api/v1/ingest', [
                'project_id' => $this->projectId,
                'data' => $this->buffer,
            ]);

            if (! $response->successful()) {
                Log::warning('Observatory: Failed to send data to SidMonitor', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
            }
        } catch (\Exception $e) {
            Log::warning('Observatory: Error sending data to SidMonitor', [
                'error' => $e->getMessage(),
            ]);
        }

        $this->buffer = [];
        $this->lastFlush = time();
    }

    protected function addToBuffer(string $type, array $data): void
    {
        $this->buffer[] = [
            'type' => $type,
            'data' => $data,
            'app_name' => config('observatory.app_name', 'laravel'),
            'labels' => config('observatory.labels', []),
        ];

        // Auto-flush if buffer is full
        if (count($this->buffer) >= $this->batchSize) {
            $this->flush();
        }

        // Auto-flush if interval exceeded
        $interval = config('observatory.sidmonitor.batch.interval', 10);
        if (time() - $this->lastFlush >= $interval) {
            $this->flush();
        }
    }
}
