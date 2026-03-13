<?php

namespace JunixLabs\Observatory\Middleware;

use Closure;
use Illuminate\Http\Request;
use JunixLabs\Observatory\Collectors\InboundCollector;
use JunixLabs\Observatory\Loggers\InboundRequestLogger;
use Symfony\Component\HttpFoundation\Response;

class ObserveRequests
{
    protected InboundCollector $collector;

    protected InboundRequestLogger $logger;

    public function __construct(InboundCollector $collector, InboundRequestLogger $logger)
    {
        $this->collector = $collector;
        $this->logger = $logger;
    }

    public function handle(Request $request, Closure $next): Response
    {
        if (! config('observatory.enabled', true)) {
            return $next($request);
        }

        $shouldMonitorMetrics = $this->collector->shouldMonitor($request);
        $shouldLog = $this->logger->isEnabled();

        // Start metrics collection
        if ($shouldMonitorMetrics) {
            $this->collector->start($request);
        }

        // Start logger timing
        if ($shouldLog) {
            $this->logger->start($request);
        }

        // Process request
        $response = $next($request);

        // End metrics collection
        if ($shouldMonitorMetrics) {
            $this->collector->end($request, $response);
        }

        // Log request
        if ($shouldLog) {
            $this->logger->log($request, $response);
        }

        return $response;
    }
}
