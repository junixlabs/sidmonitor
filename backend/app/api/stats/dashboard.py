"""Dashboard stats endpoints."""

import logging
import uuid as uuid_module
from typing import List, Literal, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import verify_auth
from app.api.stats._common import safe_float
from app.database import get_db
from app.models.database import Project as ProjectModel
from app.services.query_builder import WhereBuilder
from app.models.stats import (
    DashboardStats,
    EndpointStats,
    GlobalDashboardStats,
    ProjectStats,
    RequestCounts,
    StatTrend,
    TimeSeriesPoint,
)
from app.services.clickhouse import get_clickhouse_client

logger = logging.getLogger(__name__)


def _is_valid_uuid(val: str) -> bool:
    """Check if a string is a valid UUID."""
    try:
        uuid_module.UUID(val)
        return True
    except (ValueError, AttributeError):
        return False

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    type: Optional[Literal["all", "inbound", "outbound"]] = Query("all", description="Filter by request type"),
    _: bool = Depends(verify_auth),
):
    """Get dashboard statistics."""
    try:
        client = get_clickhouse_client()

        # Build WHERE conditions
        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, best_effort=True).request_type(type)
        where_clause, params = wb.build()

        # Current period query
        query = f"""
            SELECT
                count(*) as total_requests,
                round(countIf(status_code >= 400) * 100.0 / count(*), 2) as error_rate,
                round(avg(response_time_ms), 2) as avg_response_time,
                round(count(*) / (dateDiff('minute', min(timestamp), max(timestamp)) + 1), 2) as requests_per_minute
            FROM logs
            {where_clause}
        """

        result = client.query(query, parameters=params)
        row = result.result_rows[0] if result.result_rows else (0, 0.0, 0.0, 0.0)

        # Previous period query for trend comparison
        # Calculate the time range to determine previous period
        prev_wb = WhereBuilder()
        prev_wb.project(project_id).request_type(type)

        if start_date and end_date:
            # Calculate previous period with same duration
            prev_period_query = """
                SELECT
                    toDateTime(%(start_date)s) - (toDateTime(%(end_date)s) - toDateTime(%(start_date)s)) as prev_start,
                    toDateTime(%(start_date)s) as prev_end
            """
            period_result = client.query(prev_period_query, parameters=params)
            if period_result.result_rows:
                prev_start = period_result.result_rows[0][0]
                prev_end = period_result.result_rows[0][1]
                prev_start_str = prev_start.isoformat() if hasattr(prev_start, 'isoformat') else str(prev_start)
                prev_end_str = prev_end.isoformat() if hasattr(prev_end, 'isoformat') else str(prev_end)
                prev_wb.raw("timestamp >= %(prev_start_date)s", prev_start_date=prev_start_str)
                prev_wb.raw("timestamp < %(prev_end_date)s", prev_end_date=prev_end_str)
        else:
            # Default to comparing last 24h with previous 24h
            prev_wb.raw("timestamp >= now() - INTERVAL 48 HOUR")
            prev_wb.raw("timestamp < now() - INTERVAL 24 HOUR")

        prev_where_clause, prev_params = prev_wb.build()

        prev_query = f"""
            SELECT
                count(*) as total_requests,
                round(countIf(status_code >= 400) * 100.0 / count(*), 2) as error_rate,
                round(avg(response_time_ms), 2) as avg_response_time,
                round(count(*) / (dateDiff('minute', min(timestamp), max(timestamp)) + 1), 2) as requests_per_minute
            FROM logs
            {prev_where_clause}
        """

        prev_result = client.query(prev_query, parameters=prev_params)
        prev_row = prev_result.result_rows[0] if prev_result.result_rows else (0, 0.0, 0.0, 0.0)

        # Calculate trends
        def calculate_trend(current: float, previous: float, inverse_positive: bool = False) -> Optional[StatTrend]:
            if previous == 0 or current == 0:
                return None
            change_percent = round(((current - previous) / previous) * 100, 2)
            is_positive = change_percent < 0 if inverse_positive else change_percent > 0
            return StatTrend(value=abs(change_percent), is_positive=is_positive)

        return DashboardStats(
            total_requests=row[0] or 0,
            error_rate=safe_float(row[1]),
            avg_response_time=safe_float(row[2]),
            requests_per_minute=safe_float(row[3]),
            total_requests_trend=calculate_trend(row[0] or 0, prev_row[0] or 0),
            error_rate_trend=calculate_trend(safe_float(row[1]), safe_float(prev_row[1]), inverse_positive=True),
            avg_response_time_trend=calculate_trend(safe_float(row[2]), safe_float(prev_row[2]), inverse_positive=True),
            requests_per_minute_trend=calculate_trend(safe_float(row[3]), safe_float(prev_row[3])),
        )
    except Exception:
        logger.exception("Error fetching dashboard stats")
        raise HTTPException(status_code=500, detail="Error fetching dashboard stats")


@router.get("/stats/timeseries", response_model=List[TimeSeriesPoint])
async def get_timeseries_data(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    interval: Optional[str] = Query(None, description="Time interval: minute, hour, or day (auto if not specified)"),
    module: Optional[str] = Query(None),
    endpoint: Optional[str] = Query(None),
    type: Optional[Literal["all", "inbound", "outbound"]] = Query("all", description="Filter by request type"),
    _: bool = Depends(verify_auth),
):
    """Get time series data for charts."""
    try:
        client = get_clickhouse_client()

        # Auto-determine interval based on time range if not specified
        if interval is None and start_date:
            from datetime import datetime, timezone
            try:
                # Parse ISO date string
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                end_dt = datetime.now(timezone.utc) if not end_date else datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                time_diff_hours = (end_dt - start_dt).total_seconds() / 3600

                # Auto-select interval based on time range
                if time_diff_hours <= 2:  # 1-2 hours: use minute
                    interval = "minute"
                elif time_diff_hours <= 48:  # up to 2 days: use hour
                    interval = "hour"
                else:  # more than 2 days: use day
                    interval = "day"
            except Exception as e:
                logger.warning(f"Failed to auto-determine interval: {e}, defaulting to hour")
                interval = "hour"
        elif interval is None:
            interval = "hour"

        # Map interval to ClickHouse function
        interval_map = {
            "minute": "toStartOfMinute",
            "hour": "toStartOfHour",
            "day": "toStartOfDay",
        }
        time_func = interval_map.get(interval, "toStartOfHour")

        # Build WHERE conditions
        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, best_effort=True).request_type(type)
        wb.eq("module", module).eq("endpoint", endpoint)
        where_clause, params = wb.build()

        query = f"""
            SELECT
                {time_func}(timestamp) as time_bucket,
                count(*) as requests,
                countIf(status_code >= 400) as errors
            FROM logs
            {where_clause}
            GROUP BY time_bucket
            ORDER BY time_bucket ASC
        """

        result = client.query(query, parameters=params)

        data = []
        for row in result.result_rows:
            data.append(TimeSeriesPoint(
                timestamp=row[0].isoformat() if hasattr(row[0], 'isoformat') else str(row[0]),
                requests=row[1],
                errors=row[2]
            ))

        return data
    except Exception:
        logger.exception("Error fetching timeseries data")
        raise HTTPException(status_code=500, detail="Error fetching timeseries data")


@router.get("/stats/top-endpoints", response_model=List[EndpointStats])
async def get_top_endpoints(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    limit: int = Query(10, ge=1, le=100),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    type: Optional[Literal["all", "inbound", "outbound"]] = Query("all", description="Filter by request type"),
    _: bool = Depends(verify_auth),
):
    """Get top endpoints by request count."""
    try:
        client = get_clickhouse_client()

        # Build WHERE conditions
        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, best_effort=True).request_type(type)
        where_clause, params = wb.build()

        # Add limit parameter to prevent SQL injection
        params["limit"] = limit

        query = f"""
            SELECT
                endpoint,
                method,
                count(*) as request_count,
                round(avg(response_time_ms), 2) as avg_response_time,
                round(countIf(status_code >= 400) * 100.0 / count(*), 2) as error_rate,
                countIf(status_code >= 400) as error_count
            FROM logs
            {where_clause}
            GROUP BY endpoint, method
            ORDER BY request_count DESC
            LIMIT %(limit)s
        """

        result = client.query(query, parameters=params)

        endpoints = []
        for row in result.result_rows:
            endpoints.append(EndpointStats(
                endpoint=row[0],
                method=row[1],
                request_count=row[2] or 0,
                avg_response_time=safe_float(row[3]),
                error_rate=safe_float(row[4]),
                error_count=row[5] or 0
            ))

        return endpoints
    except Exception:
        logger.exception("Error fetching top endpoints")
        raise HTTPException(status_code=500, detail="Error fetching top endpoints")


@router.get("/stats/counts", response_model=RequestCounts)
async def get_request_counts(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    _: bool = Depends(verify_auth),
):
    """Get request counts for all, inbound, and outbound types."""
    try:
        client = get_clickhouse_client()

        # Build WHERE conditions
        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, best_effort=True)
        where_clause, params = wb.build()

        query = f"""
            SELECT
                count(*) as total,
                countIf(is_outbound = 0) as inbound,
                countIf(is_outbound = 1) as outbound
            FROM logs
            {where_clause}
        """

        result = client.query(query, parameters=params)
        row = result.result_rows[0] if result.result_rows else (0, 0, 0)

        return RequestCounts(
            all=row[0],
            inbound=row[1],
            outbound=row[2]
        )
    except Exception:
        logger.exception("Error fetching request counts")
        raise HTTPException(status_code=500, detail="Error fetching request counts")


@router.get("/stats/global", response_model=GlobalDashboardStats)
async def get_global_dashboard_stats(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    _: bool = Depends(verify_auth),
    db: AsyncSession = Depends(get_db),
):
    """Get global dashboard statistics across all projects."""
    try:
        client = get_clickhouse_client()

        # Build WHERE conditions
        wb = WhereBuilder()
        wb.date_range(start_date, end_date, best_effort=True)
        where_clause, params = wb.build()

        # Query to get stats per project (last 24h if no date range specified)
        query = f"""
            SELECT
                toString(project_id) as project_id,
                count(*) as total_requests,
                round(countIf(status_code >= 400) * 100.0 / count(*), 2) as error_rate,
                round(avg(response_time_ms), 2) as avg_response_time
            FROM logs
            {where_clause}
            GROUP BY project_id
            ORDER BY total_requests DESC
        """

        result = client.query(query, parameters=params)

        # Resolve project names from PostgreSQL
        project_ids = [str(row[0]) for row in result.result_rows]
        project_name_map: dict[str, str] = {}
        if project_ids:
            valid_uuids = [uuid_module.UUID(pid) for pid in project_ids if _is_valid_uuid(pid)]
            if valid_uuids:
                pg_result = await db.execute(
                    select(ProjectModel.id, ProjectModel.name).where(
                        ProjectModel.id.in_(valid_uuids)
                    )
                )
                for row_pg in pg_result.all():
                    project_name_map[str(row_pg[0])] = row_pg[1]

        # Calculate health status based on error rate
        def get_health_status(error_rate: float) -> str:
            if error_rate > 20:
                return 'critical'
            elif error_rate > 5:
                return 'warning'
            return 'healthy'

        projects = []
        total_requests_all = 0
        total_errors_all = 0

        for row in result.result_rows:
            project_id = row[0]
            total_requests = row[1] or 0
            error_rate = safe_float(row[2])
            avg_response_time = safe_float(row[3])

            total_requests_all += total_requests
            total_errors_all += int((error_rate / 100.0) * total_requests)

            project_name = project_name_map.get(project_id, f"Project {project_id[:8]}")

            projects.append(ProjectStats(
                project_id=project_id,
                project_name=project_name,
                total_requests=total_requests,
                error_rate=error_rate,
                avg_response_time=avg_response_time,
                health_status=get_health_status(error_rate)
            ))

        # Calculate overall error rate
        overall_error_rate = round((total_errors_all / total_requests_all * 100), 2) if total_requests_all > 0 else 0.0

        # Get most active projects (top 5)
        most_active = sorted(projects, key=lambda p: p.total_requests, reverse=True)[:5]

        return GlobalDashboardStats(
            total_projects=len(projects),
            total_requests=total_requests_all,
            overall_error_rate=overall_error_rate,
            projects=projects,
            most_active_projects=most_active
        )
    except Exception:
        logger.exception("Error fetching global dashboard stats")
        raise HTTPException(status_code=500, detail="Error fetching global dashboard stats")
