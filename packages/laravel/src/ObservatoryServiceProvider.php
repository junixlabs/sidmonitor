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
use JunixLabs\Observatory\Collectors\ScheduledTaskCollector;
use JunixLabs\Observatory\Contracts\ExporterInterface;
use JunixLabs\Observatory\Exporters\PrometheusExporter;
use JunixLabs\Observatory\Exporters\SidMonitorExporter;
use JunixLabs\Observatory\Http\Controllers\MetricsController;
use JunixLabs\Observatory\Loggers\ExceptionLogger;
use JunixLabs\Observatory\Loggers\InboundRequestLogger;
use JunixLabs\Observatory\Loggers\JobLogger;
use JunixLabs\Observatory\Loggers\OutboundRequestLogger;
use JunixLabs\Observatory\Loggers\ScheduledTaskLogger;
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
        $this->app->singleton(ScheduledTaskCollector::class, function ($app) {
            return new ScheduledTaskCollector(
                $app->make(ExporterInterface::class),
                $app->make(ScheduledTaskLogger::class)
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

        // Register scheduled task logger
        $this->app->singleton(ScheduledTaskLogger::class, function ($app) {
            return new ScheduledTaskLogger($app->make(SensitiveDataMasker::class));
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
        $this->registerScheduledTaskListeners();
        $this->registerExceptionHandler();
        $this->registerShutdownHook();
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

        // Auto-observe all HTTP requests
        // Laravel 10.14+: use globalMiddleware (Guzzle-level, captures all requests)
        // Laravel 8-10.13: fallback to HTTP client events (captures Http facade calls only)
        try {
            $factory = Http::getFacadeRoot();
            if ($factory && method_exists($factory, 'globalMiddleware')) {
                Http::globalMiddleware($collector->getGuzzleMiddleware());

                return;
            }
        } catch (\Throwable) {
            // Fall through to event-based approach
        }

        // Fallback: use Laravel HTTP client events (available since Laravel 8.x)
        $this->registerOutboundEventListeners($collector);
    }

    /**
     * Fallback outbound monitoring via Laravel HTTP client events.
     * Works on Laravel 8.x+ where globalMiddleware is not available.
     */
    protected function registerOutboundEventListeners(OutboundCollector $collector): void
    {
        // Track pending request start times keyed by object ID to avoid URL collisions
        $pendingTimings = [];

        if (class_exists(\Illuminate\Http\Client\Events\RequestSending::class)) {
            Event::listen(\Illuminate\Http\Client\Events\RequestSending::class, function ($event) use (&$pendingTimings) {
                $key = spl_object_id($event->request);
                $pendingTimings[$key] = microtime(true);

                // Evict stale entries (>5 min) to prevent memory leaks in long-running processes
                if (count($pendingTimings) > 100) {
                    $cutoff = microtime(true) - 300;
                    $pendingTimings = array_filter($pendingTimings, fn ($t) => $t > $cutoff);
                }
            });
        }

        if (class_exists(\Illuminate\Http\Client\Events\ResponseReceived::class)) {
            Event::listen(\Illuminate\Http\Client\Events\ResponseReceived::class, function ($event) use ($collector, &$pendingTimings) {
                $url = (string) $event->request->url();
                $host = parse_url($url, PHP_URL_HOST) ?: '';

                $key = spl_object_id($event->request);

                if (! $collector->shouldMonitor($host)) {
                    unset($pendingTimings[$key]);

                    return;
                }

                $startTime = $pendingTimings[$key] ?? microtime(true);
                unset($pendingTimings[$key]);

                $collector->recordFromEvent(
                    $event->request->method(),
                    $url,
                    $event->response->status(),
                    microtime(true) - $startTime
                );
            });
        }

        if (class_exists(\Illuminate\Http\Client\Events\ConnectionFailed::class)) {
            Event::listen(\Illuminate\Http\Client\Events\ConnectionFailed::class, function ($event) use ($collector, &$pendingTimings) {
                $url = (string) $event->request->url();
                $host = parse_url($url, PHP_URL_HOST) ?: '';

                $key = spl_object_id($event->request);

                if (! $collector->shouldMonitor($host)) {
                    unset($pendingTimings[$key]);

                    return;
                }

                $startTime = $pendingTimings[$key] ?? microtime(true);
                unset($pendingTimings[$key]);

                $collector->recordFromEvent(
                    $event->request->method(),
                    $url,
                    0,
                    microtime(true) - $startTime,
                    null,
                    null,
                    'Connection failed'
                );
            });
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

    protected function registerScheduledTaskListeners(): void
    {
        if (! config('observatory.scheduled_tasks.enabled', true)) {
            return;
        }

        // Guard: ScheduledTaskStarting was added in Laravel 6.x, ScheduledTaskFailed in 7.x
        // Safe to use on Laravel 9+, class_exists guard kept for edge cases
        if (! class_exists(\Illuminate\Console\Events\ScheduledTaskStarting::class)) {
            return;
        }

        $collector = $this->app->make(ScheduledTaskCollector::class);

        Event::listen(\Illuminate\Console\Events\ScheduledTaskStarting::class, function ($event) use ($collector) {
            $collector->start($event->task);
        });

        Event::listen(\Illuminate\Console\Events\ScheduledTaskFinished::class, function ($event) use ($collector) {
            $collector->end($event->task, 'completed');
        });

        Event::listen(\Illuminate\Console\Events\ScheduledTaskFailed::class, function ($event) use ($collector) {
            $collector->end($event->task, 'failed', $event->exception);
        });

        Event::listen(\Illuminate\Console\Events\ScheduledTaskSkipped::class, function ($event) use ($collector) {
            $collector->skip($event->task);
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
                    // Log to Observatory — wrapped to never suppress the original exception
                    try {
                        $this->logger->log($e);
                    } catch (\Throwable) {
                        // Observatory logging must never prevent error reporting
                    }

                    try {
                        if (config('observatory.exceptions.enabled', true)) {
                            $this->exporter->recordException($e);
                        }
                    } catch (\Throwable) {
                        // Observatory metrics must never prevent error reporting
                    }

                    // Always call original handler
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

    protected function registerShutdownHook(): void
    {
        // Flush buffer when Laravel terminates (after response is sent)
        $this->app->terminating(function () {
            try {
                $this->app->make(ExporterInterface::class)->flush();
            } catch (\Throwable) {
                // Never fail during shutdown
            }
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
