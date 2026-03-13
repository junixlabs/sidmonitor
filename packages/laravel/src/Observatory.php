<?php

namespace JunixLabs\Observatory;

use Illuminate\Contracts\Foundation\Application;
use JunixLabs\Observatory\Collectors\InboundCollector;
use JunixLabs\Observatory\Collectors\JobCollector;
use JunixLabs\Observatory\Collectors\OutboundCollector;
use JunixLabs\Observatory\Contracts\ExporterInterface;

class Observatory
{
    protected Application $app;

    public function __construct(Application $app)
    {
        $this->app = $app;
    }

    public function inbound(): InboundCollector
    {
        return $this->app->make(InboundCollector::class);
    }

    public function outbound(): OutboundCollector
    {
        return $this->app->make(OutboundCollector::class);
    }

    public function jobs(): JobCollector
    {
        return $this->app->make(JobCollector::class);
    }

    public function exporter(): ExporterInterface
    {
        return $this->app->make(ExporterInterface::class);
    }

    /**
     * Record a custom metric counter
     */
    public function increment(string $name, array $labels = [], float $value = 1): void
    {
        $this->exporter()->incrementCounter($name, $labels, $value);
    }

    /**
     * Record a custom metric gauge
     */
    public function gauge(string $name, float $value, array $labels = []): void
    {
        $this->exporter()->setGauge($name, $value, $labels);
    }

    /**
     * Record a custom histogram observation
     */
    public function histogram(string $name, float $value, array $labels = []): void
    {
        $this->exporter()->observeHistogram($name, $value, $labels);
    }

    /**
     * Check if Observatory is enabled
     */
    public function enabled(): bool
    {
        return config('observatory.enabled', true);
    }
}
