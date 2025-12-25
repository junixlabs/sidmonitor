# Laravel Observatory

[![Latest Version on Packagist](https://img.shields.io/packagist/v/junixlabs/laravel-observatory.svg?style=flat-square)](https://packagist.org/packages/junixlabs/laravel-observatory)
[![Total Downloads](https://img.shields.io/packagist/dt/junixlabs/laravel-observatory.svg?style=flat-square)](https://packagist.org/packages/junixlabs/laravel-observatory)
[![License](https://img.shields.io/packagist/l/junixlabs/laravel-observatory.svg?style=flat-square)](https://packagist.org/packages/junixlabs/laravel-observatory)

A comprehensive observability toolkit for Laravel applications. Monitor HTTP requests, outbound API calls, queue jobs, and exceptions with Prometheus metrics export.

## Features

- **Inbound Request Monitoring** - Automatically track all incoming HTTP requests
- **Outbound HTTP Monitoring** - Monitor all HTTP client calls to external services
- **Queue Job Monitoring** - Track job execution, duration, and failures
- **Exception Tracking** - Capture and count application exceptions
- **Prometheus Export** - Native Prometheus metrics format with `/metrics` endpoint
- **SidMonitor Integration** - (Coming Soon) Advanced monitoring with SidMonitor platform
- **Custom Metrics** - Add your own counters, gauges, and histograms
- **Zero Configuration** - Works out of the box with sensible defaults

## Requirements

- PHP 8.1+
- Laravel 10.0+ or 11.0+

## Installation

```bash
composer require junixlabs/laravel-observatory
```

The package will auto-register its service provider.

### Publish Configuration (Optional)

```bash
php artisan vendor:publish --tag=observatory-config
```

## Quick Start

After installation, Observatory automatically:
1. Monitors all incoming HTTP requests
2. Tracks outbound HTTP calls via Laravel's HTTP client
3. Monitors queue job execution
4. Exposes metrics at `/metrics` endpoint

Visit `http://your-app.test/metrics` to see your Prometheus metrics!

## Configuration

### Basic Configuration

```env
# Enable/disable Observatory
OBSERVATORY_ENABLED=true

# Your application name (used in metrics)
OBSERVATORY_APP_NAME=my-app

# Exporter: 'prometheus' or 'sidmonitor'
OBSERVATORY_EXPORTER=prometheus
```

### Prometheus Configuration

```env
# Metrics endpoint path
OBSERVATORY_PROMETHEUS_ENDPOINT=/metrics

# Storage: 'memory', 'redis', 'apc', 'apcu'
OBSERVATORY_PROMETHEUS_STORAGE=memory

# Redis configuration (if using redis storage)
OBSERVATORY_REDIS_HOST=127.0.0.1
OBSERVATORY_REDIS_PORT=6379

# Enable basic auth for metrics endpoint
OBSERVATORY_PROMETHEUS_AUTH_ENABLED=false
OBSERVATORY_PROMETHEUS_AUTH_USERNAME=prometheus
OBSERVATORY_PROMETHEUS_AUTH_PASSWORD=secret
```

### Feature Toggles

```env
# Inbound request monitoring
OBSERVATORY_INBOUND_ENABLED=true

# Outbound HTTP monitoring
OBSERVATORY_OUTBOUND_ENABLED=true

# Queue job monitoring
OBSERVATORY_JOBS_ENABLED=true

# Exception tracking
OBSERVATORY_EXCEPTIONS_ENABLED=true
```

## Prometheus Metrics

### Available Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `{app}_http_requests_total` | Counter | Total HTTP requests by method, route, status |
| `{app}_http_request_duration_seconds` | Histogram | Request latency distribution |
| `{app}_http_outbound_requests_total` | Counter | Outbound HTTP requests by method, host, status |
| `{app}_http_outbound_duration_seconds` | Histogram | Outbound request latency |
| `{app}_jobs_processed_total` | Counter | Queue jobs by name, queue, status |
| `{app}_jobs_duration_seconds` | Histogram | Job execution duration |
| `{app}_exceptions_total` | Counter | Exceptions by class and file |

### Prometheus Configuration

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'laravel'
    static_configs:
      - targets: ['your-app.test:80']
    metrics_path: '/metrics'
    # If using basic auth:
    # basic_auth:
    #   username: 'prometheus'
    #   password: 'secret'
```

## Custom Metrics

Use the `Observatory` facade to add custom metrics:

```php
use JunixLabs\Observatory\Facades\Observatory;

// Increment a counter
Observatory::increment('api_calls', ['endpoint' => 'users']);

// Set a gauge value
Observatory::gauge('active_connections', 42, ['server' => 'web-1']);

// Record a histogram observation
Observatory::histogram('payment_amount', 99.99, ['currency' => 'USD']);
```

## Excluding Paths and Jobs

### Exclude Paths from Monitoring

In `config/observatory.php`:

```php
'inbound' => [
    'exclude_paths' => [
        'telescope*',
        'horizon*',
        '_debugbar*',
        'health',
        'metrics',
        'api/internal/*',
    ],
],
```

### Exclude Jobs from Monitoring

```php
'jobs' => [
    'exclude_jobs' => [
        'App\Jobs\InternalHealthCheck',
        'App\Jobs\MetricsCollection',
    ],
],
```

### Exclude Hosts from Outbound Monitoring

```php
'outbound' => [
    'exclude_hosts' => [
        'localhost',
        '127.0.0.1',
        'internal-service.local',
    ],
],
```

## Storage Adapters

For production environments with multiple workers, use persistent storage:

### Redis Storage (Recommended)

```env
OBSERVATORY_PROMETHEUS_STORAGE=redis
OBSERVATORY_REDIS_HOST=127.0.0.1
OBSERVATORY_REDIS_PORT=6379
```

### APCu Storage

```env
OBSERVATORY_PROMETHEUS_STORAGE=apcu
```

## SidMonitor Integration (Coming Soon)

SidMonitor provides advanced monitoring features beyond Prometheus:

- Real-time log streaming
- Distributed tracing
- Alerting and notifications
- Custom dashboards
- Rich contextual data

```env
OBSERVATORY_EXPORTER=sidmonitor
OBSERVATORY_SIDMONITOR_ENDPOINT=https://api.sidmonitor.com
OBSERVATORY_SIDMONITOR_API_KEY=your-api-key
OBSERVATORY_SIDMONITOR_PROJECT_ID=your-project-id
```

## Testing

```bash
composer test
```

## Changelog

Please see [CHANGELOG](CHANGELOG.md) for more information on what has changed recently.

## Contributing

Please see [CONTRIBUTING](CONTRIBUTING.md) for details.

## Security

If you discover any security-related issues, please email dev@junixlabs.com instead of using the issue tracker.

## Credits

- [JunixLabs](https://github.com/junixlabs)
- [All Contributors](../../contributors)

## License

The MIT License (MIT). Please see [License File](LICENSE) for more information.
