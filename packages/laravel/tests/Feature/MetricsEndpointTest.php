<?php

namespace JunixLabs\Observatory\Tests\Feature;

use JunixLabs\Observatory\Contracts\ExporterInterface;
use JunixLabs\Observatory\Exporters\PrometheusExporter;
use JunixLabs\Observatory\Tests\TestCase;

class MetricsEndpointTest extends TestCase
{
    public function test_metrics_endpoint_returns_200(): void
    {
        $response = $this->get('/metrics');

        $response->assertStatus(200);
    }

    public function test_metrics_endpoint_returns_text_content_type(): void
    {
        $response = $this->get('/metrics');

        $response->assertHeader('Content-Type', 'text/plain; charset=utf-8');
    }

    public function test_metrics_endpoint_contains_prometheus_format(): void
    {
        // Enable Prometheus for this test
        config([
            'observatory.prometheus.enabled' => true,
            'observatory.prometheus.storage' => 'memory',
        ]);

        // Rebind the exporter with new config
        $this->app->forgetInstance(ExporterInterface::class);
        $this->app->singleton(ExporterInterface::class, function ($app) {
            return new PrometheusExporter($app);
        });

        $response = $this->get('/metrics');

        $content = $response->getContent();

        // Should contain at least the default metrics headers
        $this->assertStringContainsString('# HELP', $content);
        $this->assertStringContainsString('# TYPE', $content);
    }

    public function test_metrics_endpoint_requires_auth_when_enabled(): void
    {
        config(['observatory.prometheus.auth.enabled' => true]);
        config(['observatory.prometheus.auth.username' => 'test']);
        config(['observatory.prometheus.auth.password' => 'secret']);

        $response = $this->get('/metrics');

        $response->assertStatus(401);
    }

    public function test_metrics_endpoint_accepts_valid_auth(): void
    {
        config(['observatory.prometheus.auth.enabled' => true]);
        config(['observatory.prometheus.auth.username' => 'test']);
        config(['observatory.prometheus.auth.password' => 'secret']);

        $response = $this->withBasicAuth('test', 'secret')->get('/metrics');

        $response->assertStatus(200);
    }
}
