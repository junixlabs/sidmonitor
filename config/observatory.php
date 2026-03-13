<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Observatory Enabled
    |--------------------------------------------------------------------------
    |
    | Enable/disable all Observatory monitoring.
    |
    */
    'enabled' => env('OBSERVATORY_ENABLED', true),

    /*
    |--------------------------------------------------------------------------
    | Application Name
    |--------------------------------------------------------------------------
    */
    'app_name' => env('APP_NAME', 'laravel'),

    /*
    |--------------------------------------------------------------------------
    | Metrics Exporter
    |--------------------------------------------------------------------------
    |
    | Choose the metrics exporter: 'prometheus' or 'sidmonitor'
    |
    */
    'exporter' => env('OBSERVATORY_EXPORTER', 'prometheus'),

    /*
    |--------------------------------------------------------------------------
    | Logging Configuration (Loki/Grafana)
    |--------------------------------------------------------------------------
    |
    | Observatory logs structured JSON to Laravel log channels.
    | Works with Loki, Elasticsearch, CloudWatch, or any log aggregator.
    |
    | Default: 'observatory' channel (auto-registered, writes to storage/logs/observatory.log)
    | For Docker/K8s: set to 'stderr' to output to container logs
    |
    */
    'log_channel' => env('OBSERVATORY_LOG_CHANNEL', 'observatory'),

    /*
    |--------------------------------------------------------------------------
    | Inbound HTTP Request Logging
    |--------------------------------------------------------------------------
    */
    'inbound' => [
        'enabled' => env('OBSERVATORY_INBOUND_ENABLED', true),

        // Paths to exclude (supports wildcards)
        'exclude_paths' => [
            'telescope*',
            'horizon*',
            '_debugbar*',
            'health',
            'metrics',
            'favicon.ico',
        ],

        // Log request/response body (disabled by default - can be large)
        'log_body' => env('OBSERVATORY_LOG_BODY', false),
        'max_body_size' => 64000,

        // Only log slow requests (0 = log all)
        'slow_threshold_ms' => env('OBSERVATORY_SLOW_THRESHOLD_MS', 0),

        // Headers to exclude from logs
        'exclude_headers' => [
            'authorization',
            'cookie',
            'set-cookie',
            'x-api-key',
            'x-csrf-token',
        ],

        // Fields to mask in body
        'mask_fields' => [
            'password',
            'password_confirmation',
            'token',
            'secret',
            'api_key',
            'credit_card',
            'cvv',
        ],

        // Custom headers to extract and include in logs
        // Format: 'Header-Name' => 'log_field_name'
        'custom_headers' => [
            // 'X-Workspace-Id' => 'workspace_id',
            // 'X-Tenant-Id' => 'tenant_id',
            // 'X-Correlation-Id' => 'correlation_id',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Outbound HTTP Request Logging
    |--------------------------------------------------------------------------
    */
    'outbound' => [
        'enabled' => env('OBSERVATORY_OUTBOUND_ENABLED', true),

        // Hosts to exclude
        'exclude_hosts' => [
            'localhost',
            '127.0.0.1',
        ],

        // Log request/response body
        'log_body' => env('OBSERVATORY_OUTBOUND_LOG_BODY', false),
        'max_body_size' => 64000,

        // Only log slow requests (0 = log all)
        'slow_threshold_ms' => env('OBSERVATORY_OUTBOUND_SLOW_THRESHOLD_MS', 0),

        // Service detection: map host patterns to service names
        'services' => [
            '*.stripe.com' => 'stripe',
            '*.amazonaws.com' => 'aws',
            '*.sendgrid.com' => 'sendgrid',
            '*.twilio.com' => 'twilio',
            '*.slack.com' => 'slack',
            '*.sentry.io' => 'sentry',
            // Add your services here
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Queue Job Logging
    |--------------------------------------------------------------------------
    */
    'jobs' => [
        'enabled' => env('OBSERVATORY_JOBS_ENABLED', true),

        // Jobs to exclude (class names)
        'exclude_jobs' => [
            // 'App\Jobs\SomeInternalJob',
        ],

        // Only log slow jobs (0 = log all)
        'slow_threshold_ms' => env('OBSERVATORY_JOB_SLOW_THRESHOLD_MS', 0),

        // Log job payload (disabled by default - can be large)
        'log_payload' => env('OBSERVATORY_JOB_LOG_PAYLOAD', false),
    ],

    /*
    |--------------------------------------------------------------------------
    | Exception Logging
    |--------------------------------------------------------------------------
    */
    'exceptions' => [
        'enabled' => env('OBSERVATORY_EXCEPTIONS_ENABLED', true),

        // Exceptions to ignore
        'ignore' => [
            Illuminate\Auth\AuthenticationException::class,
            Illuminate\Auth\Access\AuthorizationException::class,
            Symfony\Component\HttpKernel\Exception\NotFoundHttpException::class,
            Illuminate\Validation\ValidationException::class,
        ],

        // Include stack trace
        'log_stack_trace' => true,
        'max_stack_frames' => 20,
    ],

    /*
    |--------------------------------------------------------------------------
    | Request ID Tracking
    |--------------------------------------------------------------------------
    */
    'request_id' => [
        'enabled' => true,
        'header' => 'X-Request-Id',
    ],

    /*
    |--------------------------------------------------------------------------
    | Prometheus Metrics (Optional)
    |--------------------------------------------------------------------------
    |
    | Enable Prometheus metrics endpoint at /metrics.
    | Requires APCu or Redis for storage.
    |
    | To enable: OBSERVATORY_PROMETHEUS_ENABLED=true
    |
    */
    'prometheus' => [
        'enabled' => env('OBSERVATORY_PROMETHEUS_ENABLED', false),
        'endpoint' => '/metrics',

        // Storage: 'apcu' (recommended), 'redis', or 'memory'
        'storage' => env('OBSERVATORY_PROMETHEUS_STORAGE', 'apcu'),

        // Redis config (only if storage = redis)
        'redis' => [
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'port' => env('REDIS_PORT', 6379),
            'password' => env('REDIS_PASSWORD'),
            'database' => env('OBSERVATORY_REDIS_DB', 1),
        ],

        // Histogram buckets for duration (seconds)
        'buckets' => [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],

        // Basic auth for metrics endpoint
        'auth' => [
            'enabled' => env('OBSERVATORY_METRICS_AUTH', false),
            'username' => env('OBSERVATORY_METRICS_USER', 'prometheus'),
            'password' => env('OBSERVATORY_METRICS_PASS', ''),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Global Labels
    |--------------------------------------------------------------------------
    |
    | Added to all logs and metrics.
    |
    */
    'labels' => [
        'environment' => env('APP_ENV', 'production'),
    ],
];
