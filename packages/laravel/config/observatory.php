<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Observatory Enabled
    |--------------------------------------------------------------------------
    |
    | This option controls whether Observatory monitoring is enabled.
    |
    */
    'enabled' => env('OBSERVATORY_ENABLED', true),

    /*
    |--------------------------------------------------------------------------
    | Application Name
    |--------------------------------------------------------------------------
    |
    | This value is used to identify your application in metrics.
    |
    */
    'app_name' => env('OBSERVATORY_APP_NAME', env('APP_NAME', 'laravel')),

    /*
    |--------------------------------------------------------------------------
    | Exporter Configuration
    |--------------------------------------------------------------------------
    |
    | Configure which exporter to use: 'prometheus' or 'sidmonitor'
    | Prometheus is available now, SidMonitor coming soon.
    |
    */
    'exporter' => env('OBSERVATORY_EXPORTER', 'prometheus'),

    /*
    |--------------------------------------------------------------------------
    | Prometheus Configuration
    |--------------------------------------------------------------------------
    */
    'prometheus' => [
        // Metrics endpoint path
        'endpoint' => env('OBSERVATORY_PROMETHEUS_ENDPOINT', '/metrics'),

        // Storage adapter: 'memory', 'redis', 'apc', 'apcu'
        'storage' => env('OBSERVATORY_PROMETHEUS_STORAGE', 'memory'),

        // Redis connection (if using redis storage)
        'redis' => [
            'host' => env('OBSERVATORY_REDIS_HOST', '127.0.0.1'),
            'port' => env('OBSERVATORY_REDIS_PORT', 6379),
            'password' => env('OBSERVATORY_REDIS_PASSWORD', null),
            'database' => env('OBSERVATORY_REDIS_DATABASE', 0),
        ],

        // Histogram buckets for request duration (in seconds)
        'buckets' => [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],

        // Enable/disable basic auth for metrics endpoint
        'auth' => [
            'enabled' => env('OBSERVATORY_PROMETHEUS_AUTH_ENABLED', false),
            'username' => env('OBSERVATORY_PROMETHEUS_AUTH_USERNAME', 'prometheus'),
            'password' => env('OBSERVATORY_PROMETHEUS_AUTH_PASSWORD', ''),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | SidMonitor Configuration (Coming Soon)
    |--------------------------------------------------------------------------
    */
    'sidmonitor' => [
        'endpoint' => env('OBSERVATORY_SIDMONITOR_ENDPOINT', 'https://api.sidmonitor.com'),
        'api_key' => env('OBSERVATORY_SIDMONITOR_API_KEY', ''),
        'project_id' => env('OBSERVATORY_SIDMONITOR_PROJECT_ID', ''),

        // Batch settings for efficient data transmission
        'batch' => [
            'size' => env('OBSERVATORY_SIDMONITOR_BATCH_SIZE', 100),
            'interval' => env('OBSERVATORY_SIDMONITOR_BATCH_INTERVAL', 10), // seconds
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Inbound Request Monitoring
    |--------------------------------------------------------------------------
    */
    'inbound' => [
        'enabled' => env('OBSERVATORY_INBOUND_ENABLED', true),

        // Paths to exclude from monitoring (supports wildcards)
        'exclude_paths' => [
            'telescope*',
            'horizon*',
            '_debugbar*',
            'health',
            'metrics',
        ],

        // HTTP methods to monitor
        'methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],

        // Record request/response body (use with caution - can be large)
        'record_body' => env('OBSERVATORY_INBOUND_RECORD_BODY', false),

        // Maximum body size to record (in bytes)
        'max_body_size' => env('OBSERVATORY_INBOUND_MAX_BODY_SIZE', 64000),

        // Headers to exclude from recording (sensitive data)
        'exclude_headers' => [
            'authorization',
            'cookie',
            'x-api-key',
            'x-auth-token',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Outbound HTTP Monitoring
    |--------------------------------------------------------------------------
    */
    'outbound' => [
        'enabled' => env('OBSERVATORY_OUTBOUND_ENABLED', true),

        // Hosts to exclude from monitoring
        'exclude_hosts' => [
            'localhost',
            '127.0.0.1',
        ],

        // Record request/response body
        'record_body' => env('OBSERVATORY_OUTBOUND_RECORD_BODY', false),

        // Maximum body size to record (in bytes)
        'max_body_size' => env('OBSERVATORY_OUTBOUND_MAX_BODY_SIZE', 64000),
    ],

    /*
    |--------------------------------------------------------------------------
    | Queue Job Monitoring
    |--------------------------------------------------------------------------
    */
    'jobs' => [
        'enabled' => env('OBSERVATORY_JOBS_ENABLED', true),

        // Jobs to exclude from monitoring (class names)
        'exclude_jobs' => [
            // 'App\Jobs\SomeInternalJob',
        ],

        // Record job payload
        'record_payload' => env('OBSERVATORY_JOBS_RECORD_PAYLOAD', false),

        // Maximum payload size to record (in bytes)
        'max_payload_size' => env('OBSERVATORY_JOBS_MAX_PAYLOAD_SIZE', 64000),
    ],

    /*
    |--------------------------------------------------------------------------
    | Exception Tracking
    |--------------------------------------------------------------------------
    */
    'exceptions' => [
        'enabled' => env('OBSERVATORY_EXCEPTIONS_ENABLED', true),

        // Exception classes to ignore
        'ignore' => [
            Illuminate\Auth\AuthenticationException::class,
            Illuminate\Auth\Access\AuthorizationException::class,
            Symfony\Component\HttpKernel\Exception\NotFoundHttpException::class,
            Illuminate\Validation\ValidationException::class,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Custom Labels
    |--------------------------------------------------------------------------
    |
    | Add custom labels to all metrics. Useful for multi-tenant or
    | multi-environment setups.
    |
    */
    'labels' => [
        'environment' => env('APP_ENV', 'production'),
        // 'tenant' => 'default',
        // 'region' => 'us-east-1',
    ],
];
