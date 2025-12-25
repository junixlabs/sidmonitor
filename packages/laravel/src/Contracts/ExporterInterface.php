<?php

namespace JunixLabs\Observatory\Contracts;

interface ExporterInterface
{
    /**
     * Record an inbound HTTP request
     */
    public function recordInbound(array $data): void;

    /**
     * Record an outbound HTTP request
     */
    public function recordOutbound(array $data): void;

    /**
     * Record a queue job execution
     */
    public function recordJob(array $data): void;

    /**
     * Record an exception
     */
    public function recordException(\Throwable $exception, array $context = []): void;

    /**
     * Increment a counter metric
     */
    public function incrementCounter(string $name, array $labels = [], float $value = 1): void;

    /**
     * Set a gauge metric value
     */
    public function setGauge(string $name, float $value, array $labels = []): void;

    /**
     * Observe a histogram metric
     */
    public function observeHistogram(string $name, float $value, array $labels = []): void;

    /**
     * Get the current metrics output (for Prometheus endpoint)
     */
    public function getOutput(): string;

    /**
     * Flush/send any buffered data (for push-based exporters)
     */
    public function flush(): void;
}
