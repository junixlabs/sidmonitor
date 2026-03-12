"""
Inbound API endpoints for querying and analyzing inbound HTTP logs.

Data source: logs table (ClickHouse) with is_outbound = false
"""
import logging
import math
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import verify_auth
from app.api.stats._common import safe_float
from app.models.inbound import (
    InboundEndpointStats,
    InboundLogDetail,
    InboundLogResponse,
    InboundModuleStats,
    InboundOverallStats,
    InboundPaginatedResponse,
)
from app.services.clickhouse import get_clickhouse_client

router = APIRouter()
logger = logging.getLogger(__name__)


def build_inbound_where_clause(
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    module: Optional[str] = None,
    endpoint: Optional[str] = None,
    method: Optional[str] = None,
    user: Optional[str] = None,
    request_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> tuple[str, dict]:
    """Build WHERE clause for inbound logs query."""
    # Base condition: only inbound logs
    conditions = ["is_outbound = 0"]
    params = {}

    if project_id:
        conditions.append("toString(project_id) = %(project_id)s")
        params["project_id"] = project_id

    if status:
        if status == "2xx":
            conditions.append("status_code >= 200 AND status_code < 300")
        elif status == "3xx":
            conditions.append("status_code >= 300 AND status_code < 400")
        elif status == "4xx":
            conditions.append("status_code >= 400 AND status_code < 500")
        elif status == "5xx":
            conditions.append("status_code >= 500")
        elif status == "error":
            conditions.append("status_code >= 400")
        elif status == "success":
            conditions.append("status_code >= 200 AND status_code < 400")

    if module:
        conditions.append("module = %(module)s")
        params["module"] = module

    if endpoint:
        conditions.append("endpoint LIKE %(endpoint)s")
        params["endpoint"] = f"%{endpoint}%"

    if method:
        conditions.append("method = %(method)s")
        params["method"] = method.upper()

    if user:
        conditions.append("(user_id = %(user)s OR user_name LIKE %(user_pattern)s)")
        params["user"] = user
        params["user_pattern"] = f"%{user}%"

    if request_id:
        conditions.append("request_id LIKE %(request_id)s")
        params["request_id"] = f"%{request_id}%"

    if start_date:
        conditions.append("timestamp >= %(start_date)s")
        params["start_date"] = start_date

    if end_date:
        conditions.append("timestamp <= %(end_date)s")
        params["end_date"] = end_date

    where_clause = " AND ".join(conditions)
    return where_clause, params


# ============================================
# Stats Endpoints
# ============================================

@router.get("/stats/inbound", response_model=InboundOverallStats)
async def get_inbound_stats(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None, description="Start date"),
    end_date: Optional[str] = Query(None, description="End date"),
    _: bool = Depends(verify_auth),
):
    """Get overall inbound logs statistics."""
    try:
        client = get_clickhouse_client()

        params = {}
        conditions = ["is_outbound = 0"]

        if project_id:
            conditions.append("toString(project_id) = %(project_id)s")
            params["project_id"] = project_id

        if start_date:
            conditions.append("timestamp >= %(start_date)s")
            params["start_date"] = start_date

        if end_date:
            conditions.append("timestamp <= %(end_date)s")
            params["end_date"] = end_date

        where_clause = "WHERE " + " AND ".join(conditions)

        query = f"""
            SELECT
                count(*) as total_requests,
                countIf(status_code >= 200 AND status_code < 400) as success_count,
                countIf(status_code >= 400) as error_count,
                round(countIf(status_code >= 200 AND status_code < 400) * 100.0 / count(*), 2) as success_rate,
                round(avg(response_time_ms), 2) as avg_response_time_ms,
                round(quantile(0.95)(response_time_ms), 2) as p95_response_time_ms,
                uniq(module) as modules_count
            FROM logs
            {where_clause}
        """

        result = client.query(query, parameters=params)
        row = result.result_rows[0] if result.result_rows else (0, 0, 0, 0.0, 0.0, 0.0, 0)

        return InboundOverallStats(
            total_requests=row[0] or 0,
            success_count=row[1] or 0,
            error_count=row[2] or 0,
            success_rate=safe_float(row[3]),
            avg_response_time_ms=safe_float(row[4]),
            p95_response_time_ms=safe_float(row[5]),
            modules_count=row[6] or 0,
        )
    except Exception as e:
        logger.error(f"Error fetching inbound stats: {e}")
        return InboundOverallStats(
            total_requests=0,
            success_count=0,
            error_count=0,
            success_rate=0.0,
            avg_response_time_ms=0.0,
            p95_response_time_ms=0.0,
            modules_count=0,
        )


@router.get("/stats/inbound/by-module", response_model=List[InboundModuleStats])
async def get_inbound_stats_by_module(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None, description="Start date"),
    end_date: Optional[str] = Query(None, description="End date"),
    limit: int = Query(20, ge=1, le=100),
    _: bool = Depends(verify_auth),
):
    """Get inbound statistics grouped by module."""
    try:
        client = get_clickhouse_client()

        params = {"limit": limit}
        conditions = ["is_outbound = 0", "module IS NOT NULL", "module != ''"]

        if project_id:
            conditions.append("toString(project_id) = %(project_id)s")
            params["project_id"] = project_id

        if start_date:
            conditions.append("timestamp >= %(start_date)s")
            params["start_date"] = start_date

        if end_date:
            conditions.append("timestamp <= %(end_date)s")
            params["end_date"] = end_date

        where_clause = "WHERE " + " AND ".join(conditions)

        query = f"""
            SELECT
                module,
                count(*) as total_requests,
                countIf(status_code >= 200 AND status_code < 400) as success_count,
                countIf(status_code >= 400) as error_count,
                round(countIf(status_code >= 200 AND status_code < 400) * 100.0 / count(*), 2) as success_rate,
                round(countIf(status_code >= 400) * 100.0 / count(*), 2) as error_rate,
                round(avg(response_time_ms), 2) as avg_response_time_ms,
                round(quantile(0.95)(response_time_ms), 2) as p95_response_time_ms
            FROM logs
            {where_clause}
            GROUP BY module
            ORDER BY total_requests DESC
            LIMIT %(limit)s
        """

        result = client.query(query, parameters=params)

        modules = []
        for row in result.result_rows:
            modules.append(InboundModuleStats(
                module=row[0] or '',
                total_requests=row[1] or 0,
                success_count=row[2] or 0,
                error_count=row[3] or 0,
                success_rate=safe_float(row[4]),
                error_rate=safe_float(row[5]),
                avg_response_time_ms=safe_float(row[6]),
                p95_response_time_ms=safe_float(row[7]),
            ))

        return modules
    except Exception as e:
        logger.error(f"Error fetching inbound stats by module: {e}")
        return []


@router.get("/stats/inbound/modules/{module_name}/endpoints", response_model=List[InboundEndpointStats])
async def get_inbound_module_endpoints(
    module_name: str,
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None, description="Start date"),
    end_date: Optional[str] = Query(None, description="End date"),
    limit: int = Query(50, ge=1, le=100),
    _: bool = Depends(verify_auth),
):
    """Get endpoint statistics for a specific module.

    Groups similar URLs by replacing numeric path segments with {id} placeholders.
    For example, /users/123 and /users/456 will be grouped as /users/{id}.
    """
    try:
        client = get_clickhouse_client()

        params = {"module_name": module_name, "limit": limit}
        conditions = ["is_outbound = 0", "module = %(module_name)s"]

        if project_id:
            conditions.append("toString(project_id) = %(project_id)s")
            params["project_id"] = project_id

        if start_date:
            conditions.append("timestamp >= %(start_date)s")
            params["start_date"] = start_date

        if end_date:
            conditions.append("timestamp <= %(end_date)s")
            params["end_date"] = end_date

        where_clause = "WHERE " + " AND ".join(conditions)

        # Normalize endpoint by replacing numeric segments with {id}
        query = f"""
            WITH
                -- Replace numeric segments with {{id}}
                -- Pattern: replace /123/ or /123 at end with /{{id}}
                replaceRegexpAll(endpoint, '/[0-9]+(?=/|$)', '/{{id}}') as normalized_endpoint
            SELECT
                normalized_endpoint as endpoint_pattern,
                method,
                count(*) as total_requests,
                countIf(status_code >= 200 AND status_code < 400) as success_count,
                countIf(status_code >= 400) as error_count,
                round(countIf(status_code >= 200 AND status_code < 400) * 100.0 / count(*), 2) as success_rate,
                round(countIf(status_code >= 400) * 100.0 / count(*), 2) as error_rate,
                round(avg(response_time_ms), 2) as avg_response_time_ms,
                round(quantile(0.95)(response_time_ms), 2) as p95_response_time_ms,
                round(quantile(0.99)(response_time_ms), 2) as p99_response_time_ms
            FROM logs
            {where_clause}
            GROUP BY normalized_endpoint, method
            ORDER BY total_requests DESC
            LIMIT %(limit)s
        """

        result = client.query(query, parameters=params)

        endpoints = []
        for row in result.result_rows:
            endpoints.append(InboundEndpointStats(
                endpoint_pattern=row[0] or '',
                method=row[1] or '',
                total_requests=row[2] or 0,
                success_count=row[3] or 0,
                error_count=row[4] or 0,
                success_rate=safe_float(row[5]),
                error_rate=safe_float(row[6]),
                avg_response_time_ms=safe_float(row[7]),
                p95_response_time_ms=safe_float(row[8]),
                p99_response_time_ms=safe_float(row[9]),
            ))

        return endpoints
    except Exception as e:
        logger.error(f"Error fetching inbound module endpoints for {module_name}: {e}")
        return []


# ============================================
# Query Endpoints
# ============================================

@router.get("/logs/inbound", response_model=InboundPaginatedResponse)
async def get_inbound_logs(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    status: Optional[str] = Query(None, description="Filter by status (2xx, 3xx, 4xx, 5xx, error, success)"),
    module: Optional[str] = Query(None, description="Filter by module"),
    endpoint: Optional[str] = Query(None, description="Filter by endpoint (partial match)"),
    method: Optional[str] = Query(None, description="Filter by HTTP method"),
    user: Optional[str] = Query(None, description="Filter by user ID or name"),
    request_id: Optional[str] = Query(None, description="Filter by request ID"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)"),
    end_date: Optional[str] = Query(None, description="End date"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    _: bool = Depends(verify_auth),
):
    """Get paginated inbound log entries with optional filters."""
    try:
        client = get_clickhouse_client()

        where_clause, params = build_inbound_where_clause(
            project_id=project_id,
            status=status,
            module=module,
            endpoint=endpoint,
            method=method,
            user=user,
            request_id=request_id,
            start_date=start_date,
            end_date=end_date,
        )
        offset = (page - 1) * page_size

        # Get total count
        count_query = f"SELECT count(*) FROM logs WHERE {where_clause}"
        count_result = client.query(count_query, parameters=params)
        total = count_result.result_rows[0][0] if count_result.result_rows else 0
        total_pages = math.ceil(total / page_size) if total > 0 else 0

        # Get paginated data
        params["page_size"] = page_size
        params["offset"] = offset

        data_query = f"""
            SELECT
                toString(id) as id,
                request_id,
                formatDateTime(timestamp, '%%Y-%%m-%%d %%H:%%i:%%S') as timestamp,
                endpoint,
                method,
                status_code,
                response_time_ms,
                user_id,
                user_name,
                module,
                tags
            FROM logs
            WHERE {where_clause}
            ORDER BY timestamp DESC
            LIMIT %(page_size)s OFFSET %(offset)s
        """

        result = client.query(data_query, parameters=params)

        logs = []
        for row in result.result_rows:
            logs.append(InboundLogResponse(
                id=row[0],
                request_id=row[1],
                timestamp=row[2],
                endpoint=row[3],
                method=row[4],
                status_code=row[5],
                response_time_ms=row[6] or 0.0,
                user_id=row[7],
                user_name=row[8],
                module=row[9],
                tags=row[10] if row[10] else [],
            ))

        return InboundPaginatedResponse(
            data=logs,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
    except Exception as e:
        logger.error(f"Error fetching inbound logs: {e}")
        return InboundPaginatedResponse(
            data=[],
            total=0,
            page=page,
            page_size=page_size,
            total_pages=0,
        )


# IMPORTANT: Specific routes MUST be defined BEFORE parameterized routes
# Otherwise FastAPI will match "/modules" or "/endpoints" as a log_id value

@router.get("/logs/inbound/modules", response_model=List[str], summary="List inbound modules")
async def get_inbound_modules(
    project_id: Optional[str] = Query(None, description="Filter by project ID (UUID)"),
    _: bool = Depends(verify_auth),
):
    """Get list of all distinct modules from inbound logs."""
    try:
        client = get_clickhouse_client()

        params = {}
        conditions = ["is_outbound = 0", "module IS NOT NULL", "module != ''"]

        if project_id:
            conditions.append("toString(project_id) = %(project_id)s")
            params["project_id"] = project_id

        where_clause = " AND ".join(conditions)

        query = f"""
            SELECT DISTINCT module
            FROM logs
            WHERE {where_clause}
            ORDER BY module
        """
        result = client.query(query, parameters=params)
        return [row[0] for row in result.result_rows]
    except Exception as e:
        logger.error(f"Error fetching inbound modules: {e}")
        return []


@router.get("/logs/inbound/endpoints", response_model=List[str], summary="List inbound endpoints")
async def get_inbound_endpoints(
    project_id: Optional[str] = Query(None, description="Filter by project ID (UUID)"),
    module: Optional[str] = Query(None, description="Filter by module name"),
    _: bool = Depends(verify_auth),
):
    """Get list of all distinct endpoints from inbound logs."""
    try:
        client = get_clickhouse_client()

        params = {}
        conditions = ["is_outbound = 0", "endpoint IS NOT NULL", "endpoint != ''"]

        if project_id:
            conditions.append("toString(project_id) = %(project_id)s")
            params["project_id"] = project_id

        if module:
            conditions.append("module = %(module)s")
            params["module"] = module

        where_clause = " AND ".join(conditions)

        query = f"""
            SELECT DISTINCT endpoint
            FROM logs
            WHERE {where_clause}
            ORDER BY endpoint
        """
        result = client.query(query, parameters=params)
        return [row[0] for row in result.result_rows]
    except Exception as e:
        logger.error(f"Error fetching inbound endpoints: {e}")
        return []


# Parameterized route MUST be AFTER specific routes
@router.get("/logs/inbound/{log_id}", response_model=InboundLogDetail)
async def get_inbound_log_by_id(
    log_id: str,
    _: bool = Depends(verify_auth),
):
    """Get a specific inbound log entry by ID."""
    try:
        client = get_clickhouse_client()

        query = """
            SELECT
                toString(id) as id,
                request_id,
                formatDateTime(timestamp, '%%Y-%%m-%%d %%H:%%i:%%S') as timestamp,
                endpoint,
                method,
                status_code,
                response_time_ms,
                user_id,
                user_name,
                module,
                tags,
                request_body,
                response_body
            FROM logs
            WHERE toString(id) = %(log_id)s AND is_outbound = 0
            LIMIT 1
        """

        result = client.query(query, parameters={"log_id": log_id})

        if not result.result_rows:
            raise HTTPException(status_code=404, detail="Inbound log entry not found")

        row = result.result_rows[0]
        return InboundLogDetail(
            id=row[0],
            request_id=row[1],
            timestamp=row[2],
            endpoint=row[3],
            method=row[4],
            status_code=row[5],
            response_time_ms=row[6] or 0.0,
            user_id=row[7],
            user_name=row[8],
            module=row[9],
            tags=row[10] if row[10] else [],
            request_body=row[11],
            response_body=row[12],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching inbound log entry {log_id}: {e}")
        raise HTTPException(status_code=500, detail="Error fetching inbound log entry")
