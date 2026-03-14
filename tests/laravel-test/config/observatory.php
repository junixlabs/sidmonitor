<?php

/**
 * Observatory config for the test Laravel app.
 *
 * This is published from the junixlabs/laravel-observatory package
 * with test-specific overrides for smaller batch sizes and sync transport.
 */
return [
    'enabled' => env('OBSERVATORY_ENABLED', true),

    'app_name' => env('APP_NAME', 'laravel-test'),

    'exporter' => env('OBSERVATORY_EXPORTER', 'sidmonitor'),

    'sidmonitor' => [
        'endpoint' => env('SIDMONITOR_ENDPOINT', 'http://localhost:8030'),
        'api_key' => env('SIDMONITOR_API_KEY', ''),
        'timeout' => env('SIDMONITOR_TIMEOUT', 5),

        'batch' => [
            'size' => env('SIDMONITOR_BATCH_SIZE', 10),
            'interval' => env('SIDMONITOR_BATCH_INTERVAL', 5),
            'max_buffer_size' => env('SIDMONITOR_MAX_BUFFER_SIZE', 1000),
        ],
    ],

    'circuit_breaker' => [
        'threshold' => env('SIDMONITOR_CIRCUIT_BREAKER_THRESHOLD', 3),
        'cooldown' => env('SIDMONITOR_CIRCUIT_BREAKER_COOLDOWN', 30),
    ],

    'log_channel' => env('OBSERVATORY_LOG_CHANNEL', 'observatory'),

    'inbound' => [
        'enabled' => env('OBSERVATORY_INBOUND_ENABLED', true),
        'exclude_paths' => [
            'telescope*',
            'horizon*',
            '_debugbar*',
            'health',
            'up',
            'favicon.ico',
        ],
        'log_body' => env('OBSERVATORY_LOG_BODY', false),
        'record_body' => env('OBSERVATORY_RECORD_BODY', false),
        'max_body_size' => 64000,
        'slow_threshold_ms' => env('OBSERVATORY_SLOW_THRESHOLD_MS', 0),
        'exclude_headers' => [
            'authorization',
            'cookie',
            'set-cookie',
            'x-api-key',
        ],
        'mask_fields' => [
            'password',
            'password_confirmation',
            'token',
            'secret',
            'api_key',
        ],
        'custom_headers' => [],
    ],

    'outbound' => [
        'enabled' => env('OBSERVATORY_OUTBOUND_ENABLED', true),
        'exclude_hosts' => [
            'localhost',
            '127.0.0.1',
        ],
        'log_body' => false,
        'record_body' => false,
        'max_body_size' => 64000,
        'slow_threshold_ms' => 0,
        'services' => [
            '*.stripe.com' => 'stripe',
            '*.amazonaws.com' => 'aws',
            'jsonplaceholder.typicode.com' => 'jsonplaceholder',
            'httpbin.org' => 'httpbin',
        ],
    ],

    'jobs' => [
        'enabled' => env('OBSERVATORY_JOBS_ENABLED', true),
        'exclude_jobs' => [],
        'slow_threshold_ms' => 0,
        'log_payload' => false,
        'record_payload' => false,
    ],

    'scheduled_tasks' => [
        'enabled' => env('OBSERVATORY_SCHEDULED_TASKS_ENABLED', true),
        'exclude_commands' => [],
        'slow_threshold_ms' => 0,
        'log_output' => true,
        'max_output_size' => 4096,
    ],

    'exceptions' => [
        'enabled' => env('OBSERVATORY_EXCEPTIONS_ENABLED', true),
        'ignore' => [
            Illuminate\Auth\AuthenticationException::class,
            Illuminate\Auth\Access\AuthorizationException::class,
            Symfony\Component\HttpKernel\Exception\NotFoundHttpException::class,
            Illuminate\Validation\ValidationException::class,
        ],
        'log_stack_trace' => true,
        'max_stack_frames' => 20,
    ],

    'request_id' => [
        'enabled' => true,
        'header' => 'X-Request-Id',
    ],

    'prometheus' => [
        'enabled' => false,
    ],

    'labels' => [
        'environment' => env('APP_ENV', 'testing'),
    ],
];
