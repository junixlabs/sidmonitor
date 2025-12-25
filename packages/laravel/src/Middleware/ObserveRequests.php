<?php

namespace JunixLabs\Observatory\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use JunixLabs\Observatory\Collectors\InboundCollector;

class ObserveRequests
{
    protected InboundCollector $collector;

    public function __construct(InboundCollector $collector)
    {
        $this->collector = $collector;
    }

    public function handle(Request $request, Closure $next): Response
    {
        if (!config('observatory.enabled', true)) {
            return $next($request);
        }

        if (!$this->collector->shouldMonitor($request)) {
            return $next($request);
        }

        $this->collector->start($request);

        $response = $next($request);

        $this->collector->end($request, $response);

        return $response;
    }
}
