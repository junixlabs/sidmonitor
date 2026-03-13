<?php

namespace JunixLabs\Observatory;

use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use JunixLabs\Observatory\Collectors\InboundCollector;
use JunixLabs\Observatory\Collectors\JobCollector;
use JunixLabs\Observatory\Collectors\OutboundCollector;
use JunixLabs\Observatory\Contracts\ExporterInterface;
use JunixLabs\Observatory\Exporters\PrometheusExporter;
use JunixLabs\Observatory\Exporters\SidMonitorExporter;
use JunixLabs\Observatory\Http\Controllers\MetricsController;
use JunixLabs\Observatory\Loggers\ExceptionLogger;
use JunixLabs\Observatory\Loggers\InboundRequestLogger;
use JunixLabs\Observatory\Loggers\JobLogger;
use JunixLabs\Observatory\Loggers\OutboundRequestLogger;
use JunixLabs\Observatory\Middleware\ObserveRequests;
use JunixLabs\Observatory\Middleware\RequestIdMiddleware;
use JunixLabs\Observatory\Support\SensitiveDataMasker;

class ObservatoryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../config/observatory.php', 'observatory');

        // Auto-register observatory logging channel
        $this->registerLoggingChannel();

        // Register collectors
        $this->app->singleton(InboundCollector::class);
        $this->app->singleton(OutboundCollector::class);
        $this->app->singleton(JobCollector::class, function ($app) {
            return new JobCollector(
                $app->make(ExporterInterface::class),
                $app->make(JobLogger::class)
            );
        });

        // Register exporter based on config
        $this->app->singleton(ExporterInterface::class, function ($app) {
            $exporter = config('observatory.exporter', 'prometheus');

            return match ($exporter) {
                'sidmonitor' => new SidMonitorExporter($app),
                default => new PrometheusExporter($app),
            };
        });

        // Register sensitive data masker
        $this->app->singleton(SensitiveDataMasker::class, function () {
            return SensitiveDataMasker::fromConfig();
        });

        // Register inbound request logger
        $this->app->singleton(InboundRequestLogger::class, function ($app) {
            return new InboundRequestLogger($app->make(SensitiveDataMasker::class));
        });

        // Register outbound request logger
        $this->app->singleton(OutboundRequestLogger::class, function ($app) {
            return new OutboundRequestLogger($app->make(SensitiveDataMasker::class));
        });

        // Register job logger
        $this->app->singleton(JobLogger::class, function ($app) {
            return new JobLogger($app->make(SensitiveDataMasker::class));
        });

        // Register exception logger
        $this->app->singleton(ExceptionLogger::class, function ($app) {
            return new ExceptionLogger($app->make(SensitiveDataMasker::class));
        });

        // Register facade
        $this->app->singleton('observatory', function ($app) {
            return new Observatory($app);
        });
    }

    public function boot(): void
    {
        if (! config('observatory.enabled', true)) {
            return;
        }

        $this->publishes([
            __DIR__ . '/../config/observatory.php' => config_path('observatory.php'),
        ], 'observatory-config');

        $this->registerMiddleware();
        $this->registerRoutes();
        $this->registerHttpMacros();
        $this->registerJobListeners();
        $this->registerExceptionHandler();
    }

    protected function registerMiddleware(): void
    {
        $kernel = $this->app->make(Kernel::class);

        // Register RequestIdMiddleware first (should run before other middlewares)
        if (config('observatory.request_id.enabled', true)) {
            $kernel->pushMiddleware(RequestIdMiddleware::class);
        }

        // Register metrics and logging middleware
        if (config('observatory.inbound.enabled', true)) {
            $kernel->pushMiddleware(ObserveRequests::class);
        }
    }

    protected function registerRoutes(): void
    {
        if (! config('observatory.prometheus.enabled', false)) {
            return;
        }

        $endpoint = config('observatory.prometheus.endpoint', '/metrics');

        Route::get($endpoint, [MetricsController::class, 'index'])
            ->name('observatory.metrics');
    }

    protected function registerHttpMacros(): void
    {
        if (! config('observatory.outbound.enabled', true)) {
            return;
        }

        $collector = $this->app->make(OutboundCollector::class);

        Http::macro('withObservatory', function () use ($collector) {
            return Http::withMiddleware($collector->getGuzzleMiddleware());
        });

        // Auto-observe all HTTP requests (Laravel 10.14+ only)
        // Laravel 9 doesn't have globalMiddleware, use Http::withObservatory() instead
        try {
            $factory = Http::getFacadeRoot();
            if ($factory && method_exists($factory, 'globalMiddleware')) {
                Http::globalMiddleware($collector->getGuzzleMiddleware());
            }
        } catch (\Throwable $e) {
            // Silently ignore - Laravel 9 users should use Http::withObservatory()
        }
    }

    protected function registerJobListeners(): void
    {
        if (! config('observatory.jobs.enabled', true)) {
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

    protected function registerExceptionHandler(): void
    {
        if (! config('observatory.exceptions.enabled', true)) {
            return;
        }

        $logger = $this->app->make(ExceptionLogger::class);
        $exporter = $this->app->make(ExporterInterface::class);

        // Extend Laravel's exception handler to log exceptions
        $this->app->extend(ExceptionHandler::class, function ($handler) use ($logger, $exporter) {
            return new class($handler, $logger, $exporter) implements ExceptionHandler
            {
                protected $handler;

                protected $logger;

                protected $exporter;

                public function __construct($handler, ExceptionLogger $logger, ExporterInterface $exporter)
                {
                    $this->handler = $handler;
                    $this->logger = $logger;
                    $this->exporter = $exporter;
                }

                public function report(\Throwable $e): void
                {
                    // Log to Observatory
                    $this->logger->log($e);

                    // Record metric
                    if (config('observatory.exceptions.enabled', true)) {
                        $this->exporter->recordException($e);
                    }

                    // Call original handler
                    $this->handler->report($e);
                }

                public function shouldReport(\Throwable $e): bool
                {
                    return $this->handler->shouldReport($e);
                }

                public function render($request, \Throwable $e)
                {
                    return $this->handler->render($request, $e);
                }

                public function renderForConsole($output, \Throwable $e): void
                {
                    $this->handler->renderForConsole($output, $e);
                }
            };
        });
    }

    protected function registerLoggingChannel(): void
    {
        // Get existing logging config
        $loggingConfig = $this->app['config']->get('logging.channels', []);

        // Only add if 'observatory' channel doesn't exist
        if (! isset($loggingConfig['observatory'])) {
            $this->app['config']->set('logging.channels.observatory', [
                'driver' => 'daily',
                'path' => storage_path('logs/observatory.log'),
                'level' => $this->app['config']->get('logging.level', 'debug'),
                'days' => 14,
                'formatter' => \Monolog\Formatter\JsonFormatter::class,
            ]);
        }
    }
}
