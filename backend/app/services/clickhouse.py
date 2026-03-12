from functools import lru_cache

import clickhouse_connect

from app.config import get_settings


@lru_cache()
def get_clickhouse_client():
    """Get ClickHouse client instance."""
    settings = get_settings()
    return clickhouse_connect.get_client(
        host=settings.clickhouse_host,
        port=settings.clickhouse_port,
        database=settings.clickhouse_database,
        username=settings.clickhouse_user,
        password=settings.clickhouse_password,
    )


def init_database():
    """Initialize database schema."""
    client = get_clickhouse_client()

    # Create logs table
    client.command("""
        CREATE TABLE IF NOT EXISTS logs (
            id UUID DEFAULT generateUUIDv4(),
            request_id String,
            timestamp DateTime64(3) DEFAULT now64(3),
            endpoint String,
            method LowCardinality(String),
            status_code UInt16,
            response_time_ms Float32,
            user_id String DEFAULT '',
            user_name String DEFAULT '',
            module LowCardinality(String) DEFAULT '',
            tags Array(String) DEFAULT [],
            is_outbound UInt8 DEFAULT 0,
            third_party_service String DEFAULT '',
            request_body String DEFAULT '',
            response_body String DEFAULT ''
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (timestamp, endpoint, request_id)
        TTL toDateTime(timestamp) + toIntervalDay(90)
        SETTINGS index_granularity = 8192
    """)

    # Create job_logs table
    client.command("""
        CREATE TABLE IF NOT EXISTS job_logs (
            job_id String,
            job_uuid String DEFAULT '',
            project_id UUID,
            timestamp DateTime64(3),
            job_class String,
            job_name String,
            queue_name LowCardinality(String) DEFAULT 'default',
            connection LowCardinality(String) DEFAULT 'sync',
            status LowCardinality(String),
            started_at DateTime64(3),
            completed_at Nullable(DateTime64(3)),
            duration_ms Nullable(UInt32),
            payload String DEFAULT '{}',
            attempt_number UInt8 DEFAULT 1,
            max_attempts UInt8 DEFAULT 1,
            exception_class String DEFAULT '',
            exception_message String DEFAULT '',
            exception_trace String DEFAULT '',
            user_id String DEFAULT '',
            memory_usage_mb Nullable(Float32),
            metadata String DEFAULT '{}'
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (project_id, timestamp, queue_name, job_class, job_id)
        TTL toDateTime(timestamp) + INTERVAL 90 DAY
        SETTINGS index_granularity = 8192
    """)

    # Create scheduled_task_logs table
    client.command("""
        CREATE TABLE IF NOT EXISTS scheduled_task_logs (
            task_id String,
            project_id UUID,
            timestamp DateTime64(3),
            command String,
            description String DEFAULT '',
            expression String,
            timezone String DEFAULT 'UTC',
            status LowCardinality(String),
            scheduled_at DateTime64(3),
            started_at Nullable(DateTime64(3)),
            completed_at Nullable(DateTime64(3)),
            duration_ms Nullable(UInt32),
            exit_code Nullable(Int16),
            output String DEFAULT '',
            error_message String DEFAULT '',
            error_trace String DEFAULT '',
            without_overlapping UInt8 DEFAULT 0,
            mutex_name String DEFAULT '',
            expected_run_time DateTime64(3),
            delay_ms Nullable(Int32),
            metadata String DEFAULT '{}'
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (project_id, timestamp, command, task_id)
        TTL toDateTime(timestamp) + INTERVAL 90 DAY
        SETTINGS index_granularity = 8192
    """)

    # Create job_stats_hourly materialized view
    client.command("""
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
        GROUP BY hour, project_id, queue_name, job_class, status
    """)

    # Create scheduled_task_stats_daily materialized view
    client.command("""
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
        GROUP BY day, project_id, command, status
    """)

    # Create job_status_timeline_hourly table for status counts over time
    client.command("""
        CREATE TABLE IF NOT EXISTS job_status_timeline_hourly (
            hour DateTime,
            project_id UUID,
            status LowCardinality(String),
            count UInt64
        ) ENGINE = SummingMergeTree()
        PARTITION BY toYYYYMM(hour)
        ORDER BY (hour, project_id, status)
    """)

    # Create materialized view for job status timeline
    client.command("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS job_status_timeline_hourly_mv
        TO job_status_timeline_hourly
        AS SELECT
            toStartOfHour(timestamp) AS hour,
            project_id,
            status,
            count() AS count
        FROM job_logs
        GROUP BY hour, project_id, status
    """)
