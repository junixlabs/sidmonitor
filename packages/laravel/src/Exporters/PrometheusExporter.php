<?php

namespace JunixLabs\Observatory\Exporters;

use Illuminate\Contracts\Foundation\Application;
use Prometheus\CollectorRegistry;
use Prometheus\RenderTextFormat;
use Prometheus\Storage\InMemory;
use Prometheus\Storage\Redis;
use Prometheus\Storage\APC;
use Prometheus\Storage\APCng;
use JunixLabs\Observatory\Contracts\ExporterInterface;

class PrometheusExporter implements ExporterInterface
{
    protected Application $app;
    protected CollectorRegistry $registry;
    protected string $namespace;

    // Cached metrics
    protected array $counters = [];
    protected array $histograms = [];
    protected array $gauges = [];

    public function __construct(Application $app)
    {
        $this->app = $app;
        $this->namespace = $this->sanitizeNamespace(config('observatory.app_name', 'laravel'));
        $this->registry = new CollectorRegistry($this->createStorage());

        $this->registerDefaultMetrics();
    }

    protected function createStorage()
    {
        $storageType = config('observatory.prometheus.storage', 'memory');

        return match ($storageType) {
            'redis' => new Redis($this->getRedisConfig()),
            'apc' => new APC(),
            'apcu' => new APCng(),
            default => new InMemory(),
        };
    }

    protected function getRedisConfig(): array
    {
        $config = config('observatory.prometheus.redis', []);

        return [
            'host' => $config['host'] ?? '127.0.0.1',
            'port' => $config['port'] ?? 6379,
            'password' => $config['password'] ?? null,
            'database' => $config['database'] ?? 0,
        ];
    }

    protected function registerDefaultMetrics(): void
    {
        $buckets = config('observatory.prometheus.buckets', [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]);

        // Inbound HTTP metrics
        $this->counters['http_requests_total'] = $this->registry->getOrRegisterCounter(
            $this->namespace,
            'http_requests_total',
            'Total number of HTTP requests',
            ['method', 'route', 'status_code']
        );

        $this->histograms['http_request_duration_seconds'] = $this->registry->getOrRegisterHistogram(
            $this->namespace,
            'http_request_duration_seconds',
            'HTTP request duration in seconds',
            ['method', 'route', 'status_code'],
            $buckets
        );

        // Outbound HTTP metrics
        $this->counters['http_outbound_requests_total'] = $this->registry->getOrRegisterCounter(
            $this->namespace,
            'http_outbound_requests_total',
            'Total number of outbound HTTP requests',
            ['method', 'host', 'status_code']
        );

        $this->histograms['http_outbound_duration_seconds'] = $this->registry->getOrRegisterHistogram(
            $this->namespace,
            'http_outbound_duration_seconds',
            'Outbound HTTP request duration in seconds',
            ['method', 'host', 'status_code'],
            $buckets
        );

        // Job metrics
        $this->counters['jobs_processed_total'] = $this->registry->getOrRegisterCounter(
            $this->namespace,
            'jobs_processed_total',
            'Total number of jobs processed',
            ['job_name', 'queue', 'status']
        );

        $this->histograms['jobs_duration_seconds'] = $this->registry->getOrRegisterHistogram(
            $this->namespace,
            'jobs_duration_seconds',
            'Job execution duration in seconds',
            ['job_name', 'queue', 'status'],
            $buckets
        );

        // Exception metrics
        $this->counters['exceptions_total'] = $this->registry->getOrRegisterCounter(
            $this->namespace,
            'exceptions_total',
            'Total number of exceptions',
            ['exception_class', 'file']
        );
    }

    public function recordInbound(array $data): void
    {
        $labels = [
            $data['method'],
            $this->sanitizeLabel($data['route'] ?? 'unknown'),
            (string) $data['status_code'],
        ];

        $this->counters['http_requests_total']->inc($labels);
        $this->histograms['http_request_duration_seconds']->observe($data['duration'], $labels);
    }

    public function recordOutbound(array $data): void
    {
        $labels = [
            $data['method'],
            $this->sanitizeLabel($data['host'] ?? 'unknown'),
            (string) $data['status_code'],
        ];

        $this->counters['http_outbound_requests_total']->inc($labels);
        $this->histograms['http_outbound_duration_seconds']->observe($data['duration'], $labels);
    }

    public function recordJob(array $data): void
    {
        $labels = [
            $this->sanitizeLabel($data['job_name'] ?? 'unknown'),
            $this->sanitizeLabel($data['queue'] ?? 'default'),
            $data['status'],
        ];

        $this->counters['jobs_processed_total']->inc($labels);
        $this->histograms['jobs_duration_seconds']->observe($data['duration'], $labels);
    }

    public function recordException(\Throwable $exception, array $context = []): void
    {
        $labels = [
            $this->sanitizeLabel(get_class($exception)),
            $this->sanitizeLabel(basename($exception->getFile())),
        ];

        $this->counters['exceptions_total']->inc($labels);
    }

    public function incrementCounter(string $name, array $labels = [], float $value = 1): void
    {
        $sanitizedName = $this->sanitizeName($name);

        if (!isset($this->counters[$sanitizedName])) {
            $labelNames = array_keys($labels);
            $this->counters[$sanitizedName] = $this->registry->getOrRegisterCounter(
                $this->namespace,
                $sanitizedName,
                "Custom counter: {$name}",
                $labelNames
            );
        }

        $labelValues = array_map([$this, 'sanitizeLabel'], array_values($labels));
        $this->counters[$sanitizedName]->incBy($value, $labelValues);
    }

    public function setGauge(string $name, float $value, array $labels = []): void
    {
        $sanitizedName = $this->sanitizeName($name);

        if (!isset($this->gauges[$sanitizedName])) {
            $labelNames = array_keys($labels);
            $this->gauges[$sanitizedName] = $this->registry->getOrRegisterGauge(
                $this->namespace,
                $sanitizedName,
                "Custom gauge: {$name}",
                $labelNames
            );
        }

        $labelValues = array_map([$this, 'sanitizeLabel'], array_values($labels));
        $this->gauges[$sanitizedName]->set($value, $labelValues);
    }

    public function observeHistogram(string $name, float $value, array $labels = []): void
    {
        $sanitizedName = $this->sanitizeName($name);
        $buckets = config('observatory.prometheus.buckets', [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]);

        if (!isset($this->histograms[$sanitizedName])) {
            $labelNames = array_keys($labels);
            $this->histograms[$sanitizedName] = $this->registry->getOrRegisterHistogram(
                $this->namespace,
                $sanitizedName,
                "Custom histogram: {$name}",
                $labelNames,
                $buckets
            );
        }

        $labelValues = array_map([$this, 'sanitizeLabel'], array_values($labels));
        $this->histograms[$sanitizedName]->observe($value, $labelValues);
    }

    public function getOutput(): string
    {
        $renderer = new RenderTextFormat();
        return $renderer->render($this->registry->getMetricFamilySamples());
    }

    public function flush(): void
    {
        // For Prometheus, metrics are stored in the configured storage
        // and scraped by Prometheus. Nothing to flush.
    }

    public function getRegistry(): CollectorRegistry
    {
        return $this->registry;
    }

    protected function sanitizeNamespace(string $name): string
    {
        // Prometheus namespace must match [a-zA-Z_:][a-zA-Z0-9_:]*
        $sanitized = preg_replace('/[^a-zA-Z0-9_]/', '_', $name);
        return preg_replace('/^[0-9]/', '_', $sanitized);
    }

    protected function sanitizeName(string $name): string
    {
        // Prometheus metric names must match [a-zA-Z_:][a-zA-Z0-9_:]*
        $sanitized = preg_replace('/[^a-zA-Z0-9_]/', '_', $name);
        return preg_replace('/^[0-9]/', '_', $sanitized);
    }

    protected function sanitizeLabel(string $value): string
    {
        // Labels can contain any UTF-8 characters, but we limit length
        return substr($value, 0, 128);
    }
}
