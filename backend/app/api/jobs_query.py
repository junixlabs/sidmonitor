import logging
import math
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import verify_auth
from app.api.stats._common import safe_float
from app.models.jobs import (
    JobClassStats,
    JobExecution,
    JobHealthStats,
    JobPaginatedResponse,
    JobQueueStats,
    JobTimelinePoint,
    MissedTask,
    RecentFailure,
    ScheduledTaskCommandStats,
    ScheduledTaskExecution,
    ScheduledTaskFailure,
    ScheduledTaskHealthStats,
    ScheduledTaskPaginatedResponse,
)
from app.services.clickhouse import get_clickhouse_client
from app.services.query_builder import WhereBuilder

logger = logging.getLogger(__name__)

router = APIRouter()


def parse_timeframe(timeframe: str) -> str:
    """Parse timeframe string to ClickHouse INTERVAL."""
    mapping = {
        "1h": "INTERVAL 1 HOUR",
        "24h": "INTERVAL 24 HOUR",
        "7d": "INTERVAL 7 DAY",
        "30d": "INTERVAL 30 DAY",
    }
    return mapping.get(timeframe, "INTERVAL 24 HOUR")


@router.get("/jobs", response_model=JobPaginatedResponse)
async def get_jobs(
    project_id: str = Query(..., description="Filter by project ID (UUID)"),
    queue_name: Optional[str] = Query(None, description="Filter by queue name"),
    job_class: Optional[str] = Query(None, description="Filter by job class"),
    status: Optional[str] = Query(None, description="Filter by status: started, completed, failed, retrying"),
    start_date: Optional[str] = Query(None, description="Start date filter"),
    end_date: Optional[str] = Query(None, description="End date filter"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    _: bool = Depends(verify_auth),
):
    """Get paginated job executions with optional filters."""
    try:
        client = get_clickhouse_client()

        # Build WHERE conditions
        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, field="started_at")
        wb.eq("queue_name", queue_name).eq("job_class", job_class).eq("status", status)
        where_clause, params = wb.build_conditions()
        offset = (page - 1) * page_size

        # Get total count
        count_query = f"SELECT count(*) FROM job_logs WHERE {where_clause}"
        count_result = client.query(count_query, parameters=params)
        total = count_result.result_rows[0][0] if count_result.result_rows else 0
        total_pages = math.ceil(total / page_size) if total > 0 else 0

        # Get paginated data
        params["page_size"] = page_size
        params["offset"] = offset

        data_query = """
            SELECT
                job_id,
                job_uuid,
                toString(project_id) as project_id,
                formatDateTime(started_at, '%%Y-%%m-%%d %%H:%%i:%%S') as timestamp_str,
                job_class,
                job_name,
                queue_name,
                connection,
                status,
                formatDateTime(started_at, '%%Y-%%m-%%d %%H:%%i:%%S') as started_at_str,
                if(completed_at IS NULL, NULL, formatDateTime(completed_at, '%%Y-%%m-%%d %%H:%%i:%%S')) as completed_at_str,
                duration_ms,
                payload,
                attempt_number,
                max_attempts,
                exception_class,
                exception_message,
                exception_trace,
                user_id,
                memory_usage_mb
            FROM job_logs
            WHERE """ + where_clause + """
            ORDER BY started_at DESC
            LIMIT %(page_size)s OFFSET %(offset)s
        """

        result = client.query(data_query, parameters=params)

        jobs = []
        for row in result.result_rows:
            jobs.append(JobExecution(
                job_id=row[0],
                job_uuid=row[1],
                project_id=row[2],
                timestamp=row[3],
                job_class=row[4],
                job_name=row[5],
                queue_name=row[6],
                connection=row[7],
                status=row[8],
                started_at=row[9],
                completed_at=row[10],
                duration_ms=row[11],
                payload=row[12],
                attempt_number=row[13],
                max_attempts=row[14],
                exception_class=row[15],
                exception_message=row[16],
                exception_trace=row[17],
                user_id=row[18],
                memory_usage_mb=row[19],
            ))

        return JobPaginatedResponse(
            data=jobs,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
    except Exception as e:
        logger.error(f"Error fetching jobs: {e}")
        raise HTTPException(status_code=500, detail="Error fetching jobs")


@router.get("/jobs/stats", response_model=JobHealthStats)
async def get_job_stats(
    project_id: str = Query(..., description="Filter by project ID (UUID)"),
    queue_name: Optional[str] = Query(None, description="Filter by queue name"),
    timeframe: str = Query("24h", description="Timeframe: 1h, 24h, 7d, 30d"),
    _: bool = Depends(verify_auth),
):
    """Get job health statistics."""
    try:
        client = get_clickhouse_client()
        interval = parse_timeframe(timeframe)

        # Build WHERE conditions
        wb = WhereBuilder()
        wb.project(project_id).raw(f"started_at >= now() - {interval}")
        wb.eq("queue_name", queue_name)
        where_clause, params = wb.build_conditions()

        # Note: job_logs uses MergeTree and may contain duplicate rows.
        # All queries use GROUP BY job_id with any() to deduplicate.

        # Overall stats with P50, P95, P99 and additional status counts
        overall_query = f"""
            SELECT
                count(*) as total_executions,
                countIf(s IN ('completed', 'success')) as success_count,
                countIf(s = 'failed') as failure_count,
                countIf(s = 'retrying') as retrying_count,
                countIf(s = 'pending') as pending_count,
                countIf(s = 'cancelled') as cancelled_count,
                countIf(s = 'timeout') as timeout_count,
                round(
                    if(
                        countIf(s IN ('completed', 'success', 'failed')) > 0,
                        countIf(s IN ('completed', 'success')) * 100.0 / countIf(s IN ('completed', 'success', 'failed')),
                        0
                    ),
                    2
                ) as success_rate,
                round(avg(d), 2) as avg_duration_ms,
                round(quantile(0.50)(d), 2) as p50_duration_ms,
                round(quantile(0.95)(d), 2) as p95_duration_ms,
                round(quantile(0.99)(d), 2) as p99_duration_ms
            FROM (
                SELECT any(status) as s, any(duration_ms) as d
                FROM job_logs
                WHERE {where_clause}
                GROUP BY job_id
            )
        """

        result = client.query(overall_query, parameters=params)
        row = result.result_rows[0] if result.result_rows else (0, 0, 0, 0, 0, 0, 0, 0.0, 0.0, 0.0, 0.0, 0.0)

        # Stats by queue
        queue_query = f"""
            SELECT
                q as queue_name,
                count(*) as total_executions,
                countIf(s IN ('completed', 'success')) as success_count,
                countIf(s = 'failed') as failure_count,
                round(avg(d), 2) as avg_duration_ms
            FROM (
                SELECT any(queue_name) as q, any(status) as s, any(duration_ms) as d
                FROM job_logs
                WHERE {where_clause}
                GROUP BY job_id
            )
            GROUP BY q
            ORDER BY total_executions DESC
        """

        queue_result = client.query(queue_query, parameters=params)
        by_queue = [
            JobQueueStats(
                queue_name=r[0],
                total_executions=r[1],
                success_count=r[2],
                failure_count=r[3],
                avg_duration_ms=safe_float(r[4]),
            )
            for r in queue_result.result_rows
        ]

        # Stats by job class
        class_query = f"""
            SELECT
                jc as job_class,
                count(*) as total_executions,
                countIf(s IN ('completed', 'success')) as success_count,
                countIf(s = 'failed') as failure_count,
                round(avg(d), 2) as avg_duration_ms
            FROM (
                SELECT any(job_class) as jc, any(status) as s, any(duration_ms) as d
                FROM job_logs
                WHERE {where_clause}
                GROUP BY job_id
            )
            GROUP BY jc
            ORDER BY total_executions DESC
            LIMIT 10
        """

        class_result = client.query(class_query, parameters=params)
        by_job_class = [
            JobClassStats(
                job_class=r[0],
                total_executions=r[1],
                success_count=r[2],
                failure_count=r[3],
                avg_duration_ms=safe_float(r[4]),
            )
            for r in class_result.result_rows
        ]

        # Recent failures (dedup by job_id using GROUP BY + HAVING)
        failures_query = f"""
            SELECT
                job_id,
                any(job_class) as jc,
                formatDateTime(any(started_at), '%%Y-%%m-%%d %%H:%%i:%%S') as timestamp_str,
                any(exception_message) as em
            FROM job_logs
            WHERE {where_clause}
            GROUP BY job_id
            HAVING any(status) = 'failed'
            ORDER BY any(started_at) DESC
            LIMIT 5
        """

        failures_result = client.query(failures_query, parameters=params)
        recent_failures = [
            RecentFailure(
                job_id=r[0],
                job_class=r[1],
                timestamp=r[2],
                exception_message=r[3],
            )
            for r in failures_result.result_rows
        ]

        return JobHealthStats(
            total_executions=row[0],
            success_count=row[1],
            failure_count=row[2],
            retrying_count=row[3],
            pending_count=row[4],
            cancelled_count=row[5],
            timeout_count=row[6],
            success_rate=safe_float(row[7]),
            avg_duration_ms=safe_float(row[8]),
            p50_duration_ms=safe_float(row[9]),
            p95_duration_ms=safe_float(row[10]),
            p99_duration_ms=safe_float(row[11]),
            by_queue=by_queue,
            by_job_class=by_job_class,
            recent_failures=recent_failures,
        )
    except Exception as e:
        logger.error(f"Error fetching job stats: {e}")
        raise HTTPException(status_code=500, detail="Error fetching job stats")


@router.get("/jobs/timeline", response_model=List[JobTimelinePoint])
async def get_job_timeline(
    project_id: str = Query(..., description="Filter by project ID (UUID)"),
    timeframe: str = Query("24h", description="Timeframe: 1h, 24h, 7d, 30d"),
    interval: str = Query("hour", description="Interval: hour, day"),
    _: bool = Depends(verify_auth),
):
    """Get time-series data for job executions."""
    try:
        client = get_clickhouse_client()
        timeframe_interval = parse_timeframe(timeframe)

        # Map interval to ClickHouse function
        interval_map = {
            "hour": "toStartOfHour",
            "day": "toStartOfDay",
        }
        time_func = interval_map.get(interval, "toStartOfHour")

        wb = WhereBuilder()
        wb.project(project_id).raw(f"started_at >= now() - {timeframe_interval}")
        where_clause, params = wb.build_conditions()

        query = f"""
            SELECT
                {time_func}(started_at) as time_bucket,
                count(*) as total,
                countIf(status IN ('completed', 'success')) as success,
                countIf(status = 'failed') as failed,
                countIf(status = 'retrying') as retrying,
                countIf(status = 'pending') as pending,
                countIf(status = 'cancelled') as cancelled,
                countIf(status = 'timeout') as timeout
            FROM job_logs
            WHERE {where_clause}
            GROUP BY time_bucket
            ORDER BY time_bucket ASC
        """

        result = client.query(query, parameters=params)

        timeline = [
            JobTimelinePoint(
                timestamp=row[0].isoformat() if hasattr(row[0], 'isoformat') else str(row[0]),
                total=row[1],
                success=row[2],
                failed=row[3],
                retrying=row[4],
                pending=row[5],
                cancelled=row[6],
                timeout=row[7],
            )
            for row in result.result_rows
        ]

        return timeline
    except Exception as e:
        logger.error(f"Error fetching job timeline: {e}")
        raise HTTPException(status_code=500, detail="Error fetching job timeline")


@router.get("/scheduled-tasks", response_model=ScheduledTaskPaginatedResponse)
async def get_scheduled_tasks(
    project_id: str = Query(..., description="Filter by project ID (UUID)"),
    command: Optional[str] = Query(None, description="Filter by command"),
    status: Optional[str] = Query(None, description="Filter by status"),
    start_date: Optional[str] = Query(None, description="Start date filter"),
    end_date: Optional[str] = Query(None, description="End date filter"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    _: bool = Depends(verify_auth),
):
    """Get paginated scheduled task executions with optional filters."""
    try:
        client = get_clickhouse_client()

        # Build WHERE conditions
        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, field="scheduled_at")
        wb.eq("command", command).eq("status", status)
        where_clause, params = wb.build_conditions()
        offset = (page - 1) * page_size

        # Get total count
        count_query = f"SELECT count(*) FROM scheduled_task_logs WHERE {where_clause}"
        count_result = client.query(count_query, parameters=params)
        total = count_result.result_rows[0][0] if count_result.result_rows else 0
        total_pages = math.ceil(total / page_size) if total > 0 else 0

        # Get paginated data
        params["page_size"] = page_size
        params["offset"] = offset

        data_query = """
            SELECT
                task_id,
                toString(project_id) as project_id,
                formatDateTime(scheduled_at, '%%Y-%%m-%%d %%H:%%i:%%S') as timestamp_str,
                command,
                description,
                expression,
                timezone,
                status,
                formatDateTime(scheduled_at, '%%Y-%%m-%%d %%H:%%i:%%S') as scheduled_at_str,
                if(started_at IS NULL, NULL, formatDateTime(started_at, '%%Y-%%m-%%d %%H:%%i:%%S')) as started_at_str,
                if(completed_at IS NULL, NULL, formatDateTime(completed_at, '%%Y-%%m-%%d %%H:%%i:%%S')) as completed_at_str,
                duration_ms,
                exit_code,
                output,
                error_message,
                error_trace,
                without_overlapping,
                mutex_name,
                formatDateTime(expected_run_time, '%%Y-%%m-%%d %%H:%%i:%%S') as expected_run_time_str,
                delay_ms
            FROM scheduled_task_logs
            WHERE """ + where_clause + """
            ORDER BY scheduled_at DESC
            LIMIT %(page_size)s OFFSET %(offset)s
        """

        result = client.query(data_query, parameters=params)

        tasks = []
        for row in result.result_rows:
            tasks.append(ScheduledTaskExecution(
                task_id=row[0],
                project_id=row[1],
                timestamp=row[2],
                command=row[3],
                description=row[4],
                expression=row[5],
                timezone=row[6],
                status=row[7],
                scheduled_at=row[8],
                started_at=row[9],
                completed_at=row[10],
                duration_ms=row[11],
                exit_code=row[12],
                output=row[13],
                error_message=row[14],
                error_trace=row[15],
                without_overlapping=bool(row[16]),
                mutex_name=row[17],
                expected_run_time=row[18],
                delay_ms=row[19],
            ))

        return ScheduledTaskPaginatedResponse(
            data=tasks,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
    except Exception as e:
        logger.error(f"Error fetching scheduled tasks: {e}")
        raise HTTPException(status_code=500, detail="Error fetching scheduled tasks")


@router.get("/scheduled-tasks/stats", response_model=ScheduledTaskHealthStats)
async def get_scheduled_task_stats(
    project_id: str = Query(..., description="Filter by project ID (UUID)"),
    timeframe: str = Query("7d", description="Timeframe: 1h, 24h, 7d, 30d"),
    _: bool = Depends(verify_auth),
):
    """Get scheduled task health statistics."""
    try:
        client = get_clickhouse_client()
        interval = parse_timeframe(timeframe)

        wb = WhereBuilder()
        wb.project(project_id).raw(f"scheduled_at >= now() - {interval}")
        where_clause, params = wb.build_conditions()

        # Overall stats
        overall_query = f"""
            SELECT
                count(*) as total_executions,
                countIf(status = 'completed') as success_count,
                countIf(status = 'failed') as failure_count,
                countIf(status = 'missed') as missed_count,
                round(
                    if(
                        countIf(status IN ('completed', 'failed')) > 0,
                        countIf(status = 'completed') * 100.0 / countIf(status IN ('completed', 'failed')),
                        0
                    ),
                    2
                ) as success_rate,
                round(avg(delay_ms), 2) as avg_delay_ms,
                round(avg(duration_ms), 2) as avg_duration_ms
            FROM scheduled_task_logs
            WHERE {where_clause}
        """

        result = client.query(overall_query, parameters=params)
        row = result.result_rows[0] if result.result_rows else (0, 0, 0, 0, 0.0, 0.0, 0.0)

        # Stats by command
        command_query = f"""
            SELECT
                command,
                count(*) as total_executions,
                countIf(status = 'completed') as success_count,
                countIf(status = 'failed') as failure_count,
                countIf(status = 'missed') as missed_count,
                round(avg(duration_ms), 2) as avg_duration_ms,
                round(avg(delay_ms), 2) as avg_delay_ms
            FROM scheduled_task_logs
            WHERE {where_clause}
            GROUP BY command
            ORDER BY total_executions DESC
        """

        command_result = client.query(command_query, parameters=params)
        by_command = [
            ScheduledTaskCommandStats(
                command=r[0],
                total_executions=r[1],
                success_count=r[2],
                failure_count=r[3],
                missed_count=r[4],
                avg_duration_ms=safe_float(r[5]),
                avg_delay_ms=safe_float(r[6]),
            )
            for r in command_result.result_rows
        ]

        # Recent failures
        failures_query = """
            SELECT
                task_id,
                command,
                formatDateTime(scheduled_at, '%%Y-%%m-%%d %%H:%%i:%%S') as timestamp_str,
                error_message
            FROM scheduled_task_logs
            WHERE """ + where_clause + """ AND status = 'failed'
            ORDER BY scheduled_at DESC
            LIMIT 5
        """

        failures_result = client.query(failures_query, parameters=params)
        recent_failures = [
            ScheduledTaskFailure(
                task_id=r[0],
                command=r[1],
                timestamp=r[2],
                error_message=r[3],
            )
            for r in failures_result.result_rows
        ]

        # Missed tasks
        missed_query = """
            SELECT
                task_id,
                command,
                formatDateTime(scheduled_at, '%%Y-%%m-%%d %%H:%%i:%%S') as scheduled_at_str,
                delay_ms
            FROM scheduled_task_logs
            WHERE """ + where_clause + """ AND status = 'missed'
            ORDER BY scheduled_at DESC
            LIMIT 10
        """

        missed_result = client.query(missed_query, parameters=params)
        missed_tasks = [
            MissedTask(
                task_id=r[0],
                command=r[1],
                scheduled_at=r[2],
                delay_ms=r[3] if r[3] else 0,
            )
            for r in missed_result.result_rows
        ]

        return ScheduledTaskHealthStats(
            total_executions=row[0],
            success_count=row[1],
            failure_count=row[2],
            missed_count=row[3],
            success_rate=safe_float(row[4]),
            avg_delay_ms=safe_float(row[5]),
            avg_duration_ms=safe_float(row[6]),
            by_command=by_command,
            recent_failures=recent_failures,
            missed_tasks=missed_tasks,
        )
    except Exception as e:
        logger.error(f"Error fetching scheduled task stats: {e}")
        raise HTTPException(status_code=500, detail="Error fetching scheduled task stats")
