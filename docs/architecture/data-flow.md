# SidMonitor Data Flow Architecture

## Overview

SidMonitor is a **push-based** APM platform. Laravel/Python apps actively send telemetry data to the backend via HTTP. SidMonitor does not pull or scrape data from applications.

```
Laravel App (SDK)  ──push──►  FastAPI Backend  ──insert──►  ClickHouse
                                    │
                              PostgreSQL (metadata: users, orgs, projects)
                                    │
                              React Frontend (query via REST API)
```

---

## 1. Data Sources

### Laravel Observatory SDK (`junixlabs/laravel-observatory`)

The primary SDK. Auto-captures 4 types of telemetry:

| Type | Capture mechanism | Key files |
|---|---|---|
| Inbound HTTP | `ObserveRequests` middleware | `Collectors/InboundCollector.php`, `Loggers/InboundRequestLogger.php` |
| Outbound HTTP | Guzzle middleware (auto or `Http::withObservatory()`) | `Collectors/OutboundCollector.php`, `Loggers/OutboundRequestLogger.php` |
| Queue Jobs | Laravel event listeners (`JobProcessing/Processed/Failed`) | `Collectors/JobCollector.php`, `Loggers/JobLogger.php` |
| Exceptions | Exception handler wrapper | `Loggers/ExceptionLogger.php` |

### Other sources

- **Python SDK** (`packages/python/`) — early stage
- **Any HTTP client** — can POST directly to ingest endpoints with `X-API-Key`

---

## 2. Ingest Flow (SDK → Backend → ClickHouse)

### 2.1 Inbound HTTP Request

```
User Request hits Laravel App
    │
    ▼
┌─ RequestIdMiddleware ─────────────────────────────────┐
│  Extract X-Request-Id header or generate UUID          │
│  Store in $request->attributes['request_id']           │
│  Add to Log::withContext()                              │
└────────────────────────────────────────────────────────┘
    │
    ▼
┌─ ObserveRequests middleware ──────────────────────────┐
│  1. collector->start()    → record microtime + memory  │
│  2. logger->start()       → record microtime + memory  │
│                                                        │
│  3. ════ $next($request) ════════════════════          │
│     (controller / business logic runs here)            │
│                                                        │
│  4. collector->end()                                   │
│     → Build data array (12 fields)                     │
│     → exporter->recordInbound($data)                   │
│       └─► Push into inboundBuffer[] (in-memory)        │
│       └─► autoFlushIfNeeded()                          │
│                                                        │
│  5. logger->log()                                      │
│     → Build log data (15+ fields)                      │
│     → Mask sensitive data                              │
│     → Log::channel('observatory')->info()              │
└────────────────────────────────────────────────────────┘
    │
    ▼
Response returned to user
```

**Data fields sent to SidMonitor:**
```
request_id, timestamp, endpoint, method, status_code, response_time_ms,
user_id, user_name, module (route name), tags, request_body*, response_body*
```
*Only when `record_body` is enabled.

### 2.2 Outbound HTTP Request

```
Laravel code calls Http::get('https://stripe.com/...')
    │
    ▼
┌─ Guzzle Middleware (OutboundCollector) ───────────────┐
│  1. Record startTime = microtime(true)                 │
│                                                        │
│  2. ════ $handler($request, $options) ════════        │
│     (actual HTTP call to third-party)                  │
│                                                        │
│  3. Promise ->then() on success:                       │
│     → record() → build data → push to outboundBuffer  │
│     → logger->log() → write to disk                   │
│                                                        │
│  4. Promise ->otherwise() on failure:                  │
│     → recordError() → push to outboundBuffer           │
│     → logger->log() with error                         │
│     → re-throw exception                               │
└────────────────────────────────────────────────────────┘
```

**Data fields sent to SidMonitor:**
```
request_id, timestamp, endpoint (full URL), method, status_code,
response_time_ms, third_party_service (auto-detected from host),
user_id, user_name, tags, request_body*, response_body*
```

### 2.3 Queue Job

```
Queue Worker picks up job
    │
    ▼
┌─ Event: JobProcessing ──────────────────────────────┐
│  collector->start($job)                               │
│  → jobStartTimes[$jobId] = microtime(true)            │
│  → logger->start($job)                                │
└───────────────────────────────────────────────────────┘
    │
    ▼
    ════ Job handle() runs ════════════════════
    │
    ▼
┌─ Event: JobProcessed / JobFailed ────────────────────┐
│  collector->end($job, $status, $exception)            │
│  → Calculate duration                                  │
│  → Build data array                                    │
│  → exporter->recordJob($data) → push to jobBuffer     │
│  → logger->log() → write to disk                      │
└───────────────────────────────────────────────────────┘
```

**Data fields sent to SidMonitor:**
```
job_id, job_uuid, job_class, job_name, queue_name, connection,
status (completed/failed), started_at, completed_at, duration_ms,
attempt_number, max_attempts, user_id, memory_usage_mb,
payload*, exception_class*, exception_message*, exception_trace*
```

### 2.4 Scheduled Tasks

> **Not yet implemented.** Backend schema and endpoints exist, but there is no
> `ScheduledTaskCollector` in the Laravel SDK. The exporter always sends
> `scheduled_task_logs: []`.

---

## 3. Buffer & Batch Transport

The `SidMonitorExporter` buffers data in-memory and flushes in batches:

```
recordInbound()  ──►  inboundBuffer[]  ─┐
recordOutbound() ──►  outboundBuffer[] ──┤──► autoFlushIfNeeded()
recordJob()      ──►  jobBuffer[]      ─┘        │
                                                  │
                              ┌────────────────────┤
                              │                    │
                    Condition 1:             Condition 2:
                    total buffer >=          time() - lastFlush >=
                    batchSize (100)          interval (10s)
                              │                    │
                              └────────┬───────────┘
                                       │
                                       ▼
                                    flush()
                                       │
                         ┌─────────────┴─────────────┐
                         ▼                           ▼
                   flushLogs()                 flushJobs()
                         │                           │
                         ▼                           ▼
            POST /api/ingest/batch       POST /api/ingest/jobs/batch
            {                            {
              inbound_logs: [...],          job_logs: [...],
              outbound_logs: [...]          scheduled_task_logs: []
            }                            }
            Headers: X-API-Key           Headers: X-API-Key
            Timeout: 5s                  Timeout: 5s
```

**Important behaviors:**
- Buffers are cleared after flush regardless of success or failure
- No retry mechanism — if flush fails, data is lost
- No `register_shutdown_function` — if process dies, buffered data is lost
- Time-based flush only triggers on next `recordX()` call

---

## 4. Backend Ingest Processing

```
HTTP Request with X-API-Key
    │
    ▼
┌─ verify_api_key_and_get_project() ───────────────────┐
│  1. Check PostgreSQL: projects.api_key match?          │
│     → returns Project with project_id                  │
│  2. Fallback: SQLite-stored keys (legacy)              │
│  3. Fallback: env-based keys (INGEST_API_KEYS)         │
│  4. None match → 401 Unauthorized                      │
└───────────────────────────────────────────────────────┘
    │
    ▼
┌─ ingest_service.py ──────────────────────────────────┐
│  _build_inbound_row(entry, project_id)                │
│  _build_outbound_row(entry, project_id)               │
│  _build_job_row(entry, project_id)                    │
│  _build_scheduled_task_row(entry, project_id)         │
│                                                       │
│  → client.insert(TABLE, rows, column_names=COLUMNS)   │
│    (clickhouse-connect library, synchronous insert)    │
└───────────────────────────────────────────────────────┘
    │
    ▼
┌─ ClickHouse ─────────────────────────────────────────┐
│  INSERT into base table                               │
│      │                                                │
│      └──► Materialized Views auto-trigger             │
│           → Pre-aggregate stats (hourly/daily)        │
│           → Percentiles (P50/P95/P99)                 │
│           → Status timelines                          │
└───────────────────────────────────────────────────────┘
```

---

## 5. Storage Layer

### ClickHouse Tables (Time-Series Data)

| Table | Source | Partition | TTL | ORDER BY |
|---|---|---|---|---|
| `logs` | Inbound HTTP requests | Monthly (`toYYYYMM`) | 90 days | `(timestamp, request_id)` |
| `outbound_logs` | Outbound HTTP requests | Monthly | 90 days | `(project_id, timestamp, service_name, request_id)` |
| `job_logs` | Queue job executions | Monthly | 90 days | `(started_at, job_id)` |
| `scheduled_task_logs` | Scheduled task executions | Monthly | 90 days | `(scheduled_at, task_id)` |

### Materialized Views (Auto-Aggregated)

| View | Source table | Aggregation | Engine |
|---|---|---|---|
| `stats_hourly` | logs | count, error_count, avg/p95/p99 response_time per endpoint/hour | SummingMergeTree |
| `outbound_stats_hourly` | outbound_logs | count, latency sum/min/max, success/fail per service/hour | SummingMergeTree |
| `outbound_percentile_stats_hourly` | outbound_logs | P50/P95/P99 latency per service/hour | AggregatingMergeTree |
| `job_stats_hourly` | job_logs | count, duration, fail/success per queue+class/hour | SummingMergeTree |
| `job_percentile_stats_hourly` | job_logs | P50/P95/P99 duration per queue+class/hour | AggregatingMergeTree |
| `job_status_timeline_hourly` | job_logs | count by status per hour | SummingMergeTree |
| `scheduled_task_stats_daily` | scheduled_task_logs | count, duration, success/fail/missed per command/day | SummingMergeTree |
| `scheduled_task_percentile_stats_daily` | scheduled_task_logs | P50/P95/P99 duration, P95 delay per command/day | AggregatingMergeTree |

Materialized views populate automatically on INSERT — no cron or manual aggregation needed.

### PostgreSQL Tables (Metadata)

| Table | Purpose |
|---|---|
| `users` | User accounts (email, password hash, JWT auth) |
| `organizations` | Multi-tenant organization grouping |
| `projects` | Projects within organizations (name, api_key) |
| `project_settings` | Per-project configuration |

---

## 6. Query Layer (Backend → Frontend)

The frontend fetches data through REST API endpoints authenticated via JWT:

### Dashboard endpoints (source: `logs` table)

| Endpoint | Returns | ClickHouse query pattern |
|---|---|---|
| `GET /stats` | total_requests, error_rate, avg_response_time, rpm + trends | `SELECT count, countIf, avg FROM logs` |
| `GET /stats/timeseries` | time_bucket, requests, errors | `GROUP BY toStartOfHour(timestamp)` |
| `GET /stats/top-endpoints` | endpoint, method, count, avg_time, error_rate | `GROUP BY endpoint, method ORDER BY count DESC` |
| `GET /stats/counts` | all/inbound/outbound counts | `countIf(is_outbound = 0/1)` |
| `GET /stats/global` | per-project stats + PostgreSQL project names | `GROUP BY project_id` + PG join |

### Inbound endpoints (source: `logs` where `is_outbound = 0`)

| Endpoint | Returns |
|---|---|
| `GET /stats/inbound` | Overall stats: success_rate, p95, modules_count |
| `GET /stats/inbound/by-module` | Stats grouped by module (route name) |
| `GET /stats/inbound/modules/{m}/endpoints` | Normalized endpoint stats per module |
| `GET /logs/inbound` | Paginated log list with filters |
| `GET /logs/inbound/{id}` | Single log detail including request/response body |

### Outbound endpoints (source: `outbound_logs`)

| Endpoint | Returns |
|---|---|
| `GET /stats/outbound` | Overall stats: success_rate, p95, timeouts, retries |
| `GET /stats/outbound/by-service` | Stats grouped by service_name |
| `GET /stats/outbound/by-host` | Stats grouped by target_host |
| `GET /stats/outbound/services/{s}/endpoints` | Normalized endpoint stats per service |
| `GET /logs/outbound` | Paginated log list with filters |
| `GET /logs/outbound/{id}` | Detail including headers, body, metadata |

### Jobs endpoints (source: `job_logs`)

| Endpoint | Returns |
|---|---|
| `GET /jobs/health` | Success/fail/retry counts, P50/P95/P99, by_queue, by_class, recent_failures |
| `GET /jobs/timeline` | Time-series: success/fail/retry per time bucket |
| `GET /logs/jobs` | Paginated job execution list |
| `GET /logs/jobs/{id}` | Detail including payload, exception trace |

### Scheduled Tasks endpoints (source: `scheduled_task_logs`)

| Endpoint | Returns |
|---|---|
| `GET /scheduled-tasks/health` | Success/fail/missed, by_command, avg_delay |
| `GET /logs/scheduled-tasks` | Paginated task execution list |

---

## 7. Performance Impact on Laravel App

### Per-request overhead (no flush)

| Component | Cost | Notes |
|---|---|---|
| `RequestIdMiddleware` | ~0.01ms | UUID generate + set attribute |
| `InboundCollector.start()` | ~0.002ms | `microtime()` + `memory_get_usage()` |
| `InboundCollector.end()` | ~0.05ms | Build array + push to buffer |
| `InboundRequestLogger.log()` | ~0.3-1ms | Build data + mask + **disk write** |
| `autoFlushIfNeeded()` (no flush) | ~0.001ms | Two comparisons |
| **Total (no flush)** | **~0.4-1ms** | |

### When flush triggers

| Scenario | Additional cost | Impact |
|---|---|---|
| Normal request (no flush) | ~0ms | Negligible |
| Request triggers batch flush | +5-50ms | HTTP POST to SidMonitor backend |
| SidMonitor backend slow | +100-5000ms | Blocks current request (5s timeout) |
| SidMonitor backend down | +5000ms | 1 in every `batchSize` requests blocked for 5s |
| `record_body` enabled | +0.1-0.5ms | Memory: up to 128KB per entry in buffer |

### Memory usage

```
Normal:     ~500-800 bytes per buffered entry × batchSize(100) ≈ 80KB
With body:  ~128KB per entry × 100 ≈ 12.8MB worst case
```

### Known limitations

1. **Synchronous flush on request path** — flush blocks the current request
2. **No circuit breaker** — continues attempting flush when backend is down
3. **No shutdown hook** — buffered data lost on process termination
4. **Singleton state not thread-safe** — will produce incorrect data under Laravel Octane (Swoole/RoadRunner)
5. **Synchronous disk I/O** — logger writes to file on every request

---

## 8. Field Mapping: SDK → Backend

### Inbound (SDK field → Backend `InboundLogEntry` field)

| SDK sends | Backend expects | Notes |
|---|---|---|
| `request_id` | `request_id` | Direct match |
| `timestamp` | `timestamp` | ISO8601 |
| `endpoint` (= `$request->path()`) | `endpoint` | Direct match |
| `method` | `method` | Direct match |
| `status_code` | `status_code` | Direct match |
| `response_time_ms` (= duration × 1000) | `response_time_ms` | Direct match |
| `user_id` | `user_id` | Direct match |
| `user_name` | `user_name` | Direct match |
| `module` (= route name) | `module` | Direct match |
| `tags` | `tags` | Direct match |
| `request_body` | `request_body` | Optional |
| `response_body` | `response_body` | Optional |

### Outbound (SDK field → Backend `OutboundLogEntry` field)

| SDK sends | Backend expects | Alias resolution |
|---|---|---|
| `endpoint` (full URL) | `target_url` | via `AliasChoices("target_url", "endpoint")` |
| `response_time_ms` | `latency_ms` | via `AliasChoices("latency_ms", "response_time_ms")` |
| `third_party_service` | `service_name` | via `AliasChoices("service_name", "third_party_service")` |
| — | `parent_request_id` | **Not sent** |
| — | `trace_id`, `span_id` | **Not sent** |
| — | `request_size`, `response_size` | **Not sent** |
| — | `error_message`, `error_code` | **Not sent** |
| — | `retry_count` | **Not sent** |
| — | `request_headers`, `response_headers` | **Not sent** |

### Job (SDK field → Backend `JobLogEntry` field)

| SDK sends | Backend expects | Notes |
|---|---|---|
| `status` | `status` | SDK maps: `processed`→`completed`, `failed`→`failed` |
| `job_class` (= full class name) | `job_class` | Direct match |
| `job_name` (= humanized short name) | `job_name` | Direct match |
| `duration_ms` (= duration × 1000) | `duration_ms` | Direct match |
| `memory_usage_mb` (= bytes / 1MB) | `memory_usage_mb` | Direct match |
| All other fields | — | Direct match |
