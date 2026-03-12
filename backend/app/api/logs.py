import logging
import math
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import verify_auth
from app.models.log import LogEntry, PaginatedResponse
from app.services.clickhouse import get_clickhouse_client

logger = logging.getLogger(__name__)

router = APIRouter()


def build_where_clause(
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    endpoint: Optional[str] = None,
    module: Optional[str] = None,
    user: Optional[str] = None,
    request_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> tuple[str, dict]:
    """Build WHERE clause with parameterized conditions."""
    conditions = []
    params = {}

    # Add project_id filter if provided
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

    if endpoint:
        conditions.append("endpoint LIKE %(endpoint)s")
        params["endpoint"] = f"%{endpoint}%"

    if module:
        conditions.append("module = %(module)s")
        params["module"] = module

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

    where_clause = " AND ".join(conditions) if conditions else "1=1"
    return where_clause, params


@router.get("/logs", response_model=PaginatedResponse)
async def get_logs(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    status: Optional[str] = Query(None, description="Filter by status code category (2xx, 3xx, 4xx, 5xx, error, success)"),
    endpoint: Optional[str] = Query(None, description="Filter by endpoint (partial match)"),
    module: Optional[str] = Query(None, description="Filter by module (exact match)"),
    user: Optional[str] = Query(None, description="Filter by user ID or name"),
    request_id: Optional[str] = Query(None, description="Filter by request ID (partial match)"),
    start_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)"),
    end_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    _: bool = Depends(verify_auth),
):
    """Get paginated log entries with optional filters."""
    try:
        client = get_clickhouse_client()

        # Build WHERE clause with parameterized queries
        where_clause, params = build_where_clause(
            project_id=project_id,
            status=status,
            endpoint=endpoint,
            module=module,
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
        # Add pagination parameters to prevent SQL injection
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
                tags,
                is_outbound,
                third_party_service,
                request_body,
                response_body
            FROM logs
            WHERE {where_clause}
            ORDER BY timestamp DESC
            LIMIT %(page_size)s OFFSET %(offset)s
        """

        result = client.query(data_query, parameters=params)

        logs = []
        for row in result.result_rows:
            logs.append(LogEntry(
                id=row[0],
                request_id=row[1],
                timestamp=row[2],
                endpoint=row[3],
                method=row[4],
                status_code=row[5],
                response_time_ms=row[6],
                user_id=row[7],
                user_name=row[8],
                module=row[9],
                tags=row[10] if row[10] else [],
                is_outbound=row[11],
                third_party_service=row[12],
                request_body=row[13],
                response_body=row[14],
            ))

        return PaginatedResponse(
            data=logs,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
    except Exception as e:
        logger.error(f"Error fetching logs: {e}")
        raise HTTPException(status_code=500, detail="Error fetching logs")


@router.get("/logs/{log_id}", response_model=LogEntry)
async def get_log_by_id(
    log_id: str,
    _: bool = Depends(verify_auth),
):
    """Get a specific log entry by ID."""
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
                is_outbound,
                third_party_service,
                request_body,
                response_body
            FROM logs
            WHERE toString(id) = %(log_id)s
            LIMIT 1
        """

        result = client.query(query, parameters={"log_id": log_id})

        if not result.result_rows:
            raise HTTPException(status_code=404, detail="Log entry not found")

        row = result.result_rows[0]
        return LogEntry(
            id=row[0],
            request_id=row[1],
            timestamp=row[2],
            endpoint=row[3],
            method=row[4],
            status_code=row[5],
            response_time_ms=row[6],
            user_id=row[7],
            user_name=row[8],
            module=row[9],
            tags=row[10] if row[10] else [],
            is_outbound=row[11],
            third_party_service=row[12],
            request_body=row[13],
            response_body=row[14],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching log entry {log_id}: {e}")
        raise HTTPException(status_code=500, detail="Error fetching log entry")


@router.get("/modules", response_model=List[str], summary="List all modules")
async def get_modules(_: bool = Depends(verify_auth)):
    """Get list of all distinct modules from logs."""
    try:
        client = get_clickhouse_client()
        query = """
            SELECT DISTINCT module
            FROM logs
            WHERE module IS NOT NULL AND module != ''
            ORDER BY module
        """
        result = client.query(query)
        return [row[0] for row in result.result_rows]
    except Exception as e:
        logger.error(f"Error fetching modules: {e}")
        raise HTTPException(status_code=500, detail="Error fetching modules")


@router.get("/endpoints", response_model=List[str], summary="List all endpoints")
async def get_endpoints(_: bool = Depends(verify_auth)):
    """Get list of all distinct endpoints from logs."""
    try:
        client = get_clickhouse_client()
        query = """
            SELECT DISTINCT endpoint
            FROM logs
            WHERE endpoint IS NOT NULL AND endpoint != ''
            ORDER BY endpoint
        """
        result = client.query(query)
        return [row[0] for row in result.result_rows]
    except Exception as e:
        logger.error(f"Error fetching endpoints: {e}")
        raise HTTPException(status_code=500, detail="Error fetching endpoints")
