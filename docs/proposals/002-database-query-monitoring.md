# 002 — Database Query Monitoring

## Summary

Track Laravel database queries via the SDK's `QueryExecuted` event listener, ingest them into ClickHouse, and surface slow queries, N+1 detection, and query analytics on a new dashboard page.

## Motivation

Database queries are the most common performance bottleneck in Laravel apps. Currently, SidMonitor tracks HTTP requests and jobs but has no visibility into what's happening at the database layer. This feature would:

- Surface slow queries with full SQL and execution time
- Detect N+1 query patterns (repeated identical queries within a single request)
- Provide per-endpoint query count and total DB time breakdown
- Help developers identify and fix the most impactful performance issues

## Technical Design

### 1. ClickHouse Table — `query_logs`

```sql
CREATE TABLE query_logs (
    id              UUID DEFAULT generateUUIDv4(),
    project_id      UUID,
    timestamp       DateTime64(3),
    request_id      String        DEFAULT '',     -- links to parent inbound request
    job_id          String        DEFAULT '',     -- links to parent job (if from queue)
    query           String,                       -- normalized SQL
    query_hash      String        DEFAULT '',     -- hash for grouping identical queries
    duration_ms     Float64       DEFAULT 0,
    connection      String        DEFAULT 'mysql',
    database_name   String        DEFAULT '',
    bindings_count  UInt16        DEFAULT 0,      -- number of bindings (not values, for privacy)
    rows_affected   UInt32        DEFAULT 0,
    query_type      LowCardinality(String) DEFAULT '',  -- SELECT, INSERT, UPDATE, DELETE
    file            String        DEFAULT '',     -- origin file (if available)
    line            UInt32        DEFAULT 0,      -- origin line number
    metadata        String        DEFAULT ''
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp, request_id)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

ALTER TABLE query_logs ADD INDEX idx_query_hash query_hash TYPE bloom_filter GRANULARITY 4;
ALTER TABLE query_logs ADD INDEX idx_request_id request_id TYPE bloom_filter GRANULARITY 4;
ALTER TABLE query_logs ADD INDEX idx_duration duration_ms TYPE minmax GRANULARITY 4;
```

### 2. Materialized View — Hourly Rollup

```sql
CREATE MATERIALIZED VIEW query_stats_hourly
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, hour)
AS SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    countState()              AS total_queries,
    avgState(duration_ms)     AS avg_duration_ms,
    maxState(duration_ms)     AS max_duration_ms,
    quantileState(0.95)(duration_ms) AS p95_duration_ms
FROM query_logs
GROUP BY project_id, hour;
```

### 3. Laravel SDK — `DatabaseCollector`

New file: `packages/laravel/src/Collectors/DatabaseCollector.php`

Follows the existing collector pattern (InboundCollector, JobCollector, etc.):

```php
class DatabaseCollector
{
    public function __construct(ExporterInterface $exporter) { ... }

    public function register(): void
    {
        DB::listen(function (QueryExecuted $event) {
            if (!$this->shouldMonitor($event)) return;

            $data = [
                'request_id'     => request()->header('X-Request-Id', ''),
                'query'          => $this->normalizeQuery($event->sql),
                'query_hash'     => md5($this->normalizeQuery($event->sql)),
                'duration_ms'    => $event->time,
                'connection'     => $event->connectionName,
                'bindings_count' => count($event->bindings),
                'query_type'     => $this->detectQueryType($event->sql),
                'timestamp'      => now()->toIso8601String(),
            ];

            $this->exporter->recordQuery($data);
        });
    }

    private function normalizeQuery(string $sql): string { /* replace binding values with ? */ }
    private function detectQueryType(string $sql): string { /* SELECT|INSERT|UPDATE|DELETE */ }
    private function shouldMonitor(QueryExecuted $event): bool { /* check config exclusions */ }
}
```

### 4. SDK Config Extension

Add to `packages/laravel/config/observatory.php`:

```php
'database' => [
    'enabled'            => env('OBSERVATORY_DB_ENABLED', false),  // opt-in
    'exclude_queries'    => [],         // regex patterns to skip
    'exclude_connections'=> [],         // e.g., ['sqlite'] to skip test DBs
    'slow_threshold_ms'  => 100,        // only log queries slower than this (0 = all)
    'log_bindings'       => false,      // never log actual binding values by default
    'max_queries_per_request' => 200,   // cap to prevent runaway logging
],
```

### 5. Exporter Interface Extension

Add to `ExporterInterface`:

```php
public function recordQuery(array $data): void;
```

Implement in `SidMonitorExporter` — batch queries and send via:

```
POST /api/ingest/queries
POST /api/ingest/queries/batch
```

### 6. Backend Ingest

New Pydantic model `QueryLogEntry` in `backend/app/models/queries.py`.

New ingest endpoints in `backend/app/api/ingest.py`:

```python
@router.post("/ingest/queries")
@router.post("/ingest/queries/batch")
```

New insert functions in `backend/app/services/ingest_service.py`:

```python
def insert_query_log(entry: QueryLogEntry, project_id: UUID) -> None
def insert_query_logs_batch(entries: list[QueryLogEntry], project_id: UUID) -> int
```

### 7. API Query Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/queries/slow` | Top slow queries (grouped by query_hash, sorted by avg duration) |
| `GET` | `/api/v1/queries/n-plus-one` | Queries repeated >N times within same request_id |
| `GET` | `/api/v1/queries/stats` | Aggregate stats: total queries, avg duration, p95 |
| `GET` | `/api/v1/queries/timeline` | Time-series of query count and avg duration |
| `GET` | `/api/v1/queries/by-request/{request_id}` | All queries for a specific request |

### 8. Frontend

New page: `frontend/src/pages/DatabaseQueries.tsx`

Sections:
- **Overview cards**: total queries/hr, avg duration, p95, slow query count
- **Slow queries table**: grouped by normalized SQL, sortable by avg/max duration, occurrence count
- **N+1 detection panel**: requests with suspiciously high duplicate query counts, with link to request detail
- **Time-series chart**: query volume and avg latency over time
- **Query detail drawer**: full SQL, origin file:line (if available), duration distribution

Route: `/:orgSlug/:projectSlug/database-queries`

## Files to Modify

| Layer | File | Change |
|-------|------|--------|
| ClickHouse | `clickhouse/init/06_query_logs.sql` | New — table + materialized view |
| SDK | `packages/laravel/src/Collectors/DatabaseCollector.php` | New — QueryExecuted listener |
| SDK | `packages/laravel/config/observatory.php` | Add `database` config section |
| SDK | `packages/laravel/src/Contracts/ExporterInterface.php` | Add `recordQuery()` method |
| SDK | `packages/laravel/src/Exporters/SidMonitorExporter.php` | Implement `recordQuery()` |
| SDK | `packages/laravel/src/ObservatoryServiceProvider.php` | Register DatabaseCollector |
| Backend Model | `backend/app/models/queries.py` | New — QueryLogEntry, QueryStatsResponse |
| Backend Service | `backend/app/services/ingest_service.py` | Add query insert functions |
| Backend Service | `backend/app/services/query_service.py` | New — slow query, N+1 detection logic |
| Backend API | `backend/app/api/ingest.py` | Add query ingest endpoints |
| Backend API | `backend/app/api/queries.py` | New — query analytics endpoints |
| Backend API | `backend/app/main.py` | Register queries router |
| Frontend | `frontend/src/pages/DatabaseQueries.tsx` | New — query analytics page |
| Frontend | `frontend/src/hooks/useQueries.ts` | New — React Query hooks |
| Frontend | `frontend/src/api/client.ts` | Add queries API namespace |
| Frontend | `frontend/src/App.tsx` | Add route for database-queries |

## Implementation Steps

1. **ClickHouse schema** — create `query_logs` table and materialized view
2. **SDK DatabaseCollector** — implement `QueryExecuted` listener with normalization and N+1 grouping
3. **SDK config + exporter** — add `database` config, extend ExporterInterface, implement in SidMonitorExporter
4. **Backend ingest** — Pydantic model, ingest endpoints, insert service functions
5. **Backend query endpoints** — slow queries, N+1 detection, stats, timeline
6. **Frontend page** — overview cards, slow query table, N+1 panel, time-series chart
7. **Route + navigation** — add to App.tsx and sidebar
8. **Testing** — integration test with sample queries, verify N+1 detection logic

## Effort Estimate

| Component | Estimate |
|-----------|----------|
| ClickHouse schema | 0.5 day |
| Laravel SDK collector + config | 1–2 days |
| Backend ingest + service | 1 day |
| Backend query analytics endpoints | 1 day |
| Frontend page + hooks | 1.5–2 days |
| N+1 detection logic + tuning | 1 day |
| Testing | 1 day |
| **Total** | **6–8 days** |
