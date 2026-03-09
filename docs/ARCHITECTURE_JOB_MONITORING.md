# Architecture Specification: Laravel Cron/Job Health Monitoring

## Overview
Extend SidMonitor to track Laravel scheduled tasks (cron) and queue jobs, providing health metrics, failure alerts, and execution history.

---

## 1. ClickHouse Schema

### 1.1 Table: job_logs
Captures all Laravel queue job executions.

```sql
CREATE TABLE IF NOT EXISTS job_logs
(
    -- Primary identifiers
    job_id              String,
    job_uuid            String DEFAULT '',
    project_id          UUID,

    -- Timestamp (partition key)
    timestamp           DateTime64(3),

    -- Job information
    job_class           String,
    job_name            String,
    queue_name          LowCardinality(String) DEFAULT 'default',
    connection          LowCardinality(String) DEFAULT 'sync',

    -- Execution details
    status              LowCardinality(String), -- 'started', 'completed', 'failed', 'retrying'
    started_at          DateTime64(3),
    completed_at        Nullable(DateTime64(3)),
    duration_ms         Nullable(UInt32),

    -- Job context
    payload             String DEFAULT '{}',
    attempt_number      UInt8 DEFAULT 1,
    max_attempts        UInt8 DEFAULT 1,

    -- Error tracking
    exception_class     String DEFAULT '',
    exception_message   String DEFAULT '',
    exception_trace     String DEFAULT '',

    -- User context (if job triggered by user action)
    user_id             String DEFAULT '',

    -- Memory and resource usage
    memory_usage_mb     Nullable(Float32),

    -- Additional metadata
    metadata            String DEFAULT '{}'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp, queue_name, job_class, job_id)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Indexes for common query patterns
ALTER TABLE job_logs ADD INDEX idx_status (status) TYPE set(10) GRANULARITY 4;
ALTER TABLE job_logs ADD INDEX idx_job_class (job_class) TYPE bloom_filter() GRANULARITY 4;
ALTER TABLE job_logs ADD INDEX idx_queue_name (queue_name) TYPE set(50) GRANULARITY 4;
ALTER TABLE job_logs ADD INDEX idx_exception_class (exception_class) TYPE bloom_filter() GRANULARITY 4;
```

### 1.2 Table: scheduled_task_logs
Captures Laravel scheduled tasks (Artisan scheduler).

```sql
CREATE TABLE IF NOT EXISTS scheduled_task_logs
(
    -- Primary identifiers
    task_id             String,
    project_id          UUID,

    -- Timestamp (partition key)
    timestamp           DateTime64(3),

    -- Task information
    command             String,
    description         String DEFAULT '',
    expression          String, -- Cron expression
    timezone            String DEFAULT 'UTC',

    -- Execution details
    status              LowCardinality(String), -- 'scheduled', 'running', 'completed', 'failed', 'skipped', 'missed'
    scheduled_at        DateTime64(3),
    started_at          Nullable(DateTime64(3)),
    completed_at        Nullable(DateTime64(3)),
    duration_ms         Nullable(UInt32),

    -- Execution context
    exit_code           Nullable(Int16),
    output              String DEFAULT '',

    -- Error tracking
    error_message       String DEFAULT '',
    error_trace         String DEFAULT '',

    -- Overlap prevention
    without_overlapping UInt8 DEFAULT 0,
    mutex_name          String DEFAULT '',

    -- Expected vs actual tracking
    expected_run_time   DateTime64(3), -- When it should have run
    delay_ms            Nullable(Int32), -- Actual start - expected start

    -- Additional metadata
    metadata            String DEFAULT '{}'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp, command, task_id)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Indexes for common query patterns
ALTER TABLE scheduled_task_logs ADD INDEX idx_status (status) TYPE set(10) GRANULARITY 4;
ALTER TABLE scheduled_task_logs ADD INDEX idx_command (command) TYPE bloom_filter() GRANULARITY 4;
ALTER TABLE scheduled_task_logs ADD INDEX idx_exit_code (exit_code) TYPE minmax GRANULARITY 4;
```

### 1.3 Materialized View: job_stats_hourly
Aggregated job statistics for performance.

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS job_stats_hourly
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour, project_id, queue_name, job_class, status)
AS SELECT
    toStartOfHour(timestamp) AS hour,
    project_id,
    queue_name,
    job_class,
    status,
    count() AS execution_count,
    sum(duration_ms) AS total_duration_ms,
    min(duration_ms) AS min_duration_ms,
    max(duration_ms) AS max_duration_ms,
    countIf(status = 'failed') AS failure_count,
    countIf(status = 'completed') AS success_count,
    sum(attempt_number) AS total_attempts
FROM job_logs
WHERE duration_ms IS NOT NULL
GROUP BY hour, project_id, queue_name, job_class, status;
```

### 1.4 Materialized View: scheduled_task_stats_daily
Aggregated scheduler statistics.

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS scheduled_task_stats_daily
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (day, project_id, command, status)
AS SELECT
    toStartOfDay(timestamp) AS day,
    project_id,
    command,
    status,
    count() AS execution_count,
    sum(duration_ms) AS total_duration_ms,
    avg(duration_ms) AS avg_duration_ms,
    countIf(status = 'completed') AS success_count,
    countIf(status = 'failed') AS failure_count,
    countIf(status = 'missed') AS missed_count,
    avg(delay_ms) AS avg_delay_ms
FROM scheduled_task_logs
WHERE duration_ms IS NOT NULL
GROUP BY day, project_id, command, status;
```

---

## 2. API Endpoints

### 2.1 Ingest Endpoints

#### POST /api/v1/ingest/job
Ingest single job log entry.

**Headers:**
- `X-API-Key: <project_api_key>`

**Request Body:**
```json
{
  "job_id": "unique-job-id",
  "job_uuid": "laravel-job-uuid",
  "job_class": "App\\Jobs\\ProcessPayment",
  "job_name": "process-payment",
  "queue_name": "payments",
  "connection": "redis",
  "status": "completed",
  "started_at": "2025-12-14T10:30:00.000Z",
  "completed_at": "2025-12-14T10:30:05.234Z",
  "duration_ms": 5234,
  "attempt_number": 1,
  "max_attempts": 3,
  "user_id": "user-123",
  "memory_usage_mb": 45.2,
  "exception_class": "",
  "exception_message": "",
  "metadata": {}
}
```

**Response:**
```json
{
  "success": true,
  "message": "Job log ingested successfully"
}
```

#### POST /api/v1/ingest/scheduled-task
Ingest scheduled task log entry.

**Request Body:**
```json
{
  "task_id": "unique-task-id",
  "command": "app:send-daily-report",
  "description": "Send daily report emails",
  "expression": "0 8 * * *",
  "timezone": "UTC",
  "status": "completed",
  "scheduled_at": "2025-12-14T08:00:00.000Z",
  "started_at": "2025-12-14T08:00:01.123Z",
  "completed_at": "2025-12-14T08:00:15.456Z",
  "duration_ms": 14333,
  "expected_run_time": "2025-12-14T08:00:00.000Z",
  "delay_ms": 1123,
  "exit_code": 0,
  "output": "Report sent successfully",
  "without_overlapping": 1,
  "metadata": {}
}
```

#### POST /api/v1/ingest/batch
Batch ingest jobs and scheduled tasks.

**Request Body:**
```json
{
  "job_logs": [...],
  "scheduled_task_logs": [...]
}
```

### 2.2 Query Endpoints

#### GET /api/v1/jobs
List job executions with filtering.

**Query Parameters:**
- `project_id` (required)
- `queue_name` (optional)
- `job_class` (optional)
- `status` (optional): started, completed, failed, retrying
- `from` (optional): ISO timestamp
- `to` (optional): ISO timestamp
- `page` (default: 1)
- `page_size` (default: 50)

**Response:**
```json
{
  "data": [
    {
      "job_id": "...",
      "job_class": "App\\Jobs\\ProcessPayment",
      "queue_name": "payments",
      "status": "completed",
      "started_at": "...",
      "duration_ms": 5234,
      "attempt_number": 1
    }
  ],
  "total": 1250,
  "page": 1,
  "page_size": 50,
  "total_pages": 25
}
```

#### GET /api/v1/jobs/stats
Job health statistics.

**Query Parameters:**
- `project_id` (required)
- `queue_name` (optional)
- `timeframe` (default: 24h): 1h, 24h, 7d, 30d

**Response:**
```json
{
  "total_executions": 15234,
  "success_count": 14890,
  "failure_count": 344,
  "success_rate": 97.74,
  "avg_duration_ms": 3421,
  "p95_duration_ms": 8500,
  "retry_rate": 2.1,
  "by_queue": [
    {
      "queue_name": "default",
      "executions": 10000,
      "success_rate": 98.5,
      "avg_duration_ms": 2100
    }
  ],
  "by_job_class": [
    {
      "job_class": "App\\Jobs\\ProcessPayment",
      "executions": 5000,
      "failure_count": 50,
      "avg_duration_ms": 5200
    }
  ],
  "recent_failures": [
    {
      "job_id": "...",
      "job_class": "...",
      "exception_class": "PaymentGatewayException",
      "timestamp": "..."
    }
  ]
}
```

#### GET /api/v1/scheduled-tasks
List scheduled task executions.

**Query Parameters:**
- `project_id` (required)
- `command` (optional)
- `status` (optional)
- `from`, `to`, `page`, `page_size`

**Response:**
```json
{
  "data": [
    {
      "task_id": "...",
      "command": "app:send-daily-report",
      "status": "completed",
      "scheduled_at": "...",
      "duration_ms": 14333,
      "delay_ms": 1123,
      "exit_code": 0
    }
  ],
  "total": 500,
  "page": 1,
  "page_size": 50,
  "total_pages": 10
}
```

#### GET /api/v1/scheduled-tasks/stats
Scheduled task health statistics.

**Query Parameters:**
- `project_id` (required)
- `timeframe` (default: 7d)

**Response:**
```json
{
  "total_executions": 420,
  "success_count": 405,
  "failure_count": 10,
  "missed_count": 5,
  "success_rate": 96.43,
  "avg_delay_ms": 523,
  "by_command": [
    {
      "command": "app:send-daily-report",
      "executions": 30,
      "success_rate": 100,
      "avg_duration_ms": 14000,
      "last_run": "2025-12-14T08:00:00.000Z",
      "next_run": "2025-12-15T08:00:00.000Z",
      "missed_count": 0
    }
  ],
  "recent_failures": [...],
  "missed_tasks": [
    {
      "command": "app:cleanup-temp-files",
      "expected_run_time": "2025-12-14T02:00:00.000Z",
      "status": "missed"
    }
  ]
}
```

#### GET /api/v1/jobs/timeline
Time-series data for job executions.

**Response:**
```json
{
  "interval": "hour",
  "data": [
    {
      "timestamp": "2025-12-14T08:00:00.000Z",
      "executions": 450,
      "failures": 12,
      "avg_duration_ms": 3200
    }
  ]
}
```

---

## 3. Laravel SDK Changes

### 3.1 Job Event Listeners

Create event listeners to capture job lifecycle events.

**Files to Add:**
- `src/Listeners/JobProcessingListener.php`
- `src/Listeners/JobProcessedListener.php`
- `src/Listeners/JobFailedListener.php`

**Events to Listen:**
- `Illuminate\Queue\Events\JobProcessing`
- `Illuminate\Queue\Events\JobProcessed`
- `Illuminate\Queue\Events\JobFailed`
- `Illuminate\Queue\Events\JobExceptionOccurred`

**Captured Data:**
- Job class name, UUID, queue name, connection
- Start/end timestamps, duration
- Attempt number, max attempts
- Memory usage (via `memory_get_usage()`)
- Exception details on failure
- Job payload (sanitized, configurable)

### 3.2 Scheduler Event Hooks

Hook into Laravel's scheduler to track task executions.

**Implementation Strategy:**
- Extend `Illuminate\Console\Scheduling\Event`
- Use `before()` and `after()` callbacks on scheduled tasks
- Track scheduled vs actual run times
- Detect missed executions via heartbeat mechanism

**Files to Add:**
- `src/SchedulerMonitor.php`
- `src/Middleware/SchedulerEventCapture.php`

**Tracked Data:**
- Command signature, description, cron expression
- Expected run time vs actual start time
- Exit code, output (truncated)
- Overlap prevention status
- Timezone

### 3.3 Configuration Changes

Update `config/sid-monitoring.php`:

```php
return [
    // ... existing config ...

    'jobs' => [
        'enabled' => env('SID_MONITORING_JOBS_ENABLED', true),
        'queue_names' => ['default', 'high', 'low'], // Monitor specific queues
        'ignore_jobs' => [], // Job classes to ignore
        'capture_payload' => env('SID_MONITORING_CAPTURE_JOB_PAYLOAD', false),
        'payload_max_length' => 1000, // characters
    ],

    'scheduler' => [
        'enabled' => env('SID_MONITORING_SCHEDULER_ENABLED', true),
        'capture_output' => true,
        'output_max_length' => 2000,
        'detect_missed_tasks' => true,
        'missed_threshold_minutes' => 5, // Alert if task delayed by >5min
    ],

    'transport' => [
        'batch_size' => 50,
        'flush_interval' => 30, // seconds
    ],
];
```

### 3.4 Service Provider Registration

Update `SidMonitoringServiceProvider.php`:

```php
public function boot()
{
    // ... existing middleware registration ...

    if (config('sid-monitoring.jobs.enabled')) {
        $this->registerJobListeners();
    }

    if (config('sid-monitoring.scheduler.enabled')) {
        $this->registerSchedulerMonitoring();
    }
}

protected function registerJobListeners()
{
    Event::listen(JobProcessing::class, JobProcessingListener::class);
    Event::listen(JobProcessed::class, JobProcessedListener::class);
    Event::listen(JobFailed::class, JobFailedListener::class);
}

protected function registerSchedulerMonitoring()
{
    $this->app->singleton(SchedulerMonitor::class);
    $this->app->booted(function ($app) {
        $app->make(SchedulerMonitor::class)->register();
    });
}
```

### 3.5 Data Transport

**Batch Transport:**
- Buffer job logs and scheduled task logs separately
- Flush on batch size limit or time interval
- Use existing `QueueTransport` or `SyncTransport`

**API Payload Structure:**
```php
[
    'job_logs' => [
        ['job_id' => '...', 'status' => 'completed', ...],
    ],
    'scheduled_task_logs' => [
        ['task_id' => '...', 'status' => 'completed', ...],
    ]
]
```

### 3.6 Missed Task Detection

**Approach:**
- On `schedule:run` execution, register expected tasks with run times
- Compare actual executions against expected schedule
- Log "missed" status if task doesn't execute within threshold
- Send to monitoring API for alerting

---

## 4. Backend (FastAPI) Changes

### 4.1 New Models

**File: `backend/app/models/job_log.py`**

```python
class JobLogEntry(BaseModel):
    job_id: str
    job_uuid: Optional[str] = None
    job_class: str
    job_name: str
    queue_name: str = "default"
    connection: str = "sync"
    status: str  # started, completed, failed, retrying
    started_at: str
    completed_at: Optional[str] = None
    duration_ms: Optional[int] = None
    payload: Optional[str] = None
    attempt_number: int = 1
    max_attempts: int = 1
    exception_class: Optional[str] = None
    exception_message: Optional[str] = None
    exception_trace: Optional[str] = None
    user_id: Optional[str] = None
    memory_usage_mb: Optional[float] = None
    metadata: Optional[dict] = {}


class ScheduledTaskLogEntry(BaseModel):
    task_id: str
    command: str
    description: Optional[str] = None
    expression: str
    timezone: str = "UTC"
    status: str  # scheduled, running, completed, failed, skipped, missed
    scheduled_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    duration_ms: Optional[int] = None
    exit_code: Optional[int] = None
    output: Optional[str] = None
    error_message: Optional[str] = None
    error_trace: Optional[str] = None
    without_overlapping: bool = False
    mutex_name: Optional[str] = None
    expected_run_time: str
    delay_ms: Optional[int] = None
    metadata: Optional[dict] = {}
```

### 4.2 New API Routes

**File: `backend/app/api/jobs.py`**

```python
from fastapi import APIRouter, Depends, Query
from app.models.job_log import JobLogEntry, ScheduledTaskLogEntry
from app.services.clickhouse import get_clickhouse_client

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])

@router.post("/ingest/job")
async def ingest_job_log(entry: JobLogEntry, project: Project = Depends(verify_project))
    # Insert into job_logs table

@router.post("/ingest/scheduled-task")
async def ingest_scheduled_task(entry: ScheduledTaskLogEntry, project: Project = Depends(verify_project))
    # Insert into scheduled_task_logs table

@router.get("/")
async def list_jobs(project_id: UUID, queue_name: Optional[str] = None, ...)
    # Query job_logs with filters

@router.get("/stats")
async def get_job_stats(project_id: UUID, timeframe: str = "24h")
    # Aggregate statistics from job_stats_hourly

@router.get("/timeline")
async def get_job_timeline(project_id: UUID, interval: str = "hour")
    # Time-series data

@router.get("/scheduled-tasks")
async def list_scheduled_tasks(project_id: UUID, ...)
    # Query scheduled_task_logs

@router.get("/scheduled-tasks/stats")
async def get_scheduled_task_stats(project_id: UUID, timeframe: str = "7d")
    # Aggregate from scheduled_task_stats_daily
```

### 4.3 ClickHouse Service Updates

**File: `backend/app/services/clickhouse.py`**

Add initialization for new tables in `init_database()`:
- Create `job_logs` table
- Create `scheduled_task_logs` table
- Create materialized views

---

## 5. Frontend Components

### 5.1 New Pages

#### `/jobs`
Job monitoring dashboard.

**Components:**
- `JobsOverview`: Stats cards (total executions, success rate, avg duration, failure count)
- `JobTimeline`: Time-series chart of executions/failures
- `JobList`: Paginated table of recent job executions
- `JobFilters`: Filter by queue, job class, status, date range
- `JobHealthByQueue`: Table showing health metrics per queue
- `FailedJobsAlert`: Alert banner for recent failures

#### `/scheduled-tasks`
Scheduled task monitoring.

**Components:**
- `SchedulerOverview`: Stats (total tasks, success rate, missed tasks)
- `TaskList`: Table of scheduled tasks with last/next run times
- `TaskHealthMetrics`: Per-command success rate, avg duration
- `MissedTasksAlert`: Warning for missed executions
- `TaskExecutionHistory`: Timeline of task executions

### 5.2 Shared Components

#### `JobStatusBadge`
Visual badge for job status (completed, failed, retrying).

**Props:**
- `status: string`

#### `DurationDisplay`
Human-readable duration with color coding.

**Props:**
- `durationMs: number`
- `threshold: number` (yellow if exceeded)

#### `QueueHealthIndicator`
Traffic-light indicator for queue health.

**Props:**
- `successRate: number`

#### `CronExpressionDisplay`
Human-readable cron expression.

**Props:**
- `expression: string`
- `nextRun: string`

### 5.3 Dashboard Integration

Add to existing `/dashboard`:
- **Job Health Widget**: Show job success rate, recent failures
- **Scheduler Status Widget**: Last 5 scheduled tasks, missed count

### 5.4 Data Fetching Hooks

**File: `frontend/src/hooks/useJobs.ts`**

```typescript
export function useJobs(filters: JobFilters) {
  // Fetch job logs with pagination
}

export function useJobStats(projectId: string, timeframe: string) {
  // Fetch job statistics
}

export function useScheduledTasks(filters: TaskFilters) {
  // Fetch scheduled task logs
}

export function useScheduledTaskStats(projectId: string, timeframe: string) {
  // Fetch scheduler statistics
}
```

### 5.5 Type Definitions

**File: `frontend/src/types/jobs.ts`**

```typescript
export interface JobLog {
  job_id: string;
  job_class: string;
  queue_name: string;
  status: 'started' | 'completed' | 'failed' | 'retrying';
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  attempt_number: number;
  exception_class?: string;
  exception_message?: string;
}

export interface JobStats {
  total_executions: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  by_queue: QueueHealth[];
  recent_failures: JobLog[];
}

export interface ScheduledTaskLog {
  task_id: string;
  command: string;
  status: 'completed' | 'failed' | 'missed' | 'running';
  scheduled_at: string;
  started_at?: string;
  duration_ms?: number;
  delay_ms?: number;
  exit_code?: number;
}

export interface ScheduledTaskStats {
  total_executions: number;
  success_rate: number;
  missed_count: number;
  by_command: CommandHealth[];
  missed_tasks: ScheduledTaskLog[];
}
```

---

## 6. Data Retention & Aggregation

### 6.1 Retention Policy
- **Raw logs**: 90 days (TTL configured in table schema)
- **Hourly aggregates**: 365 days
- **Daily aggregates**: 2 years

### 6.2 Aggregation Strategy
- Use materialized views for real-time aggregation
- Pre-aggregate job stats by hour (queue, job class, status)
- Pre-aggregate scheduler stats by day (command, status)
- Reduces query load for dashboard rendering

### 6.3 Monitoring Queries
Optimized queries use materialized views:
- Last 24h stats → query `job_stats_hourly`
- Last 30d trends → query `scheduled_task_stats_daily`
- Real-time failures → query raw `job_logs` WHERE status='failed' AND timestamp > now() - 1h

---

## 7. Implementation Phases

### Phase 1: Backend Foundation
1. Create ClickHouse tables and materialized views
2. Add FastAPI models and ingest endpoints
3. Add query endpoints with basic filtering

### Phase 2: Laravel SDK
1. Implement job event listeners
2. Implement scheduler monitoring hooks
3. Add batch transport for jobs/tasks
4. Update configuration and service provider

### Phase 3: Frontend UI
1. Create Jobs page with list and stats
2. Create Scheduled Tasks page
3. Add dashboard widgets
4. Implement filters and pagination

### Phase 4: Alerting (Future)
1. Define alert rules (job failure threshold, missed tasks)
2. Notification channels (email, Slack, webhook)
3. Alert history and acknowledgment

---

## 8. Key Technical Decisions

### Why Separate Tables for Jobs and Scheduled Tasks?
- Different query patterns and access frequency
- Different retention needs (jobs may be more frequent)
- Clearer separation of concerns
- Easier to optimize indexes independently

### Why Materialized Views?
- Real-time aggregation with minimal query overhead
- Dashboard queries remain fast even with millions of job logs
- ClickHouse's SummingMergeTree efficiently handles aggregates

### Why Capture Both Start and End Events?
- Track jobs that start but never complete (stuck jobs)
- Calculate accurate duration
- Detect jobs killed by timeout or OOM

### Missed Task Detection Strategy
- Register expected tasks on `schedule:run`
- Compare actual executions vs expected schedule
- Log "missed" status if delay exceeds threshold
- Avoids false positives from legitimate schedule changes

---

## 9. Migration Path

### Backward Compatibility
- Existing HTTP request monitoring continues unchanged
- New tables do not affect existing `logs` table
- SDK remains compatible with projects not using jobs/scheduler

### Database Migration
```sql
-- Run on ClickHouse
-- Create job_logs table
-- Create scheduled_task_logs table
-- Create materialized views
```

### SDK Update
- Projects using v1.x SDK can upgrade to v2.x
- Enable job/scheduler monitoring via config flags
- No breaking changes to existing middleware

---

## Appendix: Sample Queries

### Find slowest jobs in last 7 days
```sql
SELECT
    job_class,
    queue_name,
    max(duration_ms) AS max_duration,
    avg(duration_ms) AS avg_duration,
    count() AS executions
FROM job_logs
WHERE timestamp >= now() - INTERVAL 7 DAY
  AND status = 'completed'
GROUP BY job_class, queue_name
ORDER BY max_duration DESC
LIMIT 20;
```

### Detect jobs with high retry rates
```sql
SELECT
    job_class,
    queue_name,
    count() AS total_executions,
    countIf(attempt_number > 1) AS retried,
    round(countIf(attempt_number > 1) * 100.0 / count(), 2) AS retry_rate
FROM job_logs
WHERE timestamp >= now() - INTERVAL 24 HOUR
GROUP BY job_class, queue_name
HAVING retry_rate > 10
ORDER BY retry_rate DESC;
```

### Find missed scheduled tasks
```sql
SELECT
    command,
    expected_run_time,
    delay_ms,
    status
FROM scheduled_task_logs
WHERE timestamp >= now() - INTERVAL 7 DAY
  AND status = 'missed'
ORDER BY expected_run_time DESC;
```

### Job execution timeline (hourly)
```sql
SELECT
    toStartOfHour(timestamp) AS hour,
    count() AS executions,
    countIf(status = 'completed') AS success,
    countIf(status = 'failed') AS failures,
    avg(duration_ms) AS avg_duration
FROM job_logs
WHERE timestamp >= now() - INTERVAL 24 HOUR
  AND project_id = '<project-uuid>'
GROUP BY hour
ORDER BY hour;
```

---

**End of Specification**
