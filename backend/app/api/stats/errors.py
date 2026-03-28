"""Error analysis endpoints."""

import logging
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import verify_auth
from app.api.stats._common import safe_float
from app.models.stats import (
    ErrorBreakdown,
    ErrorCategory,
    ErrorEndpoint,
    ErrorEndpointStatus,
    ErrorGroup,
    ErrorGroupInstance,
    ErrorGroupsResponse,
    ErrorTimelinePoint,
    StatusCodeBreakdown,
)
from app.services.clickhouse import get_clickhouse_client
from app.services.query_builder import WhereBuilder

logger = logging.getLogger(__name__)

router = APIRouter()

# HTTP status code descriptions
STATUS_CODE_DESCRIPTIONS = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    408: "Request Timeout",
    409: "Conflict",
    410: "Gone",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
}


@router.get("/stats/error-breakdown", response_model=ErrorBreakdown)
async def get_error_breakdown(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    type: Optional[Literal["all", "inbound", "outbound"]] = Query("all", description="Filter by request type"),
    _: bool = Depends(verify_auth),
):
    """Get error breakdown by status code category."""
    try:
        client = get_clickhouse_client()

        # Build WHERE conditions
        wb = WhereBuilder()
        wb.raw("status_code >= 400")
        wb.project(project_id).date_range(start_date, end_date, best_effort=True).request_type(type)
        where_clause, params = wb.build()

        # Query for error counts by category
        category_query = f"""
            SELECT
                countIf(status_code >= 400 AND status_code < 500) as client_errors,
                countIf(status_code >= 500) as server_errors,
                count(*) as total_errors
            FROM logs
            {where_clause}
        """

        category_result = client.query(category_query, parameters=params)
        category_row = category_result.result_rows[0] if category_result.result_rows else (0, 0, 0)

        client_errors = category_row[0] or 0
        server_errors = category_row[1] or 0
        total_errors = category_row[2] or 0

        # Calculate percentages
        client_percentage = round((client_errors / total_errors * 100), 2) if total_errors > 0 else 0.0
        server_percentage = round((server_errors / total_errors * 100), 2) if total_errors > 0 else 0.0

        # Query for breakdown by status code
        status_query = f"""
            SELECT
                status_code,
                count(*) as count
            FROM logs
            {where_clause}
            GROUP BY status_code
            ORDER BY count DESC
        """

        status_result = client.query(status_query, parameters=params)

        by_status_code = []
        for row in status_result.result_rows:
            status_code = row[0]
            count = row[1] or 0
            percentage = round((count / total_errors * 100), 2) if total_errors > 0 else 0.0
            description = STATUS_CODE_DESCRIPTIONS.get(status_code, f"HTTP {status_code}")

            by_status_code.append(StatusCodeBreakdown(
                status_code=status_code,
                count=count,
                percentage=percentage,
                description=description
            ))

        return ErrorBreakdown(
            total_errors=total_errors,
            client_errors_4xx=ErrorCategory(
                count=client_errors,
                percentage=client_percentage
            ),
            server_errors_5xx=ErrorCategory(
                count=server_errors,
                percentage=server_percentage
            ),
            by_status_code=by_status_code
        )
    except Exception:
        logger.exception("Error fetching error breakdown")
        raise HTTPException(status_code=500, detail="Error fetching error breakdown")


@router.get("/stats/error-endpoints", response_model=List[ErrorEndpoint])
async def get_error_endpoints(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    limit: int = Query(10, ge=1, le=100),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    type: Optional[Literal["all", "inbound", "outbound"]] = Query("all", description="Filter by request type"),
    _: bool = Depends(verify_auth),
):
    """Get endpoints with highest error rates."""
    try:
        client = get_clickhouse_client()

        # Build WHERE conditions
        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, best_effort=True).request_type(type)
        where_clause, params = wb.build()

        params["limit"] = limit

        # Get endpoints with highest error counts
        query = f"""
            SELECT
                endpoint,
                method,
                count(*) as total_requests,
                countIf(status_code >= 400) as error_count,
                round(countIf(status_code >= 400) * 100.0 / count(*), 2) as error_rate
            FROM logs
            {where_clause}
            GROUP BY endpoint, method
            HAVING error_count > 0
            ORDER BY error_count DESC
            LIMIT %(limit)s
        """

        result = client.query(query, parameters=params)

        endpoints = []
        for row in result.result_rows:
            endpoint_name = row[0]
            method = row[1]
            total_requests = row[2] or 0
            error_count = row[3] or 0
            error_rate = safe_float(row[4])

            # Get top errors for this endpoint
            inner_wb = WhereBuilder()
            inner_wb.project(project_id).date_range(start_date, end_date, best_effort=True).request_type(type)
            inner_wb.eq("endpoint", endpoint_name, param_name="endpoint_name")
            inner_wb.eq("method", method)
            inner_wb.raw("status_code >= 400")
            error_where, error_params = inner_wb.build()

            error_query = f"""
                SELECT
                    status_code,
                    count(*) as count
                FROM logs
                {error_where}
                GROUP BY status_code
                ORDER BY count DESC
                LIMIT 5
            """

            error_result = client.query(error_query, parameters=error_params)

            top_errors = []
            for err_row in error_result.result_rows:
                top_errors.append(ErrorEndpointStatus(
                    status_code=err_row[0],
                    count=err_row[1] or 0
                ))

            endpoints.append(ErrorEndpoint(
                endpoint=endpoint_name,
                method=method,
                total_requests=total_requests,
                error_count=error_count,
                error_rate=error_rate,
                top_errors=top_errors
            ))

        return endpoints
    except Exception:
        logger.exception("Error fetching error endpoints")
        raise HTTPException(status_code=500, detail="Error fetching error endpoints")


@router.get("/stats/error-timeline", response_model=List[ErrorTimelinePoint])
async def get_error_timeline(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    interval: Optional[Literal["hour", "day"]] = Query("hour", description="Time interval"),
    type: Optional[Literal["all", "inbound", "outbound"]] = Query("all", description="Filter by request type"),
    _: bool = Depends(verify_auth),
):
    """Get error counts over time."""
    try:
        client = get_clickhouse_client()

        # Map interval to ClickHouse function
        interval_map = {
            "hour": "toStartOfHour",
            "day": "toStartOfDay",
        }
        time_func = interval_map.get(interval, "toStartOfHour")

        # Build WHERE conditions
        wb = WhereBuilder()
        wb.raw("status_code >= 400")
        wb.project(project_id).date_range(start_date, end_date, best_effort=True).request_type(type)
        where_clause, params = wb.build()

        query = f"""
            SELECT
                {time_func}(timestamp) as time_bucket,
                count(*) as total_errors,
                countIf(status_code >= 400 AND status_code < 500) as errors_4xx,
                countIf(status_code >= 500) as errors_5xx
            FROM logs
            {where_clause}
            GROUP BY time_bucket
            ORDER BY time_bucket ASC
        """

        result = client.query(query, parameters=params)

        timeline = []
        for row in result.result_rows:
            timeline.append(ErrorTimelinePoint(
                timestamp=row[0].isoformat() if hasattr(row[0], 'isoformat') else str(row[0]),
                total_errors=row[1] or 0,
                errors_4xx=row[2] or 0,
                errors_5xx=row[3] or 0
            ))

        return timeline
    except Exception:
        logger.exception("Error fetching error timeline")
        raise HTTPException(status_code=500, detail="Error fetching error timeline")


@router.get("/stats/error-groups", response_model=ErrorGroupsResponse)
async def get_error_groups(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    status_category: Optional[Literal["all", "4xx", "5xx"]] = Query("all"),
    type: Optional[Literal["all", "inbound", "outbound"]] = Query("all", description="Filter by request type"),
    limit: int = Query(50, ge=1, le=200),
    _: bool = Depends(verify_auth),
):
    """Get errors grouped by endpoint + method + status code."""
    try:
        client = get_clickhouse_client()

        # Base conditions
        def base_wb():
            wb = WhereBuilder()
            wb.raw("status_code >= 400")
            wb.project(project_id).date_range(start_date, end_date, best_effort=True).request_type(type)
            if status_category == "4xx":
                wb.raw("status_code >= 400 AND status_code < 500")
            elif status_category == "5xx":
                wb.raw("status_code >= 500")
            return wb

        # Summary counts
        wb = base_wb()
        where_clause, params = wb.build()

        summary_query = f"""
            SELECT
                count(*) as total,
                countIf(status_code >= 400 AND status_code < 500) as client_4xx,
                countIf(status_code >= 500) as server_5xx
            FROM logs
            {where_clause}
        """
        summary_result = client.query(summary_query, parameters=params)
        sr = summary_result.result_rows[0] if summary_result.result_rows else (0, 0, 0)

        # Grouped errors
        wb = base_wb()
        where_clause, params = wb.build()
        params["limit"] = limit

        groups_query = f"""
            SELECT
                endpoint,
                method,
                status_code,
                count(*) as cnt,
                min(timestamp) as first_seen,
                max(timestamp) as last_seen,
                round(avg(response_time_ms), 2) as avg_rt,
                uniqExact(user_id) as affected_users
            FROM logs
            {where_clause}
            GROUP BY endpoint, method, status_code
            ORDER BY cnt DESC
            LIMIT %(limit)s
        """
        groups_result = client.query(groups_query, parameters=params)

        groups = []
        for row in groups_result.result_rows:
            ep, meth, sc = row[0], row[1], row[2]

            # Fetch recent 5 instances for this group
            inner_wb = base_wb()
            inner_wb.eq("endpoint", ep, param_name="g_endpoint")
            inner_wb.eq("method", meth, param_name="g_method")
            inner_wb.raw("status_code = %(g_status_code)s", g_status_code=sc)
            inner_where, inner_params = inner_wb.build()

            instances_query = f"""
                SELECT request_id, timestamp, response_time_ms, user_id, user_name
                FROM logs
                {inner_where}
                ORDER BY timestamp DESC
                LIMIT 5
            """
            inst_result = client.query(instances_query, parameters=inner_params)
            instances = [
                ErrorGroupInstance(
                    request_id=str(ir[0]),
                    timestamp=ir[1].isoformat() if hasattr(ir[1], 'isoformat') else str(ir[1]),
                    response_time_ms=safe_float(ir[2]),
                    user_id=str(ir[3]) if ir[3] else "",
                    user_name=str(ir[4]) if ir[4] else "",
                )
                for ir in inst_result.result_rows
            ]

            groups.append(ErrorGroup(
                endpoint=ep,
                method=meth,
                status_code=sc,
                status_description=STATUS_CODE_DESCRIPTIONS.get(sc, f"HTTP {sc}"),
                count=row[3] or 0,
                first_seen=row[4].isoformat() if hasattr(row[4], 'isoformat') else str(row[4]),
                last_seen=row[5].isoformat() if hasattr(row[5], 'isoformat') else str(row[5]),
                avg_response_time=safe_float(row[6]),
                affected_users=row[7] or 0,
                recent_instances=instances,
            ))

        return ErrorGroupsResponse(
            total_errors=sr[0] or 0,
            total_groups=len(groups),
            client_errors=sr[1] or 0,
            server_errors=sr[2] or 0,
            groups=groups,
        )
    except Exception:
        logger.exception("Error fetching error groups")
        raise HTTPException(status_code=500, detail="Error fetching error groups")
