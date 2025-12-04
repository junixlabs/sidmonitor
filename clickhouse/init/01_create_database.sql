-- Create database
CREATE DATABASE IF NOT EXISTS sid_monitoring;

-- Create logs table for storing request logs
CREATE TABLE IF NOT EXISTS sid_monitoring.logs (
    id UUID DEFAULT generateUUIDv4(),
    request_id String,
    timestamp DateTime64(3),
    endpoint String,
    method LowCardinality(String),
    status_code UInt16,
    response_time_ms Float64,
    user_id Nullable(String),
    user_name Nullable(String),
    module LowCardinality(Nullable(String)),
    tags Array(String),
    is_outbound Bool DEFAULT false,
    third_party_service LowCardinality(Nullable(String)),
    request_body Nullable(String),
    response_body Nullable(String),
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (timestamp, request_id)
PARTITION BY toYYYYMM(timestamp)
TTL timestamp + INTERVAL 90 DAY;

-- Create materialized view for statistics
CREATE TABLE IF NOT EXISTS sid_monitoring.stats_hourly (
    hour DateTime,
    endpoint String,
    method LowCardinality(String),
    total_requests UInt64,
    error_count UInt64,
    avg_response_time Float64,
    p95_response_time Float64,
    p99_response_time Float64
) ENGINE = SummingMergeTree()
ORDER BY (hour, endpoint, method)
PARTITION BY toYYYYMM(hour);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_status ON sid_monitoring.logs (status_code) TYPE minmax GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_module ON sid_monitoring.logs (module) TYPE bloom_filter GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_user ON sid_monitoring.logs (user_id) TYPE bloom_filter GRANULARITY 1;
