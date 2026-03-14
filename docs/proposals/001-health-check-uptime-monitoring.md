# 001 — Health Check & Uptime Monitoring

## Summary

Active health-check system where SidMonitor periodically pings project health endpoints, records response status/latency, and surfaces uptime metrics on the dashboard. This replaces passive "is data flowing?" inference with an explicit, configurable availability signal.

## Motivation

SidMonitor currently tracks request/response data passively — it only knows an app is healthy when the SDK is actively sending logs. If an app goes completely down, there's a blind spot until a human notices the silence. Active health checks close this gap by:

- Providing real-time uptime/downtime visibility per project
- Enabling future alerting integration (proposal 003) on downtime events
- Giving teams a single pane for both performance and availability

## Technical Design

### 1. PostgreSQL Schema Changes

Add 3 columns to the existing `projects` table:

```sql
ALTER TABLE projects
  ADD COLUMN health_check_url       TEXT          DEFAULT NULL,
  ADD COLUMN health_check_interval  INTEGER       DEFAULT 60,      -- seconds
  ADD COLUMN health_check_enabled   BOOLEAN       DEFAULT FALSE;
```

Update the SQLAlchemy `Project` model in `backend/app/models/database.py`:

```python
health_check_url      = Column(String, nullable=True)
health_check_interval = Column(Integer, default=60)
health_check_enabled  = Column(Boolean, default=False)
```

### 2. ClickHouse Table — `health_check_logs`

```sql
CREATE TABLE health_check_logs (
    id              UUID DEFAULT generateUUIDv4(),
    project_id      UUID,
    timestamp       DateTime64(3),
    target_url      String,
    status_code     UInt16        DEFAULT 0,
    latency_ms      Float64       DEFAULT 0,
    is_up           UInt8         DEFAULT 0,      -- 1 = healthy, 0 = down
    error_message   String        DEFAULT '',
    checked_from    String        DEFAULT 'default'  -- region hint for future multi-region
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;
```

### 3. Materialized View — Hourly Rollup

```sql
CREATE MATERIALIZED VIEW health_check_stats_hourly
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, hour)
AS SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    countState()              AS total_checks,
    sumState(is_up)           AS up_count,
    avgState(latency_ms)      AS avg_latency_ms,
    maxState(latency_ms)      AS max_latency_ms,
    minState(latency_ms)      AS min_latency_ms
FROM health_check_logs
GROUP BY project_id, hour;
```

### 4. Background Scheduler

Use `asyncio` inside the FastAPI process (or a dedicated worker) to schedule checks:

```
backend/app/services/health_check_scheduler.py
```

- On startup, load all projects with `health_check_enabled = True`
- Maintain an in-memory schedule (project_id → next_check_at)
- Every second, fire off checks whose interval has elapsed using `httpx.AsyncClient`
- Record result → insert into ClickHouse `health_check_logs`
- Reload project list periodically (every 60s) to pick up config changes
- Respect a global concurrency limit (e.g., semaphore of 50) to avoid overwhelming the backend

### 5. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health-checks/summary` | Current uptime %, avg latency, last check status for the project |
| `GET` | `/api/v1/health-checks/timeline` | Time-series of check results (status + latency) for charting |
| `PATCH` | `/api/projects/{project_id}/health-check` | Update health check config (url, interval, enabled) |

Auth: JWT (dashboard user) — scoped to the project via org membership.

### 6. Frontend

**Settings page** (`frontend/src/pages/Settings.tsx`):
- New "Health Check" section in project settings
- Fields: URL input, interval dropdown (30s / 60s / 5m / 15m), enable/disable toggle
- Inline test button: fires a one-off check and shows result

**Dashboard** (`frontend/src/pages/Dashboard.tsx`):
- New `UptimeCard` component showing:
  - Current status badge (Up / Down / Degraded)
  - Uptime percentage (24h / 7d / 30d)
  - Avg response time
  - Mini sparkline of recent latency
- Links to a dedicated uptime detail view (future)

## Files to Modify

| Layer | File | Change |
|-------|------|--------|
| DB Migration | `database/migrations/` | Add 3 columns to `projects` |
| Model | `backend/app/models/database.py` | Add columns to Project model |
| Model | `backend/app/models/health_check.py` | New — Pydantic request/response models |
| Service | `backend/app/services/health_check_scheduler.py` | New — asyncio scheduler + check logic |
| Service | `backend/app/services/health_check_service.py` | New — query ClickHouse for summary/timeline |
| API | `backend/app/api/health_checks.py` | New — summary + timeline + config endpoints |
| API | `backend/app/main.py` | Register health_checks router |
| ClickHouse | `clickhouse/init/05_health_check_logs.sql` | New — table + materialized view |
| Frontend | `frontend/src/pages/Settings.tsx` | Health check config section |
| Frontend | `frontend/src/pages/Dashboard.tsx` | UptimeCard component |
| Frontend | `frontend/src/hooks/useHealthChecks.ts` | New — React Query hooks |
| Frontend | `frontend/src/api/client.ts` | Add healthChecks API namespace |

## Implementation Steps

1. **ClickHouse table + materialized view** — create `05_health_check_logs.sql`
2. **PostgreSQL migration** — add 3 columns to `projects`
3. **Backend models** — Pydantic schemas for config update, summary response, timeline response
4. **Health check scheduler** — asyncio-based, insert results into ClickHouse
5. **API endpoints** — summary, timeline, config PATCH; register router
6. **Frontend settings** — config form with test button
7. **Dashboard card** — UptimeCard with uptime %, latency sparkline
8. **Testing** — integration test with a mock target server

## Effort Estimate

| Component | Estimate |
|-----------|----------|
| ClickHouse schema | 0.5 day |
| PostgreSQL migration + model | 0.5 day |
| Scheduler service | 1–2 days |
| API endpoints | 0.5 day |
| Frontend (settings + dashboard card) | 1–1.5 days |
| Testing + edge cases | 1 day |
| **Total** | **4–6 days** |
