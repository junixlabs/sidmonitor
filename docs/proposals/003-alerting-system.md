# 003 — Alerting System

## Summary

A rule-based alerting system that evaluates project metrics against user-defined thresholds and delivers notifications via webhooks and email. Teams can configure alerts for error rate spikes, slow responses, job failures, and downtime.

## Motivation

SidMonitor collects rich metrics but currently requires manual dashboard monitoring to detect issues. An alerting system would:

- Notify teams immediately when metrics breach thresholds
- Reduce mean time to detection (MTTD) for production incidents
- Serve as the foundation for on-call workflows and escalation
- Integrate with existing team tools (Slack via webhook, PagerDuty, email)

## Technical Design

### 1. PostgreSQL Schema — Alert Rules & History

```sql
CREATE TABLE alert_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT DEFAULT '',
    metric          VARCHAR(100) NOT NULL,      -- e.g., 'error_rate', 'p95_latency', 'job_failure_rate'
    condition       VARCHAR(20) NOT NULL,        -- 'gt', 'lt', 'gte', 'lte', 'eq'
    threshold       FLOAT NOT NULL,
    window_minutes  INTEGER NOT NULL DEFAULT 5,  -- evaluation window
    cooldown_minutes INTEGER NOT NULL DEFAULT 15, -- min time between alerts
    channel         VARCHAR(50) NOT NULL,        -- 'webhook', 'email'
    channel_config  JSONB NOT NULL DEFAULT '{}', -- { "url": "..." } or { "to": ["..."] }
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    severity        VARCHAR(20) NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'critical'
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE alert_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id         UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL,
    triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metric_value    FLOAT NOT NULL,
    threshold       FLOAT NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'fired', -- 'fired', 'resolved', 'acknowledged'
    notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
    notification_error TEXT DEFAULT NULL,
    resolved_at     TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_alert_rules_project ON alert_rules(project_id) WHERE enabled = TRUE;
CREATE INDEX idx_alert_history_rule ON alert_history(rule_id, triggered_at DESC);
```

### 2. Supported Metrics

| Metric Key | Description | Source |
|------------|-------------|--------|
| `inbound_error_rate` | % of inbound requests with 5xx status | `logs` table |
| `inbound_p95_latency` | 95th percentile response time (ms) | `logs` table |
| `outbound_error_rate` | % of outbound requests failing | `outbound_logs` table |
| `outbound_p95_latency` | 95th percentile outbound latency (ms) | `outbound_logs` table |
| `job_failure_rate` | % of jobs with status 'failed' | `job_logs` table |
| `job_avg_duration` | Average job execution time (ms) | `job_logs` table |
| `scheduled_task_failure_rate` | % of scheduled tasks failing | `scheduled_task_logs` table |
| `health_check_downtime` | Health check returning non-200 (requires proposal 001) | `health_check_logs` table |

### 3. Background Alert Evaluator

New service: `backend/app/services/alert_evaluator.py`

Architecture:
- Runs as an asyncio background task in the FastAPI process
- **Evaluation loop**: every 60 seconds, fetch all enabled rules, grouped by project
- For each rule: query the relevant ClickHouse materialized view for the metric value over the rule's `window_minutes`
- Compare metric value against threshold using the rule's condition
- If threshold breached and cooldown has elapsed → fire alert
- Insert into `alert_history`, dispatch notification

```python
class AlertEvaluator:
    def __init__(self, db: AsyncSession, clickhouse: Client):
        self.db = db
        self.clickhouse = clickhouse
        self._metric_queries: dict[str, Callable] = {
            'inbound_error_rate': self._query_inbound_error_rate,
            'inbound_p95_latency': self._query_inbound_p95_latency,
            # ...
        }

    async def evaluate_all(self):
        rules = await self._get_enabled_rules()
        for rule in rules:
            value = await self._evaluate_metric(rule)
            if self._threshold_breached(rule, value):
                if self._cooldown_elapsed(rule):
                    await self._fire_alert(rule, value)

    async def _fire_alert(self, rule: AlertRule, value: float):
        # Insert history record
        # Dispatch notification via channel
        pass
```

### 4. Notification Channels

**Webhook** (Phase 1):
- `POST` to configured URL with JSON payload:

```json
{
    "alert": "High Error Rate",
    "project": "my-app",
    "metric": "inbound_error_rate",
    "value": 12.5,
    "threshold": 5.0,
    "condition": "gt",
    "severity": "critical",
    "triggered_at": "2026-03-13T10:30:00Z",
    "dashboard_url": "https://app.sidmonitor.com/org/project/dashboard"
}
```

- Timeout: 10 seconds, no retries (fire-and-forget for v1)
- Record success/failure in `alert_history.notification_error`

**Email** (Phase 2):
- Use an async email service (e.g., SMTP via `aiosmtplib` or a transactional API)
- Template: HTML email with metric value, threshold, link to dashboard
- Configurable recipients per rule

### 5. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/alerts/rules` | List all alert rules for project |
| `POST` | `/api/v1/alerts/rules` | Create new alert rule |
| `PATCH` | `/api/v1/alerts/rules/{rule_id}` | Update alert rule |
| `DELETE` | `/api/v1/alerts/rules/{rule_id}` | Delete alert rule |
| `GET` | `/api/v1/alerts/history` | Alert history with pagination + filters |
| `PATCH` | `/api/v1/alerts/history/{id}/acknowledge` | Acknowledge a fired alert |
| `POST` | `/api/v1/alerts/rules/{rule_id}/test` | Test-fire an alert (sends notification without recording history) |

### 6. Frontend

**Settings page** — new "Alerts" tab in `frontend/src/pages/Settings.tsx`:

- Alert rules table: name, metric, condition, threshold, channel, enabled toggle, actions
- Create/edit modal:
  - Metric dropdown (grouped by category: Inbound, Outbound, Jobs, Tasks)
  - Condition selector (>, <, >=, <=, =)
  - Threshold number input
  - Window dropdown (1m, 5m, 15m, 30m, 1h)
  - Channel selector (Webhook / Email) with config fields
  - Severity selector (Info / Warning / Critical)
  - Test button
- Alert history section: table with triggered_at, metric_value, status, notification status

**Dashboard** — optional alert indicator:
- Small bell icon with count of recent unacknowledged alerts
- Click opens a flyout with recent alert history

## Files to Modify

| Layer | File | Change |
|-------|------|--------|
| DB Migration | `database/migrations/` | Create `alert_rules` + `alert_history` tables |
| Model | `backend/app/models/database.py` | Add AlertRule, AlertHistory SQLAlchemy models |
| Model | `backend/app/models/alerts.py` | New — Pydantic request/response schemas |
| Service | `backend/app/services/alert_evaluator.py` | New — background evaluation loop |
| Service | `backend/app/services/alert_notifier.py` | New — webhook + email dispatch |
| Service | `backend/app/services/alert_service.py` | New — CRUD + history queries |
| API | `backend/app/api/alerts.py` | New — rule CRUD + history + test endpoints |
| API | `backend/app/main.py` | Register alerts router, start evaluator on startup |
| Frontend | `frontend/src/pages/Settings.tsx` | Alerts tab with rule management |
| Frontend | `frontend/src/components/alerts/` | New — AlertRuleForm, AlertHistoryTable |
| Frontend | `frontend/src/hooks/useAlerts.ts` | New — React Query hooks |
| Frontend | `frontend/src/api/client.ts` | Add alerts API namespace |

## Implementation Steps

1. **PostgreSQL migration** — create `alert_rules` and `alert_history` tables
2. **Backend models** — SQLAlchemy + Pydantic schemas for rules and history
3. **Alert service** — CRUD operations for rules, query history
4. **Alert evaluator** — background loop, metric queries against ClickHouse materialized views
5. **Alert notifier** — webhook delivery with error recording
6. **API endpoints** — rule CRUD, history, test-fire; register router
7. **Frontend settings** — alerts tab with rule management UI
8. **Dashboard indicator** — bell icon with unacknowledged alert count
9. **Email channel** (Phase 2) — SMTP integration, HTML templates
10. **Testing** — unit tests for evaluator logic, integration test for webhook delivery

## Effort Estimate

| Component | Estimate |
|-----------|----------|
| PostgreSQL schema + models | 1 day |
| Alert evaluator (background loop + metric queries) | 2–3 days |
| Notification delivery (webhook) | 0.5 day |
| API endpoints | 1 day |
| Frontend (settings + dashboard indicator) | 2 days |
| Email channel (Phase 2) | 1 day |
| Testing | 1 day |
| **Total** | **8–10 days** |
