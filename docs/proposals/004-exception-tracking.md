# 004 — Exception Tracking

## Summary

Dedicated exception tracking with fingerprint-based grouping, occurrence counting, and stack trace visualization — a lightweight Sentry-like experience built into SidMonitor. Leverages the existing `exceptions` config section in the Laravel SDK that is defined but not yet implemented.

## Motivation

SidMonitor already captures exception data as part of job failures (`exception_class`, `exception_message`, `exception_trace` in `job_logs`), but there's no dedicated exception tracking for:

- Exceptions thrown during HTTP request handling (caught by Laravel's exception handler)
- Exceptions that don't result in job failures (e.g., caught-and-logged exceptions)
- Aggregate exception analytics: which exceptions are most frequent, trending up, or newly appeared

The SDK config already has an `exceptions` section with `enabled`, `ignore`, `log_stack_trace`, and `max_stack_frames` — the infrastructure is primed for implementation.

## Technical Design

### 1. ClickHouse Table — `exceptions`

```sql
CREATE TABLE exceptions (
    id              UUID DEFAULT generateUUIDv4(),
    project_id      UUID,
    timestamp       DateTime64(3),
    request_id      String        DEFAULT '',
    job_id          String        DEFAULT '',
    exception_class String,
    message         String,
    code            String        DEFAULT '',
    fingerprint     String,                       -- hash for grouping (class + normalized message + file + line)
    file            String        DEFAULT '',
    line            UInt32        DEFAULT 0,
    stack_trace     String        DEFAULT '',     -- JSON array of frames
    previous_class  String        DEFAULT '',     -- previous exception chain
    previous_message String       DEFAULT '',
    user_id         String        DEFAULT '',
    url             String        DEFAULT '',     -- request URL if HTTP context
    method          String        DEFAULT '',     -- HTTP method if HTTP context
    environment     LowCardinality(String) DEFAULT '',
    app_version     String        DEFAULT '',
    tags            Array(String) DEFAULT [],
    metadata        String        DEFAULT ''
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, fingerprint, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

ALTER TABLE exceptions ADD INDEX idx_fingerprint fingerprint TYPE bloom_filter GRANULARITY 4;
ALTER TABLE exceptions ADD INDEX idx_exception_class exception_class TYPE bloom_filter GRANULARITY 4;
ALTER TABLE exceptions ADD INDEX idx_request_id request_id TYPE bloom_filter GRANULARITY 4;
```

### 2. Materialized View — Exception Groups

```sql
CREATE MATERIALIZED VIEW exception_groups_hourly
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, fingerprint, hour)
AS SELECT
    project_id,
    fingerprint,
    anyState(exception_class)  AS exception_class,
    anyState(message)          AS last_message,
    toStartOfHour(timestamp)   AS hour,
    countState()               AS occurrence_count,
    uniqState(request_id)      AS affected_requests,
    uniqState(user_id)         AS affected_users,
    maxState(timestamp)        AS last_seen,
    minState(timestamp)        AS first_seen
FROM exceptions
GROUP BY project_id, fingerprint, hour;
```

### 3. Fingerprinting Strategy

The fingerprint determines how exceptions are grouped. Default strategy:

```
fingerprint = md5(exception_class + normalized_message + file + line)
```

**Normalization rules:**
- Strip dynamic IDs from messages (UUIDs, numeric IDs)
- Strip file paths from messages
- Strip timestamps from messages
- Collapse whitespace

This allows identical exceptions from the same location to group together even if the message varies slightly (e.g., "User 123 not found" and "User 456 not found" → same group).

### 4. Laravel SDK — `ExceptionCollector`

New file: `[laravel-observatory]src/Collectors/ExceptionCollector.php`

```php
class ExceptionCollector
{
    public function __construct(ExporterInterface $exporter) { ... }

    public function register(): void
    {
        // Register with Laravel's exception handler
        app(ExceptionHandler::class)->reportable(function (\Throwable $e) {
            if (!$this->shouldMonitor($e)) return;

            $data = [
                'exception_class' => get_class($e),
                'message'         => $e->getMessage(),
                'code'            => (string) $e->getCode(),
                'fingerprint'     => $this->generateFingerprint($e),
                'file'            => $e->getFile(),
                'line'            => $e->getLine(),
                'stack_trace'     => $this->formatStackTrace($e),
                'previous_class'  => $e->getPrevious() ? get_class($e->getPrevious()) : '',
                'previous_message'=> $e->getPrevious()?->getMessage() ?? '',
                'request_id'      => request()->header('X-Request-Id', ''),
                'url'             => request()->fullUrl(),
                'method'          => request()->method(),
                'user_id'         => auth()->id() ?? '',
                'timestamp'       => now()->toIso8601String(),
            ];

            $this->exporter->recordException($data);
        });
    }

    private function shouldMonitor(\Throwable $e): bool
    {
        $ignoreList = config('observatory.exceptions.ignore', []);
        foreach ($ignoreList as $class) {
            if ($e instanceof $class) return false;
        }
        return true;
    }

    private function formatStackTrace(\Throwable $e): string
    {
        $maxFrames = config('observatory.exceptions.max_stack_frames', 20);
        $frames = array_slice($e->getTrace(), 0, $maxFrames);
        return json_encode(array_map(fn($f) => [
            'file'     => $f['file'] ?? '',
            'line'     => $f['line'] ?? 0,
            'function' => $f['function'] ?? '',
            'class'    => $f['class'] ?? '',
        ], $frames));
    }

    private function generateFingerprint(\Throwable $e): string
    {
        $normalized = preg_replace('/\b[0-9a-f-]{36}\b/', '{id}', $e->getMessage());
        $normalized = preg_replace('/\b\d+\b/', '{n}', $normalized);
        return md5(get_class($e) . $normalized . $e->getFile() . $e->getLine());
    }
}
```

### 5. Exporter Interface Extension

Add to `ExporterInterface`:

```php
public function recordException(array $data): void;
```

Note: The `recordException` method signature may already exist from the JobCollector (which calls it on job failures). If so, extend the existing implementation to handle standalone exceptions as well, routing them to the new `exceptions` table instead of embedding in `job_logs`.

### 6. Backend Ingest

New Pydantic model and endpoints:

```python
# POST /api/ingest/exceptions
# POST /api/ingest/exceptions/batch
```

New insert functions in `ingest_service.py`:
```python
def insert_exception(entry: ExceptionEntry, project_id: UUID) -> None
def insert_exceptions_batch(entries: list[ExceptionEntry], project_id: UUID) -> int
```

### 7. API Query Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/exceptions` | List exception groups (fingerprint, class, count, last_seen), paginated |
| `GET` | `/api/v1/exceptions/{fingerprint}` | Detail for one exception group: occurrences, trend, affected users |
| `GET` | `/api/v1/exceptions/{fingerprint}/occurrences` | Individual occurrences with stack traces |
| `GET` | `/api/v1/exceptions/stats` | Aggregate stats: total exceptions, unique groups, trend |
| `GET` | `/api/v1/exceptions/timeline` | Time-series of exception count |

### 8. Frontend

New page: `frontend/src/pages/Exceptions.tsx`

**Exception list view:**
- Table with columns: exception class, message preview, occurrence count, affected users, first/last seen, trend sparkline
- Sortable by count, last seen, affected users
- Status badges: New (first seen < 24h), Recurring, Regressed
- Filters: time range, exception class, search by message

**Exception detail view** (click into a group):
- Exception class + full message
- Occurrence count + trend chart
- Affected request count + affected user count
- **Stack trace viewer** component:
  - Collapsible frame list
  - Syntax-highlighted file:line references
  - "Application" frames highlighted vs vendor/framework frames
- Occurrences tab: table of individual events with timestamp, request_id, user_id
- Related requests: links to inbound request detail if request_id is present

Route: `/:orgSlug/:projectSlug/exceptions`

## Files to Modify

| Layer | File | Change |
|-------|------|--------|
| ClickHouse | `clickhouse/init/07_exceptions.sql` | New — table + materialized view |
| SDK | `[laravel-observatory]src/Collectors/ExceptionCollector.php` | New — exception handler integration |
| SDK | `[laravel-observatory]src/Contracts/ExporterInterface.php` | Add/update `recordException()` |
| SDK | `[laravel-observatory]src/Exporters/SidMonitorExporter.php` | Implement exception export |
| SDK | `[laravel-observatory]src/ObservatoryServiceProvider.php` | Register ExceptionCollector |
| Backend Model | `backend/app/models/exceptions.py` | New — ExceptionEntry, ExceptionGroupResponse |
| Backend Service | `backend/app/services/ingest_service.py` | Add exception insert functions |
| Backend Service | `backend/app/services/exception_service.py` | New — grouping queries, stats, timeline |
| Backend API | `backend/app/api/ingest.py` | Add exception ingest endpoints |
| Backend API | `backend/app/api/exceptions.py` | New — exception list, detail, stats endpoints |
| Backend API | `backend/app/main.py` | Register exceptions router |
| Frontend | `frontend/src/pages/Exceptions.tsx` | New — exception list page |
| Frontend | `frontend/src/components/exceptions/` | New — StackTraceViewer, ExceptionDetail |
| Frontend | `frontend/src/hooks/useExceptions.ts` | New — React Query hooks |
| Frontend | `frontend/src/api/client.ts` | Add exceptions API namespace |
| Frontend | `frontend/src/App.tsx` | Add route for exceptions |

## Implementation Steps

1. **ClickHouse schema** — create `exceptions` table and `exception_groups_hourly` materialized view
2. **Laravel SDK ExceptionCollector** — implement with fingerprinting, stack trace formatting, ignore list
3. **SDK exporter** — extend ExporterInterface, implement in SidMonitorExporter with batching
4. **Backend ingest** — Pydantic model, ingest endpoints, insert service functions
5. **Backend query service** — exception group listing, detail, stats, timeline queries
6. **API endpoints** — register router for exception analytics
7. **Frontend exception list** — table with grouping, sorting, filtering
8. **Frontend exception detail** — stack trace viewer, occurrence list, trend chart
9. **Navigation** — add to sidebar and App.tsx routes
10. **Testing** — verify fingerprinting logic, test grouping accuracy

## Effort Estimate

| Component | Estimate |
|-----------|----------|
| ClickHouse schema | 0.5 day |
| Laravel SDK collector + fingerprinting | 1.5–2 days |
| Backend ingest | 0.5 day |
| Backend query endpoints | 1–1.5 days |
| Frontend exception list | 1.5 days |
| Frontend stack trace viewer | 1–1.5 days |
| Testing + fingerprint tuning | 1 day |
| **Total** | **7–9 days** |
