"""Centralized ingestion service for all ClickHouse inserts.

Single source of truth for converting model entries to ClickHouse rows
and inserting them. Eliminates duplicate insert functions across api/ingest.py and api/jobs.py.
"""

import logging
import uuid
from typing import Optional
from urllib.parse import urlparse

from app.constants import (
    DEFAULT_PROJECT_ID,
    JOB_LOGS_COLUMNS,
    LOGS_COLUMNS,
    OUTBOUND_LOGS_COLUMNS,
    SCHEDULED_TASK_LOGS_COLUMNS,
    TABLE_JOB_LOGS,
    TABLE_LOGS,
    TABLE_OUTBOUND_LOGS,
    TABLE_SCHEDULED_TASK_LOGS,
)
from app.models.ingest import InboundLogEntry, OutboundLogEntry
from app.models.jobs import JobLogEntry, ScheduledTaskLogEntry
from app.services.clickhouse import get_clickhouse_client

logger = logging.getLogger(__name__)


def _get_project_id(project_id: Optional[uuid.UUID]) -> str:
    """Get project_id string, falling back to default for legacy keys."""
    return str(project_id) if project_id else DEFAULT_PROJECT_ID


def _extract_host_from_url(url: str) -> str:
    """Extract host from URL."""
    try:
        parsed = urlparse(url)
        return parsed.netloc or parsed.path.split('/')[0]
    except Exception:
        return url


# ============================================
# Row builders — convert models to ClickHouse rows
# ============================================

def _build_inbound_row(entry: InboundLogEntry, project_id: str) -> list:
    return [
        project_id,
        entry.request_id,
        entry.timestamp,
        entry.endpoint,
        entry.method,
        entry.status_code,
        entry.response_time_ms,
        entry.user_id or '',
        entry.user_name or '',
        entry.module or '',
        entry.tags or [],
        False,
        '',
        entry.request_body or '',
        entry.response_body or '',
    ]


def _build_outbound_row(entry: OutboundLogEntry, project_id: str) -> list:
    is_success = 1 if 200 <= entry.status_code < 400 else 0
    target_host = _extract_host_from_url(entry.endpoint)

    return [
        project_id,
        entry.request_id,
        '',              # parent_request_id
        '',              # trace_id
        '',              # span_id
        entry.timestamp,
        entry.third_party_service or '',
        target_host,
        entry.endpoint,
        entry.method,
        entry.status_code,
        entry.response_time_ms,
        is_success,
        0,               # request_size
        0,               # response_size
        '',              # error_message
        '',              # error_code
        0,               # retry_count
        entry.module or '',
        entry.user_id or '',
        '',              # request_headers
        '',              # response_headers
        entry.request_body or '',
        entry.response_body or '',
        entry.tags or [],
        '',              # metadata
    ]


def _build_job_row(entry: JobLogEntry, project_id: str) -> list:
    return [
        entry.job_id,
        entry.job_uuid or '',
        project_id,
        entry.started_at,       # timestamp
        entry.job_class,
        entry.job_name,
        entry.queue_name,
        entry.connection,
        entry.status,
        entry.started_at,
        entry.completed_at,
        int(entry.duration_ms or 0),
        entry.payload or '{}',
        entry.attempt_number,
        entry.max_attempts,
        entry.exception_class or '',
        entry.exception_message or '',
        entry.exception_trace or '',
        entry.user_id or '',
        float(entry.memory_usage_mb or 0),
        str(entry.metadata) if entry.metadata else '{}',
    ]


def _build_scheduled_task_row(entry: ScheduledTaskLogEntry, project_id: str) -> list:
    return [
        entry.task_id,
        project_id,
        entry.scheduled_at,     # timestamp
        entry.command,
        entry.description or '',
        entry.expression,
        entry.timezone,
        entry.status,
        entry.scheduled_at,
        entry.started_at,
        entry.completed_at,
        int(entry.duration_ms or 0),
        int(entry.exit_code or 0),
        entry.output or '',
        entry.error_message or '',
        entry.error_trace or '',
        1 if entry.without_overlapping else 0,
        entry.mutex_name or '',
        entry.expected_run_time,
        int(entry.delay_ms or 0),
        str(entry.metadata) if entry.metadata else '{}',
    ]


# ============================================
# Public insert functions
# ============================================

def insert_inbound_log(
    entry: InboundLogEntry,
    project_id: Optional[uuid.UUID] = None,
) -> None:
    """Insert a single inbound log entry."""
    pid = _get_project_id(project_id)
    client = get_clickhouse_client()

    third_party_service = ''
    row = [
        pid, entry.request_id, entry.timestamp, entry.endpoint, entry.method,
        entry.status_code, entry.response_time_ms, entry.user_id or '',
        entry.user_name or '', entry.module or '', entry.tags or [],
        False, third_party_service, entry.request_body or '', entry.response_body or '',
    ]

    client.insert(TABLE_LOGS, [row], column_names=LOGS_COLUMNS)


def insert_outbound_log(
    entry: OutboundLogEntry,
    project_id: Optional[uuid.UUID] = None,
) -> None:
    """Insert a single outbound log entry."""
    pid = _get_project_id(project_id)
    client = get_clickhouse_client()
    row = _build_outbound_row(entry, pid)
    client.insert(TABLE_OUTBOUND_LOGS, [row], column_names=OUTBOUND_LOGS_COLUMNS)


def insert_job_log(
    entry: JobLogEntry,
    project_id: Optional[uuid.UUID] = None,
) -> None:
    """Insert a single job log entry."""
    pid = _get_project_id(project_id)
    client = get_clickhouse_client()
    row = _build_job_row(entry, pid)
    client.insert(TABLE_JOB_LOGS, [row], column_names=JOB_LOGS_COLUMNS)


def insert_scheduled_task_log(
    entry: ScheduledTaskLogEntry,
    project_id: Optional[uuid.UUID] = None,
) -> None:
    """Insert a single scheduled task log entry."""
    pid = _get_project_id(project_id)
    client = get_clickhouse_client()
    row = _build_scheduled_task_row(entry, pid)
    client.insert(TABLE_SCHEDULED_TASK_LOGS, [row], column_names=SCHEDULED_TASK_LOGS_COLUMNS)


# ============================================
# Batch insert functions
# ============================================

def insert_inbound_logs_batch(
    entries: list[InboundLogEntry],
    project_id: Optional[uuid.UUID] = None,
) -> int:
    """Insert multiple inbound log entries. Returns count inserted."""
    if not entries:
        return 0
    pid = _get_project_id(project_id)
    client = get_clickhouse_client()
    rows = [_build_inbound_row(entry, pid) for entry in entries]
    client.insert(TABLE_LOGS, rows, column_names=LOGS_COLUMNS)
    return len(rows)


def insert_outbound_logs_batch(
    entries: list[OutboundLogEntry],
    project_id: Optional[uuid.UUID] = None,
) -> int:
    """Insert multiple outbound log entries. Returns count inserted."""
    if not entries:
        return 0
    pid = _get_project_id(project_id)
    client = get_clickhouse_client()
    rows = [_build_outbound_row(entry, pid) for entry in entries]
    client.insert(TABLE_OUTBOUND_LOGS, rows, column_names=OUTBOUND_LOGS_COLUMNS)
    return len(rows)


def insert_job_logs_batch(
    entries: list[JobLogEntry],
    project_id: Optional[uuid.UUID] = None,
) -> int:
    """Insert multiple job log entries. Returns count inserted."""
    if not entries:
        return 0
    pid = _get_project_id(project_id)
    client = get_clickhouse_client()
    rows = [_build_job_row(entry, pid) for entry in entries]
    client.insert(TABLE_JOB_LOGS, rows, column_names=JOB_LOGS_COLUMNS)
    return len(rows)


def insert_scheduled_task_logs_batch(
    entries: list[ScheduledTaskLogEntry],
    project_id: Optional[uuid.UUID] = None,
) -> int:
    """Insert multiple scheduled task log entries. Returns count inserted."""
    if not entries:
        return 0
    pid = _get_project_id(project_id)
    client = get_clickhouse_client()
    rows = [_build_scheduled_task_row(entry, pid) for entry in entries]
    client.insert(TABLE_SCHEDULED_TASK_LOGS, rows, column_names=SCHEDULED_TASK_LOGS_COLUMNS)
    return len(rows)
