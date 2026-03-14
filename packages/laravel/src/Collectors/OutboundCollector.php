<?php

namespace JunixLabs\Observatory\Collectors;

use Closure;
use GuzzleHttp\Promise\PromiseInterface;
use JunixLabs\Observatory\Contracts\ExporterInterface;
use JunixLabs\Observatory\Loggers\OutboundRequestLogger;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

class OutboundCollector
{
    protected ExporterInterface $exporter;

    protected OutboundRequestLogger $logger;

    protected array $excludeHosts;

    protected bool $recordBody;

    protected int $maxBodySize;

    public function __construct(ExporterInterface $exporter, OutboundRequestLogger $logger)
    {
        $this->exporter = $exporter;
        $this->logger = $logger;
        $this->excludeHosts = config('observatory.outbound.exclude_hosts', []);
        $this->recordBody = config('observatory.outbound.record_body', false);
        $this->maxBodySize = config('observatory.outbound.max_body_size', 64000);
    }

    /**
     * Get Guzzle middleware for HTTP client
     */
    public function getGuzzleMiddleware(): Closure
    {
        return function (callable $handler): Closure {
            return function (RequestInterface $request, array $options) use ($handler): PromiseInterface {
                $host = $request->getUri()->getHost();

                if (! $this->shouldMonitor($host)) {
                    return $handler($request, $options);
                }

                $startTime = microtime(true);

                return $handler($request, $options)->then(
                    function (ResponseInterface $response) use ($request, $startTime) {
                        $duration = microtime(true) - $startTime;

                        // Record metrics
                        $this->record($request, $response, $startTime);

                        // Log to channel
                        $this->logger->log($request, $response, $duration);

                        return $response;
                    },
                    function ($reason) use ($request, $startTime) {
                        $duration = microtime(true) - $startTime;

                        // Record metrics
                        $this->recordError($request, $reason, $startTime);

                        // Log to channel
                        $error = $reason instanceof \Throwable ? $reason : null;
                        $this->logger->log($request, null, $duration, $error);

                        throw $reason;
                    }
                );
            };
        };
    }

    protected function record(RequestInterface $request, ResponseInterface $response, float $startTime): void
    {
        $duration = microtime(true) - $startTime;
        $uri = $request->getUri();
        $statusCode = $response->getStatusCode();

        $data = [
            'method' => $request->getMethod(),
            'host' => $uri->getHost(),
            'path' => $uri->getPath(),
            'full_url' => (string) $uri,
            'status_code' => $statusCode,
            'duration' => $duration,
            'timestamp' => now()->toIso8601String(),
            'parent_request_id' => $this->getParentRequestId(),
            'request_size' => $request->getBody()->getSize(),
            'response_size' => $response->getBody()->getSize(),
        ];

        // Add error info for non-2xx responses
        if ($statusCode >= 400) {
            $data['error_code'] = (string) $statusCode;
            $errorBody = (string) $response->getBody();
            $response->getBody()->rewind();
            $data['error_message'] = strlen($errorBody) > 1024 ? substr($errorBody, 0, 1024) : $errorBody;
        }

        // Add request/response body if configured
        if ($this->recordBody) {
            $requestBody = (string) $request->getBody();
            $request->getBody()->rewind();
            $data['request_body'] = strlen($requestBody) > $this->maxBodySize ? substr($requestBody, 0, $this->maxBodySize) : $requestBody;

            if ($statusCode < 400) {
                $responseBody = (string) $response->getBody();
                $response->getBody()->rewind();
                $data['response_body'] = strlen($responseBody) > $this->maxBodySize ? substr($responseBody, 0, $this->maxBodySize) : $responseBody;
            }
        }

        // Add custom labels
        $data['labels'] = $this->getLabels();

        $this->exporter->recordOutbound($data);
    }

    protected function recordError(RequestInterface $request, $reason, float $startTime): void
    {
        $duration = microtime(true) - $startTime;
        $uri = $request->getUri();

        $data = [
            'method' => $request->getMethod(),
            'host' => $uri->getHost(),
            'path' => $uri->getPath(),
            'full_url' => (string) $uri,
            'status_code' => 0,
            'duration' => $duration,
            'timestamp' => now()->toIso8601String(),
            'parent_request_id' => $this->getParentRequestId(),
            'request_size' => $request->getBody()->getSize(),
            'response_size' => null,
            'error_message' => $reason instanceof \Throwable ? $reason->getMessage() : (string) $reason,
            'error_code' => 'connection_error',
            'labels' => $this->getLabels(),
        ];

        $this->exporter->recordOutbound($data);
    }

    protected function getParentRequestId(): ?string
    {
        try {
            $header = config('observatory.request_id.header', 'X-Request-Id');

            return request()?->header($header);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Record outbound request from Laravel HTTP client events.
     * Used as fallback when Guzzle globalMiddleware is not available (Laravel < 10.14).
     */
    public function recordFromEvent(
        string $method,
        string $url,
        int $statusCode,
        float $duration,
        ?string $requestBody = null,
        ?string $responseBody = null,
        ?string $errorMessage = null
    ): void {
        $parsed = parse_url($url);
        $host = $parsed['host'] ?? '';
        $path = $parsed['path'] ?? '/';

        $data = [
            'method' => $method,
            'host' => $host,
            'path' => $path,
            'full_url' => $url,
            'status_code' => $statusCode,
            'duration' => $duration,
            'timestamp' => now()->toIso8601String(),
            'parent_request_id' => $this->getParentRequestId(),
            'request_size' => $requestBody ? strlen($requestBody) : null,
            'response_size' => $responseBody ? strlen($responseBody) : null,
        ];

        if ($errorMessage !== null) {
            $data['error_message'] = $errorMessage;
            $data['error_code'] = 'connection_error';
        } elseif ($statusCode >= 400) {
            $data['error_code'] = (string) $statusCode;
            if ($responseBody) {
                $data['error_message'] = strlen($responseBody) > 1024
                    ? substr($responseBody, 0, 1024)
                    : $responseBody;
            }
        }

        $data['labels'] = $this->getLabels();

        $this->exporter->recordOutbound($data);

        $this->logger->logFromEvent($method, $url, $statusCode, $duration, $errorMessage);
    }

    protected function getLabels(): array
    {
        return config('observatory.labels', []);
    }

    public function shouldMonitor(string $host): bool
    {
        foreach ($this->excludeHosts as $excludeHost) {
            if (strcasecmp($host, $excludeHost) === 0) {
                return false;
            }
        }

        return true;
    }
}
