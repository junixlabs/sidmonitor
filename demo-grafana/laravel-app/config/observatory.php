<?php

return [
    'enabled' => env('OBSERVATORY_ENABLED', true),
    'app_name' => env('OBSERVATORY_APP_NAME', 'laravel'),

    'exporters' => [
        'prometheus' => [
            'enabled' => true,
            'namespace' => env('OBSERVATORY_PROMETHEUS_NAMESPACE', 'app'),
            'storage' => env('OBSERVATORY_PROMETHEUS_STORAGE', 'apcu'),
        ],
        'sidmonitor' => [
            'enabled' => false,
        ],
    ],

    'collectors' => [
        'inbound' => [
            'enabled' => true,
            'excluded_paths' => [
                'metrics',
                'health',
                '_debugbar/*',
                'telescope/*',
            ],
            'buckets' => [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        ],
        'outbound' => [
            'enabled' => true,
            'excluded_hosts' => [],
            'buckets' => [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
        ],
        'jobs' => [
            'enabled' => true,
            'excluded_jobs' => [],
            'buckets' => [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300],
        ],
        'exceptions' => [
            'enabled' => true,
        ],
    ],

    'routes' => [
        'metrics' => [
            'enabled' => true,
            'path' => '/metrics',
            'middleware' => [],
        ],
    ],
];
