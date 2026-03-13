<?php

namespace JunixLabs\Observatory\Tests\Unit;

use JunixLabs\Observatory\Exporters\PrometheusExporter;
use JunixLabs\Observatory\Tests\TestCase;

class PrometheusExporterTest extends TestCase
{
    protected PrometheusExporter $exporter;

    protected function setUp(): void
    {
        parent::setUp();

        // Enable Prometheus for testing with in-memory storage
        config([
            'observatory.prometheus.enabled' => true,
            'observatory.prometheus.storage' => 'memory',
        ]);

        // Create fresh exporter with enabled config
        $this->exporter = new PrometheusExporter($this->app);
    }

    public function test_can_record_inbound_request(): void
    {
        $this->exporter->recordInbound([
            'method' => 'GET',
            'route' => 'api.users.index',
            'status_code' => 200,
            'duration' => 0.150,
        ]);

        $output = $this->exporter->getOutput();

        $this->assertStringContainsString('http_requests_total', $output);
        $this->assertStringContainsString('http_request_duration_seconds', $output);
    }

    public function test_can_record_outbound_request(): void
    {
        $this->exporter->recordOutbound([
            'method' => 'POST',
            'host' => 'api.example.com',
            'status_code' => 201,
            'duration' => 0.250,
        ]);

        $output = $this->exporter->getOutput();

        $this->assertStringContainsString('http_outbound_requests_total', $output);
        $this->assertStringContainsString('http_outbound_duration_seconds', $output);
    }

    public function test_can_record_job(): void
    {
        $this->exporter->recordJob([
            'job_name' => 'App\\Jobs\\SendEmail',
            'queue' => 'default',
            'status' => 'processed',
            'duration' => 1.5,
        ]);

        $output = $this->exporter->getOutput();

        $this->assertStringContainsString('jobs_processed_total', $output);
        $this->assertStringContainsString('jobs_duration_seconds', $output);
    }

    public function test_can_record_exception(): void
    {
        $exception = new \RuntimeException('Test exception');

        $this->exporter->recordException($exception);

        $output = $this->exporter->getOutput();

        $this->assertStringContainsString('exceptions_total', $output);
    }

    public function test_can_increment_custom_counter(): void
    {
        $this->exporter->incrementCounter('custom_events', ['type' => 'click'], 5);

        $output = $this->exporter->getOutput();

        $this->assertStringContainsString('custom_events', $output);
    }

    public function test_can_set_custom_gauge(): void
    {
        $this->exporter->setGauge('active_users', 42, ['region' => 'us']);

        $output = $this->exporter->getOutput();

        $this->assertStringContainsString('active_users', $output);
    }

    public function test_can_observe_custom_histogram(): void
    {
        $this->exporter->observeHistogram('response_size', 1024, ['endpoint' => 'api']);

        $output = $this->exporter->getOutput();

        $this->assertStringContainsString('response_size', $output);
    }

    public function test_output_is_prometheus_format(): void
    {
        $this->exporter->recordInbound([
            'method' => 'GET',
            'route' => 'home',
            'status_code' => 200,
            'duration' => 0.1,
        ]);

        $output = $this->exporter->getOutput();

        // Prometheus format should contain HELP and TYPE comments
        $this->assertStringContainsString('# HELP', $output);
        $this->assertStringContainsString('# TYPE', $output);
    }

    public function test_returns_empty_when_disabled(): void
    {
        config(['observatory.prometheus.enabled' => false]);
        $disabledExporter = new PrometheusExporter($this->app);

        $disabledExporter->recordInbound([
            'method' => 'GET',
            'route' => 'test',
            'status_code' => 200,
            'duration' => 0.1,
        ]);

        $this->assertEmpty($disabledExporter->getOutput());
    }

    public function test_does_not_connect_to_storage_when_disabled(): void
    {
        // Set Redis config that would fail if connected
        config([
            'observatory.prometheus.enabled' => false,
            'observatory.prometheus.storage' => 'redis',
            'observatory.prometheus.redis.host' => 'non-existent-host',
        ]);

        // This should NOT throw an exception because it shouldn't connect
        $disabledExporter = new PrometheusExporter($this->app);
        $disabledExporter->recordInbound([
            'method' => 'GET',
            'route' => 'test',
            'status_code' => 200,
            'duration' => 0.1,
        ]);

        $this->assertEmpty($disabledExporter->getOutput());
    }
}
