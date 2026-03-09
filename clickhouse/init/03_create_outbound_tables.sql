-- Create outbound_logs table for storing outbound HTTP request logs
CREATE TABLE IF NOT EXISTS sid_monitoring.outbound_logs (
    -- Auto-generated ID
    id UUID DEFAULT generateUUIDv4(),

    -- Multi-tenancy
    project_id String,

    -- Identifiers for distributed tracing
    request_id String,
    parent_request_id String DEFAULT '',
    trace_id String DEFAULT '',
    span_id String DEFAULT '',

    -- Timing
    timestamp DateTime64(3),

    -- Service Info
    service_name LowCardinality(String),
    target_host LowCardinality(String),
    target_url String,

    -- Request Details
    method LowCardinality(String),

    -- Response
    status_code UInt16,
    latency_ms Float32,
    is_success UInt8 DEFAULT 1,

    -- Sizes
    request_size UInt32 DEFAULT 0,
    response_size UInt32 DEFAULT 0,

    -- Error Info
    error_message String DEFAULT '',
    error_code String DEFAULT '',
    retry_count UInt8 DEFAULT 0,

    -- Context
    module LowCardinality(String) DEFAULT '',
    user_id String DEFAULT '',

    -- Optional: Headers & Body (JSON strings)
    request_headers String DEFAULT '',
    response_headers String DEFAULT '',
    request_body String DEFAULT '',
    response_body String DEFAULT '',

    -- Custom
    tags Array(String) DEFAULT [],
    metadata String DEFAULT '',

    -- Audit
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp, service_name, request_id)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Indexes for outbound_logs
CREATE INDEX IF NOT EXISTS idx_outbound_service_name ON sid_monitoring.outbound_logs (service_name) TYPE set(100) GRANULARITY 4;
CREATE INDEX IF NOT EXISTS idx_outbound_status_code ON sid_monitoring.outbound_logs (status_code) TYPE minmax GRANULARITY 4;
CREATE INDEX IF NOT EXISTS idx_outbound_is_success ON sid_monitoring.outbound_logs (is_success) TYPE minmax GRANULARITY 4;
CREATE INDEX IF NOT EXISTS idx_outbound_target_host ON sid_monitoring.outbound_logs (target_host) TYPE set(100) GRANULARITY 4;
CREATE INDEX IF NOT EXISTS idx_outbound_parent_request ON sid_monitoring.outbound_logs (parent_request_id) TYPE bloom_filter() GRANULARITY 4;
CREATE INDEX IF NOT EXISTS idx_outbound_trace_id ON sid_monitoring.outbound_logs (trace_id) TYPE bloom_filter() GRANULARITY 4;

-- Materialized view for hourly outbound statistics
CREATE TABLE IF NOT EXISTS sid_monitoring.outbound_stats_hourly (
    hour DateTime,
    project_id String,
    service_name LowCardinality(String),
    request_count UInt64,
    total_latency_ms Float64,
    min_latency_ms Float32,
    max_latency_ms Float32,
    success_count UInt64,
    failure_count UInt64,
    server_error_count UInt64,
    client_error_count UInt64,
    total_retries UInt64,
    total_request_bytes UInt64,
    total_response_bytes UInt64
) ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, hour, service_name);

CREATE MATERIALIZED VIEW IF NOT EXISTS sid_monitoring.outbound_stats_hourly_mv
TO sid_monitoring.outbound_stats_hourly
AS SELECT
    toStartOfHour(timestamp) AS hour,
    project_id,
    service_name,
    count() AS request_count,
    sum(latency_ms) AS total_latency_ms,
    min(latency_ms) AS min_latency_ms,
    max(latency_ms) AS max_latency_ms,
    countIf(is_success = 1) AS success_count,
    countIf(is_success = 0) AS failure_count,
    countIf(status_code >= 500) AS server_error_count,
    countIf(status_code >= 400 AND status_code < 500) AS client_error_count,
    sum(retry_count) AS total_retries,
    sum(request_size) AS total_request_bytes,
    sum(response_size) AS total_response_bytes
FROM sid_monitoring.outbound_logs
GROUP BY hour, project_id, service_name;

-- Aggregating table for outbound latency percentiles
CREATE TABLE IF NOT EXISTS sid_monitoring.outbound_percentile_stats_hourly (
    hour DateTime,
    project_id String,
    service_name LowCardinality(String),
    execution_count AggregateFunction(count),
    latency_p50 AggregateFunction(quantile(0.50), Float32),
    latency_p95 AggregateFunction(quantile(0.95), Float32),
    latency_p99 AggregateFunction(quantile(0.99), Float32)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, hour, service_name);

CREATE MATERIALIZED VIEW IF NOT EXISTS sid_monitoring.outbound_percentile_stats_hourly_mv
TO sid_monitoring.outbound_percentile_stats_hourly
AS SELECT
    toStartOfHour(timestamp) AS hour,
    project_id,
    service_name,
    countState() AS execution_count,
    quantileState(0.50)(latency_ms) AS latency_p50,
    quantileState(0.95)(latency_ms) AS latency_p95,
    quantileState(0.99)(latency_ms) AS latency_p99
FROM sid_monitoring.outbound_logs
WHERE latency_ms > 0
GROUP BY hour, project_id, service_name;
