<?php

namespace JunixLabs\Observatory\Loggers;

use Illuminate\Support\Facades\Log;
use JunixLabs\Observatory\Support\SensitiveDataMasker;

class ExceptionLogger
{
    protected SensitiveDataMasker $masker;

    protected array $config;

    public function __construct(?SensitiveDataMasker $masker = null)
    {
        $this->masker = $masker ?? SensitiveDataMasker::fromConfig();
        $this->config = config('observatory.exceptions', []);
    }

    public function isEnabled(): bool
    {
        return config('observatory.enabled', true)
            && config('observatory.exceptions.enabled', true);
    }

    /**
     * Log an exception
     */
    public function log(\Throwable $exception, array $context = []): void
    {
        if (! $this->isEnabled()) {
            return;
        }

        if (! $this->shouldLog($exception)) {
            return;
        }

        $logData = $this->buildLogData($exception, $context);
        $channel = config('observatory.log_channel', 'observatory');

        Log::channel($channel)->error('EXCEPTION', $logData);
    }

    /**
     * Check if exception should be logged
     */
    protected function shouldLog(\Throwable $exception): bool
    {
        // Check ignored exceptions
        $ignoreExceptions = $this->config['ignore'] ?? [];

        foreach ($ignoreExceptions as $ignoreClass) {
            if ($exception instanceof $ignoreClass) {
                return false;
            }
        }

        // Check ignored exception patterns (by class name)
        $ignorePatterns = $this->config['ignore_patterns'] ?? [];
        $exceptionClass = get_class($exception);

        foreach ($ignorePatterns as $pattern) {
            if (fnmatch($pattern, $exceptionClass)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Build log data array
     */
    protected function buildLogData(\Throwable $exception, array $context = []): array
    {
        $data = [
            'request_id' => $this->getRequestId(),
            'exception_class' => get_class($exception),
            'message' => $exception->getMessage(),
            'code' => $exception->getCode(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'timestamp' => now()->toIso8601String(),
        ];

        // Add request context if available
        if ($this->config['log_request_context'] ?? true) {
            $requestContext = $this->getRequestContext();
            if (! empty($requestContext)) {
                $data['request'] = $requestContext;
            }
        }

        // Add user context if available
        if ($this->config['log_user'] ?? true) {
            $userContext = $this->getUserContext();
            if (! empty($userContext)) {
                $data['user'] = $userContext;
            }
        }

        // Add stack trace
        if ($this->config['log_stack_trace'] ?? true) {
            $data['trace'] = $this->formatStackTrace($exception);
        }

        // Add previous exception if exists
        $previous = $exception->getPrevious();
        if (($this->config['log_previous'] ?? true) && $previous !== null) {
            $data['previous'] = $this->formatPreviousException($previous);
        }

        // Add custom context
        if (! empty($context)) {
            $data['context'] = $this->masker->maskArray($context);
        }

        // Add memory info
        if ($this->config['log_memory'] ?? true) {
            $data['memory'] = [
                'used_mb' => round(memory_get_usage(true) / 1024 / 1024, 2),
                'peak_mb' => round(memory_get_peak_usage(true) / 1024 / 1024, 2),
            ];
        }

        // Add environment label
        $data['environment'] = config('observatory.labels.environment', config('app.env'));

        return $data;
    }

    /**
     * Get current request ID
     */
    protected function getRequestId(): ?string
    {
        if (function_exists('request') && request()) {
            return request()->attributes->get('request_id');
        }

        return null;
    }

    /**
     * Get request context
     */
    protected function getRequestContext(): array
    {
        if (! function_exists('request') || ! request()) {
            return [];
        }

        $request = request();

        $context = [
            'method' => $request->method(),
            'url' => $request->fullUrl(),
            'path' => $request->path(),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ];

        // Add route info
        if ($route = $request->route()) {
            $context['route'] = $route->getName() ?: $route->uri();
        }

        // Add headers if configured
        if ($this->config['log_request_headers'] ?? false) {
            $context['headers'] = $this->masker->filterHeaders($request->headers->all());
        }

        // Add body if configured
        if ($this->config['log_request_body'] ?? false) {
            $body = $request->all();
            if (! empty($body)) {
                $context['body'] = $this->masker->maskArray($body);
            }
        }

        return $context;
    }

    /**
     * Get user context
     */
    protected function getUserContext(): array
    {
        try {
            $guard = auth()->guard();
            if (! $guard->check()) {
                return [];
            }

            $user = $guard->user();
            $context = [
                'id' => $user->id ?? null,
            ];

            // Add custom headers from request (uses inbound config)
            if (function_exists('request') && request()) {
                $customHeaders = config('observatory.inbound.custom_headers', []);
                foreach ($customHeaders as $headerName => $fieldName) {
                    $value = request()->header($headerName);
                    if ($value !== null) {
                        $context[$fieldName] = $value;
                    }
                }
            }

            return $context;
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * Format stack trace
     */
    protected function formatStackTrace(\Throwable $exception): array
    {
        $maxFrames = $this->config['max_stack_frames'] ?? 20;
        $trace = $exception->getTrace();

        return array_slice(array_map(function ($frame) {
            $result = [
                'file' => $frame['file'] ?? 'unknown',
                'line' => $frame['line'] ?? 0,
                'function' => $frame['function'] ?? 'unknown',
            ];

            if (isset($frame['class'])) {
                $result['class'] = $frame['class'];
                $result['type'] = $frame['type'] ?? '::';
            }

            // Add arguments if configured (be careful with large args)
            if (($this->config['log_arguments'] ?? false) && isset($frame['args'])) {
                $result['args'] = $this->formatArguments($frame['args']);
            }

            return $result;
        }, $trace), 0, $maxFrames);
    }

    /**
     * Format previous exception
     */
    protected function formatPreviousException(\Throwable $exception): array
    {
        $data = [
            'class' => get_class($exception),
            'message' => $exception->getMessage(),
            'code' => $exception->getCode(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
        ];

        // Recursively add previous (with depth limit)
        if ($exception->getPrevious() && ($this->config['max_previous_depth'] ?? 3) > 1) {
            $data['previous'] = $this->formatPreviousExceptionLimited(
                $exception->getPrevious(),
                ($this->config['max_previous_depth'] ?? 3) - 1
            );
        }

        return $data;
    }

    /**
     * Format previous exception with depth limit
     */
    protected function formatPreviousExceptionLimited(\Throwable $exception, int $depth): array
    {
        $data = [
            'class' => get_class($exception),
            'message' => $exception->getMessage(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
        ];

        if ($depth > 0 && $exception->getPrevious()) {
            $data['previous'] = $this->formatPreviousExceptionLimited($exception->getPrevious(), $depth - 1);
        }

        return $data;
    }

    /**
     * Format function arguments
     */
    protected function formatArguments(array $args): array
    {
        $maxSize = 100;

        return array_map(function ($arg) use ($maxSize) {
            if (is_object($arg)) {
                return get_class($arg);
            }
            if (is_array($arg)) {
                return '[array:' . count($arg) . ']';
            }
            if (is_string($arg)) {
                return strlen($arg) > $maxSize ? substr($arg, 0, $maxSize) . '...' : $arg;
            }
            if (is_bool($arg)) {
                return $arg ? 'true' : 'false';
            }
            if (is_null($arg)) {
                return 'null';
            }

            return (string) $arg;
        }, $args);
    }

    /**
     * Get exception severity
     */
    protected function getSeverity(\Throwable $exception): string
    {
        // Map common exceptions to severity levels
        $criticalExceptions = $this->config['critical_exceptions'] ?? [
            \Error::class,
            \ParseError::class,
            \TypeError::class,
        ];

        foreach ($criticalExceptions as $criticalClass) {
            if ($exception instanceof $criticalClass) {
                return 'critical';
            }
        }

        $warningExceptions = $this->config['warning_exceptions'] ?? [
            \Illuminate\Validation\ValidationException::class,
            \Illuminate\Auth\AuthenticationException::class,
        ];

        foreach ($warningExceptions as $warningClass) {
            if ($exception instanceof $warningClass) {
                return 'warning';
            }
        }

        return 'error';
    }

    /**
     * Sanitize label value for Loki
     */
    protected function sanitizeLabel(string $value): string
    {
        return preg_replace('/[^a-zA-Z0-9_-]/', '_', $value);
    }
}
