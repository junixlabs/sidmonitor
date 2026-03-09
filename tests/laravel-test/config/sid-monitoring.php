<?php

return [
    /*
    |--------------------------------------------------------------------------
    | SidStack Monitoring DSN
    |--------------------------------------------------------------------------
    |
    | The DSN (Data Source Name) for your SidStack monitoring endpoint.
    | Format: https://<api-key>@<host>/api/ingest
    | Example: https://sk_abc123@monitoring.example.com/api/ingest
    |
    */
    'dsn' => env('SID_MONITORING_DSN'),

    /*
    |--------------------------------------------------------------------------
    | Enable Monitoring
    |--------------------------------------------------------------------------
    |
    | Enable or disable monitoring. When disabled, no logs will be sent.
    |
    */
    'enabled' => env('SID_MONITORING_ENABLED', true),

    /*
    |--------------------------------------------------------------------------
    | Transport Driver
    |--------------------------------------------------------------------------
    |
    | The transport driver to use for sending logs.
    | Supported: "sync", "queue"
    |
    | - sync: Send logs immediately (synchronous)
    | - queue: Queue logs for background processing (recommended for production)
    |
    */
    'transport' => env('SID_MONITORING_TRANSPORT', 'sync'),

    /*
    |--------------------------------------------------------------------------
    | Queue Configuration
    |--------------------------------------------------------------------------
    |
    | Configure the queue settings when using the "queue" transport.
    |
    */
    'queue' => [
        'connection' => env('SID_MONITORING_QUEUE_CONNECTION', null),
        'name' => env('SID_MONITORING_QUEUE_NAME', 'default'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Batch Settings
    |--------------------------------------------------------------------------
    |
    | Configure batching behavior for log entries.
    |
    */
    'batch' => [
        // Maximum number of logs to batch before sending
        'size' => env('SID_MONITORING_BATCH_SIZE', 50),

        // Maximum time in seconds to wait before flushing the batch
        'flush_interval' => env('SID_MONITORING_FLUSH_INTERVAL', 10),
    ],

    /*
    |--------------------------------------------------------------------------
    | HTTP Client Settings
    |--------------------------------------------------------------------------
    |
    | Configure the HTTP client used to send logs.
    |
    */
    'http' => [
        'timeout' => env('SID_MONITORING_HTTP_TIMEOUT', 5),
        'connect_timeout' => env('SID_MONITORING_HTTP_CONNECT_TIMEOUT', 2),
        'retry' => [
            'times' => env('SID_MONITORING_HTTP_RETRY_TIMES', 3),
            'sleep' => env('SID_MONITORING_HTTP_RETRY_SLEEP', 100),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Sensitive Fields
    |--------------------------------------------------------------------------
    |
    | Fields that should be redacted from request/response bodies.
    | Values will be replaced with "[REDACTED]".
    |
    */
    'sensitive_fields' => [
        'password',
        'password_confirmation',
        'current_password',
        'new_password',
        'token',
        'api_key',
        'api_secret',
        'secret',
        'authorization',
        'credit_card',
        'card_number',
        'cvv',
        'ssn',
        'social_security',
    ],

    /*
    |--------------------------------------------------------------------------
    | Excluded Paths
    |--------------------------------------------------------------------------
    |
    | Paths that should not be monitored. Supports wildcards (*).
    |
    */
    'excluded_paths' => [
        '_debugbar/*',
        'telescope/*',
        'horizon/*',
        'health',
        'health/*',
        'favicon.ico',
    ],

    /*
    |--------------------------------------------------------------------------
    | Excluded Status Codes
    |--------------------------------------------------------------------------
    |
    | HTTP status codes that should not be logged.
    |
    */
    'excluded_status_codes' => [
        // Uncomment to exclude successful responses
        // 200, 201, 204,
    ],

    /*
    |--------------------------------------------------------------------------
    | Body Capture
    |--------------------------------------------------------------------------
    |
    | Configure request/response body capture settings.
    |
    */
    'body' => [
        // Capture request body
        'capture_request' => env('SID_MONITORING_CAPTURE_REQUEST_BODY', false),

        // Capture response body
        'capture_response' => env('SID_MONITORING_CAPTURE_RESPONSE_BODY', false),

        // Maximum body size to capture (in bytes)
        'max_size' => env('SID_MONITORING_BODY_MAX_SIZE', 8192),

        // Content types to capture body for
        'content_types' => [
            'application/json',
            'application/x-www-form-urlencoded',
            'text/plain',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | User Resolver
    |--------------------------------------------------------------------------
    |
    | Closure or class to resolve the current user information.
    | Set to null to use the default Laravel auth resolver.
    |
    */
    'user_resolver' => null,

    /*
    |--------------------------------------------------------------------------
    | Module Resolver
    |--------------------------------------------------------------------------
    |
    | Closure or class to resolve the module name for a request.
    | Set to null to extract from route prefix.
    |
    */
    'module_resolver' => null,

    /*
    |--------------------------------------------------------------------------
    | Outbound Monitoring
    |--------------------------------------------------------------------------
    |
    | Configure outbound HTTP request monitoring (Guzzle).
    |
    */
    'outbound' => [
        // Enable outbound request monitoring
        'enabled' => env('SID_MONITORING_OUTBOUND_ENABLED', true),

        // Services to monitor (service name => URL pattern)
        // Use '*' to monitor all outbound requests
        'services' => [
            '*',  // Monitor all outbound requests
            'stripe' => 'api.stripe.com',
            'twilio' => 'api.twilio.com',
            'sendgrid' => 'api.sendgrid.com',
            'aws-s3' => 's3.*.amazonaws.com',
            'firebase' => 'fcm.googleapis.com',
            'jsonplaceholder' => 'jsonplaceholder.typicode.com',
            'httpbin' => 'httpbin.org',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Job Monitoring
    |--------------------------------------------------------------------------
    |
    | Configure queue job monitoring.
    |
    */
    'jobs' => [
        // Enable job monitoring
        'enabled' => env('SID_MONITORING_JOBS_ENABLED', true),

        // Queue names to monitor (empty array = monitor all)
        'queue_names' => [],

        // Job classes to ignore (fully qualified class names)
        'ignore_jobs' => [
            // 'App\Jobs\SendLogBatch', // Example: ignore our own log sending job
        ],

        // Capture job payload data
        'capture_payload' => env('SID_MONITORING_CAPTURE_JOB_PAYLOAD', false),

        // Maximum payload length to capture (in characters)
        'payload_max_length' => 1000,
    ],

    /*
    |--------------------------------------------------------------------------
    | Scheduler Monitoring
    |--------------------------------------------------------------------------
    |
    | Configure scheduled task monitoring.
    |
    */
    'scheduler' => [
        // Enable scheduler monitoring
        'enabled' => env('SID_MONITORING_SCHEDULER_ENABLED', true),

        // Capture command output
        'capture_output' => env('SID_MONITORING_CAPTURE_SCHEDULER_OUTPUT', true),

        // Maximum output length to capture (in characters)
        'output_max_length' => 2000,

        // Detect missed scheduled tasks
        'detect_missed_tasks' => true,

        // Threshold in minutes before a task is considered missed
        'missed_threshold_minutes' => 5,
    ],
];
