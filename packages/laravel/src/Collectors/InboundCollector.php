<?php

namespace JunixLabs\Observatory\Collectors;

use Illuminate\Http\Request;
use JunixLabs\Observatory\Contracts\ExporterInterface;
use Symfony\Component\HttpFoundation\Response;

class InboundCollector
{
    protected ?float $startTime = null;

    protected ?float $startMemory = null;

    protected ExporterInterface $exporter;

    public function __construct(ExporterInterface $exporter)
    {
        $this->exporter = $exporter;
    }

    public function start(Request $request): void
    {
        $this->startTime = microtime(true);
        $this->startMemory = memory_get_usage(true);
    }

    public function end(Request $request, Response $response): void
    {
        if ($this->startTime === null) {
            return;
        }

        $duration = microtime(true) - $this->startTime;
        $memoryUsed = memory_get_usage(true) - $this->startMemory;

        $data = [
            'method' => $request->method(),
            'uri' => $request->path(),
            'route' => $this->getRouteName($request),
            'status_code' => $response->getStatusCode(),
            'duration' => $duration,
            'memory' => $memoryUsed,
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'timestamp' => now()->toIso8601String(),
        ];

        // Add request body if configured
        if (config('observatory.inbound.record_body', false)) {
            $maxSize = config('observatory.inbound.max_body_size', 64000);
            $body = $request->getContent();
            $data['request_body'] = strlen($body) > $maxSize ? substr($body, 0, $maxSize) : $body;

            $responseBody = $response->getContent();
            $data['response_body'] = strlen($responseBody) > $maxSize ? substr($responseBody, 0, $maxSize) : $responseBody;
        }

        // Add custom labels
        $data['labels'] = config('observatory.labels', []);

        $this->exporter->recordInbound($data);

        // Reset for next request
        $this->startTime = null;
        $this->startMemory = null;
    }

    public function shouldMonitor(Request $request): bool
    {
        // Check if method should be monitored
        $methods = config('observatory.inbound.methods', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
        if (! in_array($request->method(), $methods)) {
            return false;
        }

        // Check excluded paths
        $excludePaths = config('observatory.inbound.exclude_paths', []);
        $path = $request->path();

        foreach ($excludePaths as $pattern) {
            if (fnmatch($pattern, $path)) {
                return false;
            }
        }

        return true;
    }

    protected function getRouteName(Request $request): string
    {
        $route = $request->route();

        if ($route === null) {
            return 'unknown';
        }

        // Try to get route name
        $name = $route->getName();
        if ($name) {
            return $name;
        }

        // Fall back to route pattern
        $uri = $route->uri();

        return $uri ?: 'unknown';
    }
}
