# 006 — Deployment Tracking

## Summary

Track deployment events and overlay them on time-series dashboard charts. When a metric spikes or dips, teams can instantly correlate the change with a specific deploy — answering "did the deploy cause this?"

## Motivation

SidMonitor shows time-series data for error rates, latency, and throughput, but there's no way to see *when* code changes were deployed. This makes it hard to:

- Correlate metric changes with specific deployments
- Identify which deploy introduced a regression
- Measure the impact of performance improvements
- Maintain a deployment history for audit/postmortem purposes

Deployment markers on charts are a standard APM feature that dramatically improve incident investigation speed.

## Technical Design

### 1. ClickHouse Table — `deploy_events`

```sql
CREATE TABLE deploy_events (
    id              UUID DEFAULT generateUUIDv4(),
    project_id      UUID,
    timestamp       DateTime64(3),
    version         String        DEFAULT '',     -- git tag, semver, or build number
    commit_sha      String        DEFAULT '',     -- short or full SHA
    branch          String        DEFAULT '',
    environment     LowCardinality(String) DEFAULT 'production',
    description     String        DEFAULT '',     -- deploy notes / changelog summary
    deployed_by     String        DEFAULT '',     -- user or CI system
    source          LowCardinality(String) DEFAULT 'api',  -- 'api', 'cli', 'ci', 'sdk'
    duration_ms     UInt32        DEFAULT 0,      -- deploy duration (if known)
    metadata        String        DEFAULT ''      -- JSON blob for arbitrary data
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp)
TTL timestamp + INTERVAL 365 DAY                  -- keep deploy history longer
SETTINGS index_granularity = 8192;

ALTER TABLE deploy_events ADD INDEX idx_version version TYPE bloom_filter GRANULARITY 4;
ALTER TABLE deploy_events ADD INDEX idx_commit commit_sha TYPE bloom_filter GRANULARITY 4;
```

### 2. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/deploys` | Record a new deployment event |
| `GET` | `/api/v1/deploys` | List deploy events (paginated, filterable by date range + environment) |
| `GET` | `/api/v1/deploys/{id}` | Get deploy detail |
| `GET` | `/api/v1/deploys/latest` | Most recent deploy per environment |

#### Ingest Endpoint

```
POST /api/v1/deploys
Authorization: X-API-Key (same project API key used by SDK)

{
    "version": "v2.3.1",
    "commit_sha": "a1b2c3d",
    "branch": "main",
    "environment": "production",
    "description": "Fix payment retry logic",
    "deployed_by": "github-actions",
    "source": "ci",
    "duration_ms": 45000,
    "metadata": "{\"pr\": 142, \"ci_url\": \"...\"}"
}
```

Auth: accepts both JWT (dashboard) and `X-API-Key` (SDK/CI) — allows both manual and automated recording.

### 3. Recording Deploys — Integration Methods

**Method A: CI/CD Webhook (Primary)**

Simple `curl` from any CI pipeline:

```bash
# In GitHub Actions, GitLab CI, etc.
curl -X POST https://api.sidmonitor.com/api/v1/deploys \
  -H "X-API-Key: $SIDMONITOR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "'$GIT_TAG'",
    "commit_sha": "'$GIT_SHA'",
    "branch": "'$GIT_BRANCH'",
    "environment": "production",
    "deployed_by": "github-actions",
    "source": "ci"
  }'
```

**Method B: Laravel SDK Artisan Command**

New command: `php artisan observatory:deploy`

```php
class DeployCommand extends Command
{
    protected $signature = 'observatory:deploy
        {--version= : Version tag}
        {--commit= : Git commit SHA}
        {--branch= : Git branch}
        {--env=production : Environment}
        {--description= : Deploy notes}';

    public function handle()
    {
        // Auto-detect from git if not provided
        $commit = $this->option('commit') ?: trim(shell_exec('git rev-parse --short HEAD'));
        $branch = $this->option('branch') ?: trim(shell_exec('git branch --show-current'));

        $exporter = app(ExporterInterface::class);
        $exporter->recordDeploy([...]);
    }
}
```

**Method C: SDK Auto-Detection (Optional, Phase 2)**

Detect new deploys by comparing app version on SDK boot. If version changes from last seen → record deploy automatically.

### 4. Frontend — Deploy Markers on Charts

**Chart overlay component**: `frontend/src/components/charts/DeployMarkers.tsx`

Visual approach:
- Vertical dashed lines on time-series charts at deploy timestamps
- Small label above the line showing version/commit
- Hover tooltip: full deploy info (version, commit, deployed_by, description)
- Click: navigate to deploy detail or expand inline

**Integration with existing charts:**

The dashboard already uses Recharts for time-series. Add deploy markers using Recharts' `ReferenceLine` component:

```tsx
{deploys.map(deploy => (
    <ReferenceLine
        key={deploy.id}
        x={deploy.timestamp}
        stroke="#6366f1"
        strokeDasharray="4 4"
        label={<DeployLabel deploy={deploy} />}
    />
))}
```

Apply to all time-series charts:
- Dashboard overview (requests, errors, latency)
- Inbound APIs time-series
- Outbound APIs time-series
- Jobs time-series
- Scheduled tasks time-series

**Deploy list page**: `frontend/src/pages/Deploys.tsx`

Simple table view:
- Version, commit SHA, branch, environment, deployed_by, timestamp, description
- Click to see the deploy detail (or modal)
- Filter by environment and date range

### 5. Deploy Impact Analysis (Phase 2)

Compare key metrics before vs. after a deploy:

```
Deploy v2.3.1 (2h ago)
├── Error rate:  2.1% → 0.8%  ↓ 62%  ✅
├── P95 latency: 340ms → 290ms  ↓ 15%  ✅
├── Throughput:  1.2k/min → 1.3k/min  ↑ 8%
└── Job failures: 0.5% → 3.2%  ↑ 540%  ⚠️
```

This could be a section on the deploy detail page, comparing metrics from the window before the deploy to the window after.

## Files to Modify

| Layer | File | Change |
|-------|------|--------|
| ClickHouse | `clickhouse/init/08_deploy_events.sql` | New — deploy_events table |
| Backend Model | `backend/app/models/deploys.py` | New — DeployEvent, DeployCreate schemas |
| Backend Service | `backend/app/services/deploy_service.py` | New — insert + query deploy events |
| Backend API | `backend/app/api/deploys.py` | New — deploy CRUD endpoints |
| Backend API | `backend/app/main.py` | Register deploys router |
| SDK | `packages/laravel/src/Commands/DeployCommand.php` | New — artisan deploy command |
| SDK | `packages/laravel/src/Contracts/ExporterInterface.php` | Add `recordDeploy()` |
| SDK | `packages/laravel/src/Exporters/SidMonitorExporter.php` | Implement deploy export |
| SDK | `packages/laravel/src/ObservatoryServiceProvider.php` | Register artisan command |
| Frontend | `frontend/src/components/charts/DeployMarkers.tsx` | New — chart overlay component |
| Frontend | `frontend/src/pages/Deploys.tsx` | New — deploy list page |
| Frontend | `frontend/src/pages/Dashboard.tsx` | Add deploy markers to charts |
| Frontend | `frontend/src/pages/InboundAPIs.tsx` | Add deploy markers to charts |
| Frontend | `frontend/src/pages/OutboundAPIs.tsx` | Add deploy markers to charts |
| Frontend | `frontend/src/pages/Jobs.tsx` | Add deploy markers to charts |
| Frontend | `frontend/src/pages/ScheduledTasks.tsx` | Add deploy markers to charts |
| Frontend | `frontend/src/hooks/useDeploys.ts` | New — React Query hooks |
| Frontend | `frontend/src/api/client.ts` | Add deploys API namespace |
| Frontend | `frontend/src/App.tsx` | Add deploy route |

## Implementation Steps

1. **ClickHouse schema** — create `deploy_events` table (longer TTL: 365 days)
2. **Backend models** — Pydantic schemas for deploy creation and response
3. **Backend service** — insert and query deploy events from ClickHouse
4. **API endpoints** — deploy CRUD, register router; support both JWT and API key auth
5. **DeployMarkers component** — Recharts ReferenceLine overlay with tooltips
6. **Integrate markers** — add to all time-series charts (Dashboard, Inbound, Outbound, Jobs, Tasks)
7. **Deploy list page** — table view with filters
8. **Laravel artisan command** — `observatory:deploy` with git auto-detection
9. **SDK exporter** — extend interface and SidMonitorExporter
10. **Documentation** — CI/CD integration examples (GitHub Actions, GitLab CI, etc.)
11. **Testing** — verify marker rendering, API auth with both JWT and API key

## Effort Estimate

| Component | Estimate |
|-----------|----------|
| ClickHouse schema | 0.5 day |
| Backend API + service | 1 day |
| DeployMarkers chart component | 1–1.5 days |
| Chart integration (5 pages) | 1 day |
| Deploy list page | 0.5 day |
| Laravel artisan command | 0.5 day |
| Deploy impact analysis (Phase 2) | 1.5–2 days |
| Testing + docs | 1 day |
| **Total** | **6–8 days** (Phase 1: 5–6 days) |
