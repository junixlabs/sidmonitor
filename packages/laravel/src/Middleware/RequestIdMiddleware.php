<?php

namespace JunixLabs\Observatory\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class RequestIdMiddleware
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('observatory.request_id.enabled', true)) {
            return $next($request);
        }

        $headerName = config('observatory.request_id.header_name', 'X-Request-Id');

        // Extract or generate request ID
        $requestId = $request->header($headerName);

        if (empty($requestId) && config('observatory.request_id.generate_if_missing', true)) {
            $requestId = (string) Str::uuid();
        }

        if ($requestId) {
            // Store in request attributes for access by other components
            $request->attributes->set('request_id', $requestId);

            // Add to Log context
            if (config('observatory.request_id.include_in_log_context', true)) {
                Log::withContext(['request_id' => $requestId]);
            }
        }

        // Continue with request
        $response = $next($request);

        // Add to response headers
        if ($requestId && config('observatory.request_id.include_in_response', true)) {
            $response->headers->set($headerName, $requestId);
        }

        return $response;
    }
}
