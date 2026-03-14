<?php

namespace JunixLabs\Observatory\Loggers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use JunixLabs\Observatory\Support\SensitiveDataMasker;
use Symfony\Component\HttpFoundation\Response;

class InboundRequestLogger
{
    protected SensitiveDataMasker $masker;

    protected array $config;

    protected array $requestContext = [];

    public function __construct(?SensitiveDataMasker $masker = null)
    {
        $this->masker = $masker ?? SensitiveDataMasker::fromConfig();
        $this->config = config('observatory.inbound', []);
    }

    public function isEnabled(): bool
    {
        return config('observatory.enabled', true)
            && config('observatory.inbound.enabled', true);
    }

    public function start(Request $request): void
    {
        $key = spl_object_id($request);
        $this->requestContext[$key] = [
            'start_time' => microtime(true),
            'start_memory' => memory_get_usage(true),
            'request_id' => $request->attributes->get('request_id'),
        ];
    }

    public function log(Request $request, Response $response): void
    {
        if (! $this->isEnabled()) {
            return;
        }

        $key = spl_object_id($request);
        $context = $this->requestContext[$key] ?? null;
        $startTime = $context['start_time'] ?? null;

        $duration = $startTime ? (microtime(true) - $startTime) * 1000 : 0;

        if (! $this->shouldLog($request, $response, $duration)) {
            unset($this->requestContext[$key]);

            return;
        }

        $peakMemory = memory_get_peak_usage(true);

        $logData = $this->buildLogData($request, $response, $duration, $peakMemory, $context);

        $channel = config('observatory.log_channel', 'observatory');

        Log::channel($channel)->info('HTTP_REQUEST', $logData);

        unset($this->requestContext[$key]);
    }

    public function shouldLog(Request $request, Response $response, float $duration = 0): bool
    {
        $excludePaths = $this->config['exclude_paths'] ?? [];
        $path = $request->path();

        foreach ($excludePaths as $pattern) {
            if (fnmatch($pattern, $path)) {
                return false;
            }
        }

        $slowThreshold = $this->config['slow_threshold_ms'] ?? 0;
        if ($slowThreshold > 0 && $duration > 0) {
            if ($duration < $slowThreshold) {
                return false;
            }
        }

        return true;
    }

    protected function buildLogData(
        Request $request,
        Response $response,
        float $duration,
        int $peakMemory,
        ?array $context = null
    ): array {
        $data = [
            'request_id' => $context['request_id'] ?? $request->attributes->get('request_id'),
            'type' => 'inbound',
            'method' => $request->method(),
            'url' => $request->fullUrl(),
            'path' => $request->path(),
            'route' => $this->getRouteName($request),
            'status_code' => $response->getStatusCode(),
            'duration_ms' => round($duration, 2),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'memory_mb' => round($peakMemory / 1024 / 1024, 2),
        ];

        // Add user info
        $user = $request->user();
        if ($user) {
            $data['user_id'] = $user->id ?? null;
        }

        // Add custom headers (configurable)
        $customHeaders = $this->config['custom_headers'] ?? [];
        foreach ($customHeaders as $headerName => $fieldName) {
            $value = $request->header($headerName);
            if ($value !== null) {
                $data[$fieldName] = $value;
            }
        }

        // Add request body if enabled
        if ($this->config['log_body'] ?? false) {
            $data['request_body'] = $this->getRequestBody($request);
        }

        // Add query parameters (normalized to prevent log bloat)
        $queryParams = $request->query();
        if (! empty($queryParams)) {
            $maxItems = $this->config['max_query_items'] ?? 50;
            $maxDepth = $this->config['max_query_depth'] ?? 3;
            $normalized = $this->masker->normalizeArray($queryParams, $maxItems, $maxDepth);
            $data['query_params'] = $this->masker->maskArray($normalized);
        }

        // Add environment label
        $data['environment'] = config('observatory.labels.environment', config('app.env'));

        return $data;
    }

    protected function getRequestBody(Request $request): mixed
    {
        $maxSize = $this->config['max_body_size'] ?? 64000;
        $content = $request->all();

        if (! empty($content)) {
            return $this->masker->maskArray($content);
        }

        $rawContent = $request->getContent();
        if (empty($rawContent)) {
            return null;
        }

        $decoded = json_decode($rawContent, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            return $this->masker->maskArray($decoded);
        }

        return $this->masker->truncate($rawContent, $maxSize);
    }

    protected function getRouteName(Request $request): string
    {
        $route = $request->route();

        if ($route === null) {
            return 'unknown';
        }

        return $route->getName() ?: $route->uri() ?: 'unknown';
    }

    public function setRequestId(string $requestId): self
    {
        // Kept for backwards compatibility — prefer using start() which captures request_id automatically.
        return $this;
    }
}
