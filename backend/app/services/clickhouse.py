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
        connect_timeout=10,
        send_receive_timeout=30,
    )


def init_database():
    """Initialize ClickHouse schema.

    This is a fallback for non-Docker setups. The canonical schema lives in
    ``clickhouse/init/*.sql`` which Docker runs via entrypoint-initdb.d.
    Keep these definitions aligned with the SQL files.
    """
    client = get_clickhouse_client()

    # ── logs table (aligned with clickhouse/init/01_create_database.sql) ──
    client.command("""
        CREATE TABLE IF NOT EXISTS logs (
            id UUID DEFAULT generateUUIDv4(),
            project_id String DEFAULT '',
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
        TTL toDateTime(timestamp) + INTERVAL 90 DAY
    """)

    # logs indexes
    client.command(
        "CREATE INDEX IF NOT EXISTS idx_status ON logs (status_code) TYPE minmax GRANULARITY 1"
    )
    client.command(
        "CREATE INDEX IF NOT EXISTS idx_module ON logs (module) TYPE bloom_filter GRANULARITY 1"
    )
    client.command(
        "CREATE INDEX IF NOT EXISTS idx_user ON logs (user_id) TYPE bloom_filter GRANULARITY 1"
    )

    # stats_hourly aggregate table
    client.command("""
        CREATE TABLE IF NOT EXISTS stats_hourly (
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
        PARTITION BY toYYYYMM(hour)
    """)

    # ── job_logs table (aligned with clickhouse/init/02_create_job_tables.sql) ──
    client.command("""
        CREATE TABLE IF NOT EXISTS job_logs (
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
        TTL toDateTime(started_at) + INTERVAL 90 DAY
    """)

    # job_logs indexes
    client.command(
        "CREATE INDEX IF NOT EXISTS idx_job_status ON job_logs (status) TYPE minmax GRANULARITY 1"
    )
    client.command(
        "CREATE INDEX IF NOT EXISTS idx_job_queue ON job_logs (queue_name) TYPE bloom_filter GRANULARITY 1"
    )
    client.command(
        "CREATE INDEX IF NOT EXISTS idx_job_class ON job_logs (job_class) TYPE bloom_filter GRANULARITY 1"
    )
    client.command(
        "CREATE INDEX IF NOT EXISTS idx_job_user ON job_logs (user_id) TYPE bloom_filter GRANULARITY 1"
    )

    # ── scheduled_task_logs table ──
    client.command("""
        CREATE TABLE IF NOT EXISTS scheduled_task_logs (
            id UUID DEFAULT generateUUIDv4(),
            project_id String,
            timestamp DateTime64(3) DEFAULT now64(3),
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
        TTL toDateTime(scheduled_at) + INTERVAL 90 DAY
    """)

    # scheduled_task_logs indexes
    client.command(
        "CREATE INDEX IF NOT EXISTS idx_task_status ON scheduled_task_logs (status) TYPE minmax GRANULARITY 1"
    )
    client.command(
        "CREATE INDEX IF NOT EXISTS idx_task_command ON scheduled_task_logs (command) TYPE bloom_filter GRANULARITY 1"
    )

    # ── Materialized views for jobs ──
    client.command("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS job_stats_hourly
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
        FROM job_logs
        WHERE duration_ms IS NOT NULL
        GROUP BY hour, project_id, queue_name, job_class, status
    """)

    client.command("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS scheduled_task_stats_daily
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
        FROM scheduled_task_logs
        WHERE duration_ms IS NOT NULL
        GROUP BY day, project_id, command, status
    """)

    # Job percentile stats
    client.command("""
        CREATE TABLE IF NOT EXISTS job_percentile_stats_hourly (
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
        ORDER BY (hour, project_id, queue_name, job_class)
    """)

    client.command("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS job_percentile_stats_hourly_mv
        TO job_percentile_stats_hourly
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
        FROM job_logs
        WHERE duration_ms > 0
        GROUP BY hour, project_id, queue_name, job_class
    """)

    # Job status timeline
    client.command("""
        CREATE TABLE IF NOT EXISTS job_status_timeline_hourly (
            hour DateTime,
            project_id String,
            status LowCardinality(String),
            count UInt64
        ) ENGINE = SummingMergeTree()
        PARTITION BY toYYYYMM(hour)
        ORDER BY (hour, project_id, status)
    """)

    client.command("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS job_status_timeline_hourly_mv
        TO job_status_timeline_hourly
        AS SELECT
            toStartOfHour(started_at) AS hour,
            project_id,
            status,
            count() AS count
        FROM job_logs
        GROUP BY hour, project_id, status
    """)

    # Scheduled task percentile stats
    client.command("""
        CREATE TABLE IF NOT EXISTS scheduled_task_percentile_stats_daily (
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
        ORDER BY (day, project_id, command)
    """)

    client.command("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS scheduled_task_percentile_stats_daily_mv
        TO scheduled_task_percentile_stats_daily
        AS SELECT
            toStartOfDay(scheduled_at) AS day,
            project_id,
            command,
            countState() AS execution_count,
            quantileState(0.50)(duration_ms) AS duration_p50,
            quantileState(0.95)(duration_ms) AS duration_p95,
            quantileState(0.99)(duration_ms) AS duration_p99,
            quantileState(0.95)(delay_ms) AS delay_p95
        FROM scheduled_task_logs
        WHERE duration_ms > 0
        GROUP BY day, project_id, command
    """)

    # ── outbound_logs table (aligned with clickhouse/init/03_create_outbound_tables.sql) ──
    client.command("""
        CREATE TABLE IF NOT EXISTS outbound_logs (
            id UUID DEFAULT generateUUIDv4(),
            project_id String,
            request_id String,
            parent_request_id String DEFAULT '',
            trace_id String DEFAULT '',
            span_id String DEFAULT '',
            timestamp DateTime64(3),
            service_name LowCardinality(String),
            target_host LowCardinality(String),
            target_url String,
            method LowCardinality(String),
            status_code UInt16,
            latency_ms Float32,
            is_success UInt8 DEFAULT 1,
            request_size UInt32 DEFAULT 0,
            response_size UInt32 DEFAULT 0,
            error_message String DEFAULT '',
            error_code String DEFAULT '',
            retry_count UInt8 DEFAULT 0,
            module LowCardinality(String) DEFAULT '',
            user_id String DEFAULT '',
            request_headers String DEFAULT '',
            response_headers String DEFAULT '',
            request_body String DEFAULT '',
            response_body String DEFAULT '',
            tags Array(String) DEFAULT [],
            metadata String DEFAULT '',
            created_at DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (project_id, timestamp, service_name, request_id)
        TTL toDateTime(timestamp) + INTERVAL 90 DAY
        SETTINGS index_granularity = 8192
    """)

    # outbound_logs indexes
    client.command(
        "CREATE INDEX IF NOT EXISTS idx_outbound_service_name ON outbound_logs (service_name) TYPE set(100) GRANULARITY 4"
    )
    client.command(
        "CREATE INDEX IF NOT EXISTS idx_outbound_status_code ON outbound_logs (status_code) TYPE minmax GRANULARITY 4"
    )
    client.command(
        "CREATE INDEX IF NOT EXISTS idx_outbound_is_success ON outbound_logs (is_success) TYPE minmax GRANULARITY 4"
    )
    client.command(
        "CREATE INDEX IF NOT EXISTS idx_outbound_target_host ON outbound_logs (target_host) TYPE set(100) GRANULARITY 4"
    )
    client.command(
        "CREATE INDEX IF NOT EXISTS idx_outbound_parent_request ON outbound_logs (parent_request_id) TYPE bloom_filter() GRANULARITY 4"
    )
    client.command(
        "CREATE INDEX IF NOT EXISTS idx_outbound_trace_id ON outbound_logs (trace_id) TYPE bloom_filter() GRANULARITY 4"
    )

    # Outbound stats hourly
    client.command("""
        CREATE TABLE IF NOT EXISTS outbound_stats_hourly (
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
        ORDER BY (project_id, hour, service_name)
    """)

    client.command("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS outbound_stats_hourly_mv
        TO outbound_stats_hourly
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
        FROM outbound_logs
        GROUP BY hour, project_id, service_name
    """)

    # Outbound percentile stats
    client.command("""
        CREATE TABLE IF NOT EXISTS outbound_percentile_stats_hourly (
            hour DateTime,
            project_id String,
            service_name LowCardinality(String),
            execution_count AggregateFunction(count),
            latency_p50 AggregateFunction(quantile(0.50), Float32),
            latency_p95 AggregateFunction(quantile(0.95), Float32),
            latency_p99 AggregateFunction(quantile(0.99), Float32)
        ) ENGINE = AggregatingMergeTree()
        PARTITION BY toYYYYMM(hour)
        ORDER BY (project_id, hour, service_name)
    """)

    client.command("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS outbound_percentile_stats_hourly_mv
        TO outbound_percentile_stats_hourly
        AS SELECT
            toStartOfHour(timestamp) AS hour,
            project_id,
            service_name,
            countState() AS execution_count,
            quantileState(0.50)(latency_ms) AS latency_p50,
            quantileState(0.95)(latency_ms) AS latency_p95,
            quantileState(0.99)(latency_ms) AS latency_p99
        FROM outbound_logs
        WHERE latency_ms > 0
        GROUP BY hour, project_id, service_name
    """)
