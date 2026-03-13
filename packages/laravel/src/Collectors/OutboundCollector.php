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

    public function __construct(ExporterInterface $exporter, OutboundRequestLogger $logger)
    {
        $this->exporter = $exporter;
        $this->logger = $logger;
    }

    /**
     * Get Guzzle middleware for HTTP client
     */
    public function getGuzzleMiddleware(): Closure
    {
        return function (callable $handler): Closure {
            return function (RequestInterface $request, array $options) use ($handler): PromiseInterface {
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

        $data = [
            'method' => $request->getMethod(),
            'host' => $uri->getHost(),
            'path' => $uri->getPath(),
            'full_url' => (string) $uri,
            'status_code' => $response->getStatusCode(),
            'duration' => $duration,
            'timestamp' => now()->toIso8601String(),
        ];

        // Add request/response body if configured
        if (config('observatory.outbound.record_body', false)) {
            $maxSize = config('observatory.outbound.max_body_size', 64000);

            $requestBody = (string) $request->getBody();
            $request->getBody()->rewind();
            $data['request_body'] = strlen($requestBody) > $maxSize ? substr($requestBody, 0, $maxSize) : $requestBody;

            $responseBody = (string) $response->getBody();
            $response->getBody()->rewind();
            $data['response_body'] = strlen($responseBody) > $maxSize ? substr($responseBody, 0, $maxSize) : $responseBody;
        }

        // Add custom labels
        $data['labels'] = config('observatory.labels', []);

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
            'error' => $reason instanceof \Throwable ? $reason->getMessage() : (string) $reason,
            'timestamp' => now()->toIso8601String(),
            'labels' => config('observatory.labels', []),
        ];

        $this->exporter->recordOutbound($data);
    }

    public function shouldMonitor(string $host): bool
    {
        $excludeHosts = config('observatory.outbound.exclude_hosts', []);

        foreach ($excludeHosts as $excludeHost) {
            if (strcasecmp($host, $excludeHost) === 0) {
                return false;
            }
        }

        return true;
    }
}
