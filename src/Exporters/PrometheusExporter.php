<?php

namespace JunixLabs\Observatory\Exporters;

use Illuminate\Contracts\Foundation\Application;
use JunixLabs\Observatory\Contracts\ExporterInterface;
use Prometheus\CollectorRegistry;
use Prometheus\RenderTextFormat;
use Prometheus\Storage\APC;
use Prometheus\Storage\APCng;
use Prometheus\Storage\InMemory;
use Prometheus\Storage\Redis;

class PrometheusExporter implements ExporterInterface
{
    protected Application $app;

    protected ?CollectorRegistry $registry = null;

    protected ?string $namespace = null;

    protected bool $enabled;

    protected bool $initialized = false;

    // Cached metrics
    protected array $counters = [];

    protected array $histograms = [];

    protected array $gauges = [];

    public function __construct(Application $app)
    {
        $this->app = $app;
        // Only check if enabled, don't initialize storage yet (lazy loading)
        $this->enabled = config('observatory.prometheus.enabled', false);
    }

    /**
     * Lazy initialization - only connect when actually needed
     */
    protected function ensureInitialized(): bool
    {
        if (! $this->enabled) {
            return false;
        }

        if ($this->initialized) {
            return true;
        }

        $this->namespace = $this->sanitizeNamespace(config('observatory.app_name', 'laravel'));
        $this->registry = new CollectorRegistry($this->createStorage());
        $this->registerDefaultMetrics();
        $this->initialized = true;

        return true;
    }

    protected function createStorage()
    {
        $storageType = config('observatory.prometheus.storage', 'memory');

        return match ($storageType) {
            'redis' => new Redis($this->getRedisConfig()),
            'apc' => new APC,
            'apcu' => new APCng,
            default => new InMemory,
        };
    }

    protected function getRedisConfig(): array
    {
        $config = config('observatory.prometheus.redis', []);

        $redisConfig = [
            'host' => $config['host'] ?? '127.0.0.1',
            'port' => $config['port'] ?? 6379,
            'database' => $config['database'] ?? 0,
        ];

        // Only include password if explicitly set (non-empty)
        // Prometheus Redis library will try to AUTH if password key exists
        $password = $config['password'] ?? null;
        if (! empty($password)) {
            $redisConfig['password'] = $password;
        }

        return $redisConfig;
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
        if (! $this->ensureInitialized()) {
            return;
        }

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
        if (! $this->ensureInitialized()) {
            return;
        }

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
        if (! $this->ensureInitialized()) {
            return;
        }

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
        if (! $this->ensureInitialized()) {
            return;
        }

        $labels = [
            $this->sanitizeLabel(get_class($exception)),
            $this->sanitizeLabel(basename($exception->getFile())),
        ];

        $this->counters['exceptions_total']->inc($labels);
    }

    public function incrementCounter(string $name, array $labels = [], float $value = 1): void
    {
        if (! $this->ensureInitialized()) {
            return;
        }

        $sanitizedName = $this->sanitizeName($name);

        if (! isset($this->counters[$sanitizedName])) {
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
        if (! $this->ensureInitialized()) {
            return;
        }

        $sanitizedName = $this->sanitizeName($name);

        if (! isset($this->gauges[$sanitizedName])) {
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
        if (! $this->ensureInitialized()) {
            return;
        }

        $sanitizedName = $this->sanitizeName($name);
        $buckets = config('observatory.prometheus.buckets', [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]);

        if (! isset($this->histograms[$sanitizedName])) {
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
        if (! $this->ensureInitialized()) {
            return '';
        }

        $renderer = new RenderTextFormat;

        return $renderer->render($this->registry->getMetricFamilySamples());
    }

    public function flush(): void
    {
        // For Prometheus, metrics are stored in the configured storage
        // and scraped by Prometheus. Nothing to flush.
    }

    public function getRegistry(): ?CollectorRegistry
    {
        $this->ensureInitialized();

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
