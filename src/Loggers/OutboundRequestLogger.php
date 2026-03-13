<?php

namespace JunixLabs\Observatory\Loggers;

use Illuminate\Support\Facades\Log;
use JunixLabs\Observatory\Support\SensitiveDataMasker;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

class OutboundRequestLogger
{
    protected SensitiveDataMasker $masker;

    protected array $config;

    public function __construct(?SensitiveDataMasker $masker = null)
    {
        $this->masker = $masker ?? SensitiveDataMasker::fromConfig();
        $this->config = config('observatory.outbound', []);
    }

    public function isEnabled(): bool
    {
        return config('observatory.enabled', true)
            && config('observatory.outbound.enabled', true);
    }

    public function log(
        RequestInterface $request,
        ?ResponseInterface $response,
        float $duration,
        ?\Throwable $error = null
    ): void {
        if (! $this->isEnabled()) {
            return;
        }

        $uri = $request->getUri();
        $host = $uri->getHost();

        if (! $this->shouldLog($host, $response, $duration)) {
            return;
        }

        $logData = $this->buildLogData($request, $response, $duration, $error);
        $channel = config('observatory.log_channel', 'observatory');

        if ($error || ($response && $response->getStatusCode() >= 400)) {
            Log::channel($channel)->error('HTTP_OUTBOUND', $logData);
        } else {
            Log::channel($channel)->info('HTTP_OUTBOUND', $logData);
        }
    }

    protected function shouldLog(string $host, ?ResponseInterface $response, float $duration): bool
    {
        $excludeHosts = $this->config['exclude_hosts'] ?? [];
        foreach ($excludeHosts as $excludeHost) {
            if (strcasecmp($host, $excludeHost) === 0) {
                return false;
            }
            if (str_contains($excludeHost, '*')) {
                $pattern = str_replace('*', '.*', $excludeHost);
                if (preg_match("/^{$pattern}$/i", $host)) {
                    return false;
                }
            }
        }

        $slowThreshold = $this->config['slow_threshold_ms'] ?? 0;
        if ($slowThreshold > 0) {
            $durationMs = $duration * 1000;
            if ($durationMs < $slowThreshold) {
                return false;
            }
        }

        return true;
    }

    protected function buildLogData(
        RequestInterface $request,
        ?ResponseInterface $response,
        float $duration,
        ?\Throwable $error = null
    ): array {
        $uri = $request->getUri();
        $host = $uri->getHost();
        $durationMs = $duration * 1000;

        $data = [
            'request_id' => $this->getRequestId(),
            'type' => 'outbound',
            'service' => $this->detectService($host),
            'method' => $request->getMethod(),
            'url' => (string) $uri,
            'host' => $host,
            'path' => $uri->getPath(),
            'status_code' => $response ? $response->getStatusCode() : 0,
            'duration_ms' => round($durationMs, 2),
            'environment' => config('observatory.labels.environment', config('app.env')),
        ];

        if ($error) {
            $data['error'] = [
                'class' => get_class($error),
                'message' => $error->getMessage(),
            ];
        }

        if ($this->config['log_body'] ?? false) {
            $data['request_body'] = $this->getRequestBody($request);
            if ($response) {
                $data['response_body'] = $this->getResponseBody($response);
            }
        }

        return $data;
    }

    protected function detectService(string $host): string
    {
        $serviceMap = $this->config['services'] ?? [];

        foreach ($serviceMap as $pattern => $serviceName) {
            if (strcasecmp($host, $pattern) === 0) {
                return $serviceName;
            }

            if (str_contains($pattern, '*')) {
                $regex = str_replace(['*', '.'], ['.*', '\.'], $pattern);
                if (preg_match("/^{$regex}$/i", $host)) {
                    return $serviceName;
                }
            }
        }

        // Default: extract domain name
        $parts = explode('.', $host);
        if (count($parts) >= 2) {
            return $parts[count($parts) - 2];
        }

        return $host;
    }

    protected function getRequestId(): ?string
    {
        if (function_exists('request') && request()) {
            return request()->attributes->get('request_id');
        }

        return null;
    }

    protected function getRequestBody(RequestInterface $request): mixed
    {
        $maxSize = $this->config['max_body_size'] ?? 64000;
        $body = (string) $request->getBody();
        $request->getBody()->rewind();

        if (empty($body)) {
            return null;
        }

        $decoded = json_decode($body, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            return $this->masker->maskArray($decoded);
        }

        return $this->masker->truncate($body, $maxSize);
    }

    protected function getResponseBody(ResponseInterface $response): mixed
    {
        $maxSize = $this->config['max_body_size'] ?? 64000;
        $body = (string) $response->getBody();
        $response->getBody()->rewind();

        if (empty($body)) {
            return null;
        }

        $decoded = json_decode($body, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            return $this->masker->maskArray($decoded);
        }

        return $this->masker->truncate($body, $maxSize);
    }
}
