-- ClickHouse Schema for Log Monitoring Dashboard
-- Project: Sid Monitoring
-- Designed by: DA Agent
-- Date: 2025-12-04

-- =============================================================================
-- DATABASE SETUP
-- =============================================================================

CREATE DATABASE IF NOT EXISTS sid_monitoring;

USE sid_monitoring;

-- =============================================================================
-- TABLE: inbound_requests
-- Purpose: Store all incoming HTTP requests to the Laravel backend
-- =============================================================================

CREATE TABLE IF NOT EXISTS inbound_requests
(
    -- Primary identifiers
    request_id          String,
    trace_id            String DEFAULT '',

    -- Timestamp (partition key)
    timestamp           DateTime64(3),

    -- Request information
    method              LowCardinality(String),
    endpoint            String,
    path                String,
    query_string        String DEFAULT '',

    -- User context
    user_id             String DEFAULT '',
    user_email          String DEFAULT '',

    -- Application context
    module              LowCardinality(String) DEFAULT '',
    tags                Array(String) DEFAULT [],

    -- Response information
    status_code         UInt16,
    response_time_ms    UInt32,
    response_size_bytes UInt32 DEFAULT 0,

    -- Request metadata
    ip_address          String DEFAULT '',
    user_agent          String DEFAULT '',

    -- Error tracking
    error_message       String DEFAULT '',
    error_class         String DEFAULT '',

    -- Additional context (JSON for flexibility)
    metadata            String DEFAULT '{}'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, module, endpoint, request_id)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- =============================================================================
-- TABLE: outbound_requests
-- Purpose: Store all outgoing requests to third-party APIs
-- =============================================================================

CREATE TABLE IF NOT EXISTS outbound_requests
(
    -- Primary identifiers
    request_id          String,
    parent_request_id   String DEFAULT '',
    trace_id            String DEFAULT '',

    -- Timestamp (partition key)
    timestamp           DateTime64(3),

    -- Target service information
    service_name        LowCardinality(String),
    service_url         String,
    method              LowCardinality(String),
    endpoint            String,

    -- Request context (from parent inbound request)
    module              LowCardinality(String) DEFAULT '',
    user_id             String DEFAULT '',

    -- Response information
    status_code         UInt16,
    response_time_ms    UInt32,
    response_size_bytes UInt32 DEFAULT 0,

    -- Error tracking
    is_success          UInt8 DEFAULT 1,
    error_message       String DEFAULT '',
    error_code          String DEFAULT '',

    -- Retry information
    retry_count         UInt8 DEFAULT 0,

    -- Additional context (JSON for flexibility)
    request_headers     String DEFAULT '{}',
    response_headers    String DEFAULT '{}',
    metadata            String DEFAULT '{}'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, service_name, endpoint, request_id)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- =============================================================================
-- INDEXES for common query patterns
-- =============================================================================

-- Indexes for inbound_requests
ALTER TABLE inbound_requests ADD INDEX idx_status_code (status_code) TYPE minmax GRANULARITY 4;
ALTER TABLE inbound_requests ADD INDEX idx_user_id (user_id) TYPE bloom_filter() GRANULARITY 4;
ALTER TABLE inbound_requests ADD INDEX idx_module (module) TYPE set(100) GRANULARITY 4;
ALTER TABLE inbound_requests ADD INDEX idx_endpoint (endpoint) TYPE bloom_filter() GRANULARITY 4;
ALTER TABLE inbound_requests ADD INDEX idx_error_class (error_class) TYPE bloom_filter() GRANULARITY 4;

-- Indexes for outbound_requests
ALTER TABLE outbound_requests ADD INDEX idx_service_name (service_name) TYPE set(50) GRANULARITY 4;
ALTER TABLE outbound_requests ADD INDEX idx_status_code_out (status_code) TYPE minmax GRANULARITY 4;
ALTER TABLE outbound_requests ADD INDEX idx_is_success (is_success) TYPE minmax GRANULARITY 4;
ALTER TABLE outbound_requests ADD INDEX idx_parent_request (parent_request_id) TYPE bloom_filter() GRANULARITY 4;

-- =============================================================================
-- MATERIALIZED VIEWS for aggregated statistics
-- =============================================================================

-- Hourly statistics for inbound requests
CREATE MATERIALIZED VIEW IF NOT EXISTS inbound_stats_hourly
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour, module, endpoint, status_code)
AS SELECT
    toStartOfHour(timestamp) AS hour,
    module,
    endpoint,
    status_code,
    count() AS request_count,
    sum(response_time_ms) AS total_response_time_ms,
    min(response_time_ms) AS min_response_time_ms,
    max(response_time_ms) AS max_response_time_ms,
    countIf(status_code >= 400) AS error_count,
    countIf(status_code >= 500) AS server_error_count
FROM inbound_requests
GROUP BY hour, module, endpoint, status_code;

-- Hourly statistics for outbound requests
CREATE MATERIALIZED VIEW IF NOT EXISTS outbound_stats_hourly
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour, service_name, endpoint, status_code)
AS SELECT
    toStartOfHour(timestamp) AS hour,
    service_name,
    endpoint,
    status_code,
    count() AS request_count,
    sum(response_time_ms) AS total_response_time_ms,
    min(response_time_ms) AS min_response_time_ms,
    max(response_time_ms) AS max_response_time_ms,
    countIf(is_success = 0) AS failure_count,
    sum(retry_count) AS total_retries
FROM outbound_requests
GROUP BY hour, service_name, endpoint, status_code;

-- Daily user activity summary
CREATE MATERIALIZED VIEW IF NOT EXISTS user_activity_daily
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (day, user_id, module)
AS SELECT
    toStartOfDay(timestamp) AS day,
    user_id,
    module,
    count() AS request_count,
    countDistinct(endpoint) AS unique_endpoints,
    countIf(status_code >= 400) AS error_count
FROM inbound_requests
WHERE user_id != ''
GROUP BY day, user_id, module;

-- =============================================================================
-- SAMPLE QUERIES for dashboard
-- =============================================================================

-- Query: Overview metrics for last 24 hours
-- SELECT
--     count() AS total_requests,
--     countIf(status_code >= 400) AS error_requests,
--     round(countIf(status_code >= 400) * 100.0 / count(), 2) AS error_rate,
--     avg(response_time_ms) AS avg_response_time,
--     quantile(0.95)(response_time_ms) AS p95_response_time
-- FROM inbound_requests
-- WHERE timestamp >= now() - INTERVAL 24 HOUR;

-- Query: Request volume by hour
-- SELECT
--     toStartOfHour(timestamp) AS hour,
--     count() AS requests,
--     countIf(status_code >= 400) AS errors
-- FROM inbound_requests
-- WHERE timestamp >= now() - INTERVAL 24 HOUR
-- GROUP BY hour
-- ORDER BY hour;

-- Query: Top endpoints by request count
-- SELECT
--     endpoint,
--     count() AS requests,
--     avg(response_time_ms) AS avg_response_time,
--     countIf(status_code >= 400) AS errors
-- FROM inbound_requests
-- WHERE timestamp >= now() - INTERVAL 24 HOUR
-- GROUP BY endpoint
-- ORDER BY requests DESC
-- LIMIT 10;

-- Query: Third-party service health
-- SELECT
--     service_name,
--     count() AS total_requests,
--     countIf(is_success = 1) AS successful,
--     countIf(is_success = 0) AS failed,
--     round(countIf(is_success = 1) * 100.0 / count(), 2) AS success_rate,
--     avg(response_time_ms) AS avg_response_time
-- FROM outbound_requests
-- WHERE timestamp >= now() - INTERVAL 24 HOUR
-- GROUP BY service_name
-- ORDER BY total_requests DESC;
