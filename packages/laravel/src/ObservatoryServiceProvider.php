<?php

namespace JunixLabs\Observatory;

use Illuminate\Support\ServiceProvider;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use JunixLabs\Observatory\Collectors\InboundCollector;
use JunixLabs\Observatory\Collectors\OutboundCollector;
use JunixLabs\Observatory\Collectors\JobCollector;
use JunixLabs\Observatory\Contracts\ExporterInterface;
use JunixLabs\Observatory\Exporters\PrometheusExporter;
use JunixLabs\Observatory\Exporters\SidMonitorExporter;
use JunixLabs\Observatory\Http\Controllers\MetricsController;
use JunixLabs\Observatory\Middleware\ObserveRequests;

class ObservatoryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../config/observatory.php', 'observatory');

        // Register collectors
        $this->app->singleton(InboundCollector::class);
        $this->app->singleton(OutboundCollector::class);
        $this->app->singleton(JobCollector::class);

        // Register exporter based on config
        $this->app->singleton(ExporterInterface::class, function ($app) {
            $exporter = config('observatory.exporter', 'prometheus');

            return match ($exporter) {
                'sidmonitor' => new SidMonitorExporter($app),
                default => new PrometheusExporter($app),
            };
        });

        // Register facade
        $this->app->singleton('observatory', function ($app) {
            return new Observatory($app);
        });
    }

    public function boot(): void
    {
        if (!config('observatory.enabled', true)) {
            return;
        }

        $this->publishes([
            __DIR__ . '/../config/observatory.php' => config_path('observatory.php'),
        ], 'observatory-config');

        $this->registerMiddleware();
        $this->registerRoutes();
        $this->registerHttpMacros();
        $this->registerJobListeners();
    }

    protected function registerMiddleware(): void
    {
        if (!config('observatory.inbound.enabled', true)) {
            return;
        }

        $kernel = $this->app->make(Kernel::class);
        $kernel->pushMiddleware(ObserveRequests::class);
    }

    protected function registerRoutes(): void
    {
        $exporter = config('observatory.exporter', 'prometheus');

        if ($exporter === 'prometheus') {
            $endpoint = config('observatory.prometheus.endpoint', '/metrics');

            Route::get($endpoint, [MetricsController::class, 'index'])
                ->name('observatory.metrics')
                ->middleware('web');
        }
    }

    protected function registerHttpMacros(): void
    {
        if (!config('observatory.outbound.enabled', true)) {
            return;
        }

        $collector = $this->app->make(OutboundCollector::class);

        Http::macro('withObservatory', function () use ($collector) {
            return Http::withMiddleware($collector->getGuzzleMiddleware());
        });

        // Auto-observe all HTTP requests
        Http::globalMiddleware($collector->getGuzzleMiddleware());
    }

    protected function registerJobListeners(): void
    {
        if (!config('observatory.jobs.enabled', true)) {
            return;
        }

        $collector = $this->app->make(JobCollector::class);

        Event::listen(JobProcessing::class, function (JobProcessing $event) use ($collector) {
            $collector->start($event->job);
        });

        Event::listen(JobProcessed::class, function (JobProcessed $event) use ($collector) {
            $collector->end($event->job, 'processed');
        });

        Event::listen(JobFailed::class, function (JobFailed $event) use ($collector) {
            $collector->end($event->job, 'failed', $event->exception);
        });
    }
}
