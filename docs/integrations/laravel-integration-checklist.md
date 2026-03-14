# Laravel Observatory SDK - Integration Checklist

## Prerequisites

| # | Item | Verify |
|---|------|--------|
| 1 | PHP >= 8.0 | `php -v` |
| 2 | Laravel 9.x / 10.x / 11.x / 12.x | `php artisan --version` |
| 3 | Composer installed | `composer -V` |
| 4 | SidMonitor backend running | Access `http://<backend-host>:<port>/docs` |
| 5 | API Key from SidMonitor dashboard | Settings > API Keys > Create New Key |

---

## Step 1: Install Package

```bash
composer require junixlabs/laravel-observatory
```

> Package auto-discovers `ObservatoryServiceProvider` via Laravel's package discovery. No manual provider registration needed.

## Step 2: Publish Configuration

```bash
php artisan vendor:publish --tag=observatory-config
```

Creates `config/observatory.php` with all available options.

## Step 3: Configure .env

### Required

```env
# Enable Observatory monitoring
OBSERVATORY_ENABLED=true

# Use SidMonitor exporter (push-based)
OBSERVATORY_EXPORTER=sidmonitor

# SidMonitor backend endpoint
SIDMONITOR_ENDPOINT=http://your-sidmonitor-host:8000

# API Key from SidMonitor dashboard (Settings > API Keys)
SIDMONITOR_API_KEY=smk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Optional - Batch & Performance

```env
# Buffer size before auto-flush (default: 100)
SIDMONITOR_BATCH_SIZE=100

# Max seconds between flushes (default: 10)
SIDMONITOR_BATCH_INTERVAL=10

# HTTP timeout per flush request (default: 5s)
SIDMONITOR_TIMEOUT=5

# Max buffer size to prevent memory issues (default: 1000)
SIDMONITOR_MAX_BUFFER_SIZE=1000
```

### Optional - Circuit Breaker

```env
# Stop sending after N consecutive failures (default: 3)
SIDMONITOR_CIRCUIT_BREAKER_THRESHOLD=3

# Wait N seconds before retrying (default: 30)
SIDMONITOR_CIRCUIT_BREAKER_COOLDOWN=30
```

### Optional - Feature Toggles

```env
# All enabled by default
OBSERVATORY_INBOUND_ENABLED=true
OBSERVATORY_OUTBOUND_ENABLED=true
OBSERVATORY_JOBS_ENABLED=true
OBSERVATORY_SCHEDULED_TASKS_ENABLED=true
OBSERVATORY_EXCEPTIONS_ENABLED=true
```

### Optional - Fine-tuning

```env
# Only log slow requests/jobs (0 = log all)
OBSERVATORY_SLOW_THRESHOLD_MS=0
OBSERVATORY_OUTBOUND_SLOW_THRESHOLD_MS=0
OBSERVATORY_JOB_SLOW_THRESHOLD_MS=0
OBSERVATORY_TASK_SLOW_THRESHOLD_MS=0

# Log request/response bodies (disabled by default - can be large)
OBSERVATORY_LOG_BODY=false
OBSERVATORY_OUTBOUND_LOG_BODY=false
OBSERVATORY_JOB_LOG_PAYLOAD=false
OBSERVATORY_TASK_LOG_OUTPUT=false
```

## Step 4: Verify Connection

```bash
php artisan tinker
```

```php
$exporter = app(\JunixLabs\Observatory\Contracts\ExporterInterface::class);
echo $exporter->getOutput();
```

Expected output:
```json
{
  "exporter": "sidmonitor",
  "endpoint": "http://your-host:8000",
  "buffer": {
    "inbound": 0,
    "outbound": 0,
    "jobs": 0,
    "scheduled_tasks": 0
  },
  "circuit_breaker": {
    "consecutive_failures": 0,
    "is_open": false
  }
}
```

Key things to verify:
- `exporter` = `"sidmonitor"` (not `"prometheus"`)
- `endpoint` = your backend URL
- `circuit_breaker.is_open` = `false`
- `circuit_breaker.consecutive_failures` = `0`

## Step 5: Test Data Flow

| Test | How | Expected Result |
|------|-----|-----------------|
| **Inbound** | Hit any route in your app | Data appears in SidMonitor Dashboard > Inbound APIs |
| **Outbound** | Use `Http::get(...)` in your code | Data appears in Outbound APIs |
| **Jobs** | Dispatch any queued job | Data appears in Jobs |
| **Scheduled Tasks** | Run `php artisan schedule:run` | Data appears in Scheduler |
| **Exceptions** | Trigger an unhandled exception | Error count increases in Dashboard |
| **Flush** | Send several requests, then check dashboard | Data appears within batch interval (default 10s) |

---

## What Gets Monitored Automatically

| Feature | Auto? | Notes |
|---------|-------|-------|
| Inbound HTTP requests | Yes | Via `ObserveRequests` middleware (auto-registered) |
| Outbound HTTP (Http facade) | Yes | Laravel 10.14+: Guzzle `globalMiddleware`. Laravel 9-10.13: HTTP client events fallback |
| Queue jobs | Yes | Via Laravel queue events (`JobProcessing`, `JobProcessed`, `JobFailed`) |
| Scheduled tasks | Yes | Via scheduler events (available since Laravel 6.x) |
| Exceptions | Yes | Wraps Laravel's exception handler |
| Data flush on shutdown | Yes | Via `app->terminating()` hook |

---

## Configuration Reference (`config/observatory.php`)

### Exclude Paths & Hosts

```php
'inbound' => [
    'exclude_paths' => [
        'telescope*',
        'horizon*',
        '_debugbar*',
        'health',
        'metrics',
        'favicon.ico',
    ],
],

'outbound' => [
    'exclude_hosts' => [
        'localhost',
        '127.0.0.1',
        // Add your SidMonitor backend host here if needed
    ],
],

'jobs' => [
    'exclude_jobs' => [
        // 'App\Jobs\SomeInternalJob',
    ],
],

'scheduled_tasks' => [
    'exclude_commands' => [
        // 'schedule:run',
    ],
],
```

### Service Name Detection (Outbound)

Maps outbound request hostnames to friendly service names in the dashboard:

```php
'outbound' => [
    'services' => [
        '*.stripe.com'    => 'stripe',
        '*.amazonaws.com' => 'aws',
        '*.sendgrid.com'  => 'sendgrid',
        '*.twilio.com'    => 'twilio',
        '*.slack.com'     => 'slack',
        '*.sentry.io'     => 'sentry',
        // Add your services here
    ],
],
```

### Sensitive Data Masking

Automatic masking applied to logged data:

```php
'inbound' => [
    'exclude_headers' => [
        'authorization', 'cookie', 'set-cookie',
        'x-api-key', 'x-csrf-token',
    ],
    'mask_fields' => [
        'password', 'password_confirmation',
        'token', 'secret', 'api_key',
        'credit_card', 'cvv',
    ],
],
```

### Request ID Tracking

Automatically generates and propagates request IDs:

```php
'request_id' => [
    'enabled' => true,
    'header'  => 'X-Request-Id',  // Header name for request/response
],
```

---

## Docker Configuration

When running in Docker, the endpoint should use the Docker service name:

```env
# Docker Compose network
SIDMONITOR_ENDPOINT=http://backend:8000

# Also exclude the backend host from outbound monitoring
# In config/observatory.php:
# 'outbound' => ['exclude_hosts' => ['localhost', '127.0.0.1', 'backend']]
```

---

## Troubleshooting

| Symptom | Diagnosis |
|---------|-----------|
| No data on dashboard | 1. `OBSERVATORY_ENABLED=true`? 2. `OBSERVATORY_EXPORTER=sidmonitor`? 3. Correct `SIDMONITOR_API_KEY`? 4. Backend reachable from app? |
| Circuit breaker open | Backend unreachable 3+ times. Check `SIDMONITOR_ENDPOINT`. Wait for cooldown (default 30s) or restart app |
| Outbound not captured | Host in `exclude_hosts`? Using `Http::` facade? Direct Guzzle calls need `Http::withObservatory()` |
| Scheduled tasks not captured | Check `OBSERVATORY_SCHEDULED_TASKS_ENABLED=true`. Run `php artisan schedule:run` |
| Buffer never empties | Check circuit breaker via `$exporter->getOutput()`. May indicate backend connectivity issue |
| App performance degraded | Increase `SIDMONITOR_BATCH_SIZE`, reduce `SIDMONITOR_TIMEOUT`, or set `SIDMONITOR_CIRCUIT_BREAKER_THRESHOLD=1` for faster failover |
| SDK crashes app | Should never happen — all Observatory code is wrapped in try-catch. Check `storage/logs/observatory.log` |
| `php artisan config:clear` needed | After changing `.env` values, clear config cache: `php artisan config:clear` |

---

## Verification Commands

### Check ClickHouse Data (if you have direct access)

```bash
CLICKHOUSE_URL="http://localhost:8123"
DB="sid_monitoring"

# Count records per table
curl -sf "$CLICKHOUSE_URL/?query=SELECT+count()+FROM+${DB}.logs+FORMAT+TabSeparated"
curl -sf "$CLICKHOUSE_URL/?query=SELECT+count()+FROM+${DB}.outbound_logs+FORMAT+TabSeparated"
curl -sf "$CLICKHOUSE_URL/?query=SELECT+count()+FROM+${DB}.job_logs+FORMAT+TabSeparated"
curl -sf "$CLICKHOUSE_URL/?query=SELECT+count()+FROM+${DB}.scheduled_task_logs+FORMAT+TabSeparated"
```

### Force Flush Buffer (from Laravel app)

```php
// In tinker or a test route
$exporter = app(\JunixLabs\Observatory\Contracts\ExporterInterface::class);
$exporter->flush();
echo $exporter->getOutput(); // Buffer should be 0 after flush
```
