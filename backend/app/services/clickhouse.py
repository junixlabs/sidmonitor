import clickhouse_connect
from functools import lru_cache
from contextlib import contextmanager

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
            timestamp DateTime64(3),
            endpoint String,
            method String,
            status_code UInt16,
            response_time_ms Float64,
            user_id Nullable(String),
            user_name Nullable(String),
            module Nullable(String),
            tags Array(String),
            is_outbound Bool DEFAULT false,
            third_party_service Nullable(String),
            request_body Nullable(String),
            response_body Nullable(String)
        ) ENGINE = MergeTree()
        ORDER BY (timestamp, request_id)
        PARTITION BY toYYYYMM(timestamp)
    """)
