-- Create job_logs table for storing Laravel queue job executions
CREATE TABLE IF NOT EXISTS sid_monitoring.job_logs (
    id UUID DEFAULT generateUUIDv4(),
    project_id String,
    timestamp DateTime64(3) DEFAULT now64(3),
    job_id String,
    job_uuid String,
    job_class String,
    job_name String,
    queue_name LowCardinality(String),
    connection LowCardinality(String),
    status LowCardinality(String),
    started_at DateTime64(3),
    completed_at Nullable(DateTime64(3)),
    duration_ms UInt32,
    payload Nullable(String),
    attempt_number UInt8,
    max_attempts UInt8,
    exception_class Nullable(String),
    exception_message Nullable(String),
    exception_trace Nullable(String),
    user_id Nullable(String),
    memory_usage_mb Float32,
    metadata Nullable(String),
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (started_at, job_id)
PARTITION BY toYYYYMM(started_at)
TTL toDateTime(started_at) + INTERVAL 90 DAY;

-- Create scheduled_task_logs table for storing Laravel scheduled task executions
CREATE TABLE IF NOT EXISTS sid_monitoring.scheduled_task_logs (
    id UUID DEFAULT generateUUIDv4(),
    project_id String,
    task_id String,
    command String,
    description String,
    expression String,
    timezone LowCardinality(String),
    status LowCardinality(String),
    scheduled_at DateTime64(3),
    started_at Nullable(DateTime64(3)),
    completed_at Nullable(DateTime64(3)),
    duration_ms UInt32,
    exit_code Int32,
    output Nullable(String),
    error_message Nullable(String),
    error_trace Nullable(String),
    without_overlapping Bool,
    mutex_name Nullable(String),
    expected_run_time DateTime64(3),
    delay_ms Int32,
    metadata Nullable(String),
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (scheduled_at, task_id)
PARTITION BY toYYYYMM(scheduled_at)
TTL toDateTime(scheduled_at) + INTERVAL 90 DAY;

-- Indexes for job_logs
CREATE INDEX IF NOT EXISTS idx_job_status ON sid_monitoring.job_logs (status) TYPE minmax GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_job_queue ON sid_monitoring.job_logs (queue_name) TYPE bloom_filter GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_job_class ON sid_monitoring.job_logs (job_class) TYPE bloom_filter GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_job_user ON sid_monitoring.job_logs (user_id) TYPE bloom_filter GRANULARITY 1;

-- Indexes for scheduled_task_logs
CREATE INDEX IF NOT EXISTS idx_task_status ON sid_monitoring.scheduled_task_logs (status) TYPE minmax GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_task_command ON sid_monitoring.scheduled_task_logs (command) TYPE bloom_filter GRANULARITY 1;

-- Materialized view for hourly job statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS sid_monitoring.job_stats_hourly
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour, project_id, queue_name, job_class, status)
AS SELECT
    toStartOfHour(started_at) AS hour,
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
FROM sid_monitoring.job_logs
WHERE duration_ms IS NOT NULL
GROUP BY hour, project_id, queue_name, job_class, status;

-- Materialized view for daily scheduled task statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS sid_monitoring.scheduled_task_stats_daily
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (day, project_id, command, status)
AS SELECT
    toStartOfDay(scheduled_at) AS day,
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
FROM sid_monitoring.scheduled_task_logs
WHERE duration_ms IS NOT NULL
GROUP BY day, project_id, command, status;

-- Aggregating table for job percentile metrics (P95, P99)
CREATE TABLE IF NOT EXISTS sid_monitoring.job_percentile_stats_hourly (
    hour DateTime,
    project_id String,
    queue_name LowCardinality(String),
    job_class String,
    execution_count AggregateFunction(count),
    duration_p50 AggregateFunction(quantile(0.50), UInt32),
    duration_p95 AggregateFunction(quantile(0.95), UInt32),
    duration_p99 AggregateFunction(quantile(0.99), UInt32),
    success_count AggregateFunction(countIf, UInt8),
    failure_count AggregateFunction(countIf, UInt8)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour, project_id, queue_name, job_class);

-- Materialized view to populate job percentile stats
CREATE MATERIALIZED VIEW IF NOT EXISTS sid_monitoring.job_percentile_stats_hourly_mv
TO sid_monitoring.job_percentile_stats_hourly
AS SELECT
    toStartOfHour(started_at) AS hour,
    project_id,
    queue_name,
    job_class,
    countState() AS execution_count,
    quantileState(0.50)(duration_ms) AS duration_p50,
    quantileState(0.95)(duration_ms) AS duration_p95,
    quantileState(0.99)(duration_ms) AS duration_p99,
    countIfState(status = 'completed' OR status = 'success') AS success_count,
    countIfState(status = 'failed') AS failure_count
FROM sid_monitoring.job_logs
WHERE duration_ms > 0
GROUP BY hour, project_id, queue_name, job_class;

-- Table for job status timeline (count by status over time)
CREATE TABLE IF NOT EXISTS sid_monitoring.job_status_timeline_hourly (
    hour DateTime,
    project_id String,
    status LowCardinality(String),
    count UInt64
) ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour, project_id, status);

-- Materialized view for job status timeline
CREATE MATERIALIZED VIEW IF NOT EXISTS sid_monitoring.job_status_timeline_hourly_mv
TO sid_monitoring.job_status_timeline_hourly
AS SELECT
    toStartOfHour(started_at) AS hour,
    project_id,
    status,
    count() AS count
FROM sid_monitoring.job_logs
GROUP BY hour, project_id, status;

-- Aggregating table for scheduled task percentile metrics
CREATE TABLE IF NOT EXISTS sid_monitoring.scheduled_task_percentile_stats_daily (
    day DateTime,
    project_id String,
    command String,
    execution_count AggregateFunction(count),
    duration_p50 AggregateFunction(quantile(0.50), UInt32),
    duration_p95 AggregateFunction(quantile(0.95), UInt32),
    duration_p99 AggregateFunction(quantile(0.99), UInt32),
    delay_p95 AggregateFunction(quantile(0.95), Int32)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (day, project_id, command);

-- Materialized view to populate scheduled task percentile stats
CREATE MATERIALIZED VIEW IF NOT EXISTS sid_monitoring.scheduled_task_percentile_stats_daily_mv
TO sid_monitoring.scheduled_task_percentile_stats_daily
AS SELECT
    toStartOfDay(scheduled_at) AS day,
    project_id,
    command,
    countState() AS execution_count,
    quantileState(0.50)(duration_ms) AS duration_p50,
    quantileState(0.95)(duration_ms) AS duration_p95,
    quantileState(0.99)(duration_ms) AS duration_p99,
    quantileState(0.95)(delay_ms) AS delay_p95
FROM sid_monitoring.scheduled_task_logs
WHERE duration_ms > 0
GROUP BY day, project_id, command;
