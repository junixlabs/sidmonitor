import logging
import math
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.auth import verify_auth
from app.api.ingest import verify_api_key_and_get_project
from app.api.stats._common import safe_float
from app.constants import DEFAULT_PROJECT_ID
from app.models.database import Project
from app.models.outbound import (
    BatchOutboundIngestRequest,
    OutboundEndpointStats,
    OutboundHostStats,
    OutboundIngestResponse,
    OutboundLogDetail,
    OutboundLogEntry,
    OutboundLogResponse,
    OutboundOverallStats,
    OutboundPaginatedResponse,
    OutboundServiceStats,
)
from app.services.clickhouse import get_clickhouse_client
from app.services.query_builder import WhereBuilder

router = APIRouter()
logger = logging.getLogger(__name__)


# ============================================
# Ingest Endpoints
# ============================================

def insert_outbound_log_entry(
    entry: OutboundLogEntry,
    project_id: Optional[uuid.UUID] = None
) -> None:
    """Insert a single outbound log entry into ClickHouse."""
    client = get_clickhouse_client()

    pid = str(project_id) if project_id else DEFAULT_PROJECT_ID
    is_success = 1 if 200 <= entry.status_code < 400 else 0

    client.insert(
        "outbound_logs",
        [[
            pid,
            entry.request_id,
            entry.parent_request_id or '',
            entry.trace_id or '',
            entry.span_id or '',
            entry.timestamp,
            entry.service_name,
            entry.target_host,
            entry.target_url,
            entry.method,
            entry.status_code,
            entry.latency_ms,
            is_success,
            entry.request_size or 0,
            entry.response_size or 0,
            entry.error_message or '',
            entry.error_code or '',
            entry.retry_count or 0,
            entry.module or '',
            entry.user_id or '',
            entry.request_headers or '',
            entry.response_headers or '',
            entry.request_body or '',
            entry.response_body or '',
            entry.tags or [],
            entry.metadata or '',
        ]],
        column_names=[
            "project_id", "request_id", "parent_request_id", "trace_id", "span_id",
            "timestamp", "service_name", "target_host", "target_url", "method",
            "status_code", "latency_ms", "is_success", "request_size", "response_size",
            "error_message", "error_code", "retry_count", "module", "user_id",
            "request_headers", "response_headers", "request_body", "response_body",
            "tags", "metadata",
        ],
    )


@router.post("/ingest/outbound", response_model=OutboundIngestResponse)
async def ingest_outbound_log(
    entry: OutboundLogEntry,
    project: Optional[Project] = Depends(verify_api_key_and_get_project),
):
    """Ingest a single outbound log entry."""
    try:
        project_id = project.id if project else None
        insert_outbound_log_entry(entry, project_id)

        return OutboundIngestResponse(
            success=True,
            message="Outbound log entry ingested successfully",
            ingested_count=1,
        )
    except Exception as e:
        logger.error(f"Error ingesting outbound log entry: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error ingesting outbound log entry: {str(e)}",
        )


@router.post("/ingest/outbound/batch", response_model=OutboundIngestResponse)
async def ingest_outbound_batch(
    batch: BatchOutboundIngestRequest,
    project: Optional[Project] = Depends(verify_api_key_and_get_project),
):
    """Ingest multiple outbound log entries in a batch."""
    try:
        client = get_clickhouse_client()
        pid = str(project.id) if project else DEFAULT_PROJECT_ID

        rows = []
        for entry in batch.logs:
            is_success = 1 if 200 <= entry.status_code < 400 else 0
            rows.append([
                pid,
                entry.request_id,
                entry.parent_request_id or '',
                entry.trace_id or '',
                entry.span_id or '',
                entry.timestamp,
                entry.service_name,
                entry.target_host,
                entry.target_url,
                entry.method,
                entry.status_code,
                entry.latency_ms,
                is_success,
                entry.request_size or 0,
                entry.response_size or 0,
                entry.error_message or '',
                entry.error_code or '',
                entry.retry_count or 0,
                entry.module or '',
                entry.user_id or '',
                entry.request_headers or '',
                entry.response_headers or '',
                entry.request_body or '',
                entry.response_body or '',
                entry.tags or [],
                entry.metadata or '',
            ])

        if rows:
            client.insert(
                "outbound_logs",
                rows,
                column_names=[
                    "project_id", "request_id", "parent_request_id", "trace_id", "span_id",
                    "timestamp", "service_name", "target_host", "target_url", "method",
                    "status_code", "latency_ms", "is_success", "request_size", "response_size",
                    "error_message", "error_code", "retry_count", "module", "user_id",
                    "request_headers", "response_headers", "request_body", "response_body",
                    "tags", "metadata",
                ],
            )

        return OutboundIngestResponse(
            success=True,
            message=f"Batch ingested successfully ({len(rows)} entries)",
            ingested_count=len(rows),
        )
    except Exception as e:
        logger.error(f"Error ingesting outbound batch: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error ingesting outbound batch: {str(e)}",
        )


# ============================================
# Query Endpoints
# ============================================


@router.get("/logs/outbound", response_model=OutboundPaginatedResponse)
async def get_outbound_logs(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    service_name: Optional[str] = Query(None, description="Filter by service name"),
    target_host: Optional[str] = Query(None, description="Filter by target host"),
    status: Optional[str] = Query(None, description="Filter by status (2xx, 3xx, 4xx, 5xx, error, success)"),
    method: Optional[str] = Query(None, description="Filter by HTTP method"),
    request_id: Optional[str] = Query(None, description="Filter by request ID"),
    trace_id: Optional[str] = Query(None, description="Filter by trace ID"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)"),
    end_date: Optional[str] = Query(None, description="End date"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    _: bool = Depends(verify_auth),
):
    """Get paginated outbound log entries with optional filters."""
    try:
        client = get_clickhouse_client()

        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, best_effort=True)
        wb.eq("service_name", service_name)
        wb.like("target_host", target_host)
        wb.status_code(status)
        wb.eq("method", method.upper() if method else None)
        wb.like("request_id", request_id)
        wb.eq("trace_id", trace_id)
        where_clause, params = wb.build_conditions()
        offset = (page - 1) * page_size

        # Get total count
        count_query = f"SELECT count(*) FROM outbound_logs WHERE {where_clause}"
        count_result = client.query(count_query, parameters=params)
        total = count_result.result_rows[0][0] if count_result.result_rows else 0
        total_pages = math.ceil(total / page_size) if total > 0 else 0

        # Get paginated data
        params["page_size"] = page_size
        params["offset"] = offset

        data_query = f"""
            SELECT
                toString(id) as id,
                toString(project_id) as project_id,
                request_id,
                parent_request_id,
                trace_id,
                span_id,
                formatDateTime(timestamp, '%%Y-%%m-%%d %%H:%%i:%%S') as timestamp,
                service_name,
                target_host,
                target_url,
                method,
                status_code,
                latency_ms,
                is_success,
                request_size,
                response_size,
                error_message,
                error_code,
                retry_count,
                module,
                user_id,
                tags
            FROM outbound_logs
            WHERE {where_clause}
            ORDER BY timestamp DESC
            LIMIT %(page_size)s OFFSET %(offset)s
        """

        result = client.query(data_query, parameters=params)

        logs = []
        for row in result.result_rows:
            logs.append(OutboundLogResponse(
                id=row[0],
                project_id=row[1],
                request_id=row[2],
                parent_request_id=row[3],
                trace_id=row[4],
                span_id=row[5],
                timestamp=row[6],
                service_name=row[7],
                target_host=row[8],
                target_url=row[9],
                method=row[10],
                status_code=row[11],
                latency_ms=row[12],
                is_success=bool(row[13]),
                request_size=row[14],
                response_size=row[15],
                error_message=row[16],
                error_code=row[17],
                retry_count=row[18],
                module=row[19],
                user_id=row[20],
                tags=row[21] if row[21] else [],
            ))

        return OutboundPaginatedResponse(
            data=logs,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
    except Exception as e:
        logger.error(f"Error fetching outbound logs: {e}")
        raise HTTPException(status_code=500, detail="Error fetching outbound logs")


# IMPORTANT: Specific routes MUST be defined BEFORE parameterized routes
# Otherwise FastAPI will match "/services" as a log_id value

@router.get("/logs/outbound/services", response_model=List[str], summary="List outbound services")
async def get_outbound_services(
    project_id: Optional[str] = Query(None, description="Filter by project ID (UUID)"),
    _: bool = Depends(verify_auth),
):
    """Get list of all distinct service names from outbound logs."""
    try:
        client = get_clickhouse_client()

        wb = WhereBuilder()
        wb.project(project_id).not_empty("service_name")
        where_clause, params = wb.build()

        query = f"""
            SELECT DISTINCT service_name
            FROM outbound_logs
            {where_clause}
            ORDER BY service_name
        """
        result = client.query(query, parameters=params)
        return [row[0] for row in result.result_rows]
    except Exception as e:
        logger.error(f"Error fetching outbound services: {e}")
        raise HTTPException(status_code=500, detail="Error fetching outbound services")


@router.get("/logs/outbound/hosts", response_model=List[str], summary="List outbound hosts")
async def get_outbound_hosts(
    project_id: Optional[str] = Query(None, description="Filter by project ID (UUID)"),
    _: bool = Depends(verify_auth),
):
    """Get list of all distinct target hosts from outbound logs."""
    try:
        client = get_clickhouse_client()

        wb = WhereBuilder()
        wb.project(project_id).not_empty("target_host")
        where_clause, params = wb.build()

        query = f"""
            SELECT DISTINCT target_host
            FROM outbound_logs
            {where_clause}
            ORDER BY target_host
        """
        result = client.query(query, parameters=params)
        return [row[0] for row in result.result_rows]
    except Exception as e:
        logger.error(f"Error fetching outbound hosts: {e}")
        raise HTTPException(status_code=500, detail="Error fetching outbound hosts")


# Parameterized route MUST be AFTER specific routes
@router.get("/logs/outbound/{log_id}", response_model=OutboundLogDetail)
async def get_outbound_log_by_id(
    log_id: str,
    _: bool = Depends(verify_auth),
):
    """Get a specific outbound log entry by ID."""
    try:
        client = get_clickhouse_client()

        query = """
            SELECT
                toString(id) as id,
                toString(project_id) as project_id,
                request_id,
                parent_request_id,
                trace_id,
                span_id,
                formatDateTime(timestamp, '%%Y-%%m-%%d %%H:%%i:%%S') as timestamp,
                service_name,
                target_host,
                target_url,
                method,
                status_code,
                latency_ms,
                is_success,
                request_size,
                response_size,
                error_message,
                error_code,
                retry_count,
                module,
                user_id,
                tags,
                request_headers,
                response_headers,
                request_body,
                response_body,
                metadata
            FROM outbound_logs
            WHERE toString(id) = %(log_id)s
            LIMIT 1
        """

        result = client.query(query, parameters={"log_id": log_id})

        if not result.result_rows:
            raise HTTPException(status_code=404, detail="Outbound log entry not found")

        row = result.result_rows[0]
        return OutboundLogDetail(
            id=row[0],
            project_id=row[1],
            request_id=row[2],
            parent_request_id=row[3],
            trace_id=row[4],
            span_id=row[5],
            timestamp=row[6],
            service_name=row[7],
            target_host=row[8],
            target_url=row[9],
            method=row[10],
            status_code=row[11],
            latency_ms=row[12],
            is_success=bool(row[13]),
            request_size=row[14],
            response_size=row[15],
            error_message=row[16],
            error_code=row[17],
            retry_count=row[18],
            module=row[19],
            user_id=row[20],
            tags=row[21] if row[21] else [],
            request_headers=row[22],
            response_headers=row[23],
            request_body=row[24],
            response_body=row[25],
            metadata=row[26],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching outbound log entry {log_id}: {e}")
        raise HTTPException(status_code=500, detail="Error fetching outbound log entry")


# ============================================
# Stats Endpoints
# ============================================

@router.get("/stats/outbound", response_model=OutboundOverallStats)
async def get_outbound_stats(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None, description="Start date"),
    end_date: Optional[str] = Query(None, description="End date"),
    _: bool = Depends(verify_auth),
):
    """Get overall outbound logs statistics."""
    try:
        client = get_clickhouse_client()

        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, best_effort=True)
        where_clause, params = wb.build()

        query = f"""
            SELECT
                count(*) as total_requests,
                countIf(is_success = 1) as success_count,
                countIf(is_success = 0) as failure_count,
                round(countIf(is_success = 1) * 100.0 / count(*), 2) as success_rate,
                round(avg(latency_ms), 2) as avg_latency_ms,
                round(quantile(0.95)(latency_ms), 2) as p95_latency_ms,
                uniq(service_name) as services_count,
                countIf(status_code = 408 OR status_code = 504) as timeout_count,
                sum(retry_count) as total_retries
            FROM outbound_logs
            {where_clause}
        """

        result = client.query(query, parameters=params)
        row = result.result_rows[0] if result.result_rows else (0, 0, 0, 0.0, 0.0, 0.0, 0, 0, 0)

        return OutboundOverallStats(
            total_requests=row[0] or 0,
            success_count=row[1] or 0,
            failure_count=row[2] or 0,
            success_rate=safe_float(row[3]),
            avg_latency_ms=safe_float(row[4]),
            p95_latency_ms=safe_float(row[5]),
            services_count=row[6] or 0,
            timeout_count=row[7] or 0,
            total_retries=row[8] or 0,
        )
    except Exception as e:
        logger.error(f"Error fetching outbound stats: {e}")
        raise HTTPException(status_code=500, detail="Error fetching outbound stats")


@router.get("/stats/outbound/by-service", response_model=List[OutboundServiceStats])
async def get_outbound_stats_by_service(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None, description="Start date"),
    end_date: Optional[str] = Query(None, description="End date"),
    limit: int = Query(20, ge=1, le=100),
    _: bool = Depends(verify_auth),
):
    """Get outbound statistics grouped by service."""
    try:
        client = get_clickhouse_client()

        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, best_effort=True)
        wb.not_empty("service_name")
        where_clause, params = wb.build()
        params["limit"] = limit

        query = f"""
            SELECT
                service_name,
                count(*) as total_requests,
                countIf(is_success = 1) as success_count,
                countIf(is_success = 0) as failure_count,
                round(countIf(is_success = 1) * 100.0 / count(*), 2) as success_rate,
                round(avg(latency_ms), 2) as avg_latency_ms,
                round(quantile(0.95)(latency_ms), 2) as p95_latency_ms,
                round(countIf(is_success = 0) * 100.0 / count(*), 2) as error_rate
            FROM outbound_logs
            {where_clause}
            GROUP BY service_name
            ORDER BY total_requests DESC
            LIMIT %(limit)s
        """

        result = client.query(query, parameters=params)

        services = []
        for row in result.result_rows:
            services.append(OutboundServiceStats(
                service_name=row[0],
                total_requests=row[1] or 0,
                success_count=row[2] or 0,
                failure_count=row[3] or 0,
                success_rate=safe_float(row[4]),
                avg_latency_ms=safe_float(row[5]),
                p95_latency_ms=safe_float(row[6]),
                error_rate=safe_float(row[7]),
            ))

        return services
    except Exception as e:
        logger.error(f"Error fetching outbound stats by service: {e}")
        raise HTTPException(status_code=500, detail="Error fetching outbound stats by service")


@router.get("/stats/outbound/services/{service_name}/endpoints", response_model=List[OutboundEndpointStats])
async def get_outbound_service_endpoints(
    service_name: str,
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None, description="Start date"),
    end_date: Optional[str] = Query(None, description="End date"),
    limit: int = Query(50, ge=1, le=100),
    _: bool = Depends(verify_auth),
):
    """Get endpoint statistics for a specific service.

    Groups similar URLs by replacing numeric path segments with {id} placeholders.
    For example, /users/123 and /users/456 will be grouped as /users/{id}.
    """
    try:
        client = get_clickhouse_client()

        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, best_effort=True)
        wb.eq("service_name", service_name)
        where_clause, params = wb.build()
        params["limit"] = limit

        # Extract path from target_url and normalize numeric segments to {id}
        # Use ClickHouse's URL functions and regex to group similar endpoints
        query = f"""
            WITH
                -- Extract path from URL
                path(target_url) as url_path,
                -- Replace numeric segments with {{id}}
                -- Pattern: replace /123/ or /123 at end with /{{id}}
                replaceRegexpAll(url_path, '/[0-9]+(?=/|$)', '/{{id}}') as normalized_path
            SELECT
                normalized_path as endpoint_pattern,
                method,
                count(*) as total_requests,
                countIf(is_success = 1) as success_count,
                countIf(is_success = 0) as failure_count,
                round(countIf(is_success = 1) * 100.0 / count(*), 2) as success_rate,
                round(countIf(is_success = 0) * 100.0 / count(*), 2) as error_rate,
                round(avg(latency_ms), 2) as avg_latency_ms,
                round(quantile(0.95)(latency_ms), 2) as p95_latency_ms,
                round(quantile(0.99)(latency_ms), 2) as p99_latency_ms,
                round(avg(request_size), 2) as avg_request_size,
                round(avg(response_size), 2) as avg_response_size
            FROM outbound_logs
            {where_clause}
            GROUP BY normalized_path, method
            ORDER BY total_requests DESC
            LIMIT %(limit)s
        """

        result = client.query(query, parameters=params)

        endpoints = []
        for row in result.result_rows:
            endpoints.append(OutboundEndpointStats(
                endpoint_pattern=row[0] or '',
                method=row[1] or '',
                total_requests=row[2] or 0,
                success_count=row[3] or 0,
                failure_count=row[4] or 0,
                success_rate=safe_float(row[5]),
                error_rate=safe_float(row[6]),
                avg_latency_ms=safe_float(row[7]),
                p95_latency_ms=safe_float(row[8]),
                p99_latency_ms=safe_float(row[9]),
                avg_request_size=safe_float(row[10]),
                avg_response_size=safe_float(row[11]),
            ))

        return endpoints
    except Exception as e:
        logger.error(f"Error fetching outbound service endpoints for {service_name}: {e}")
        raise HTTPException(status_code=500, detail="Error fetching outbound service endpoints")


@router.get("/stats/outbound/by-host", response_model=List[OutboundHostStats])
async def get_outbound_stats_by_host(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None, description="Start date"),
    end_date: Optional[str] = Query(None, description="End date"),
    limit: int = Query(20, ge=1, le=100),
    _: bool = Depends(verify_auth),
):
    """Get outbound statistics grouped by target host."""
    try:
        client = get_clickhouse_client()

        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, best_effort=True)
        wb.not_empty("target_host")
        where_clause, params = wb.build()
        params["limit"] = limit

        query = f"""
            SELECT
                target_host,
                count(*) as total_requests,
                countIf(is_success = 1) as success_count,
                countIf(is_success = 0) as failure_count,
                round(countIf(is_success = 1) * 100.0 / count(*), 2) as success_rate,
                round(avg(latency_ms), 2) as avg_latency_ms
            FROM outbound_logs
            {where_clause}
            GROUP BY target_host
            ORDER BY total_requests DESC
            LIMIT %(limit)s
        """

        result = client.query(query, parameters=params)

        hosts = []
        for row in result.result_rows:
            hosts.append(OutboundHostStats(
                target_host=row[0],
                total_requests=row[1] or 0,
                success_count=row[2] or 0,
                failure_count=row[3] or 0,
                success_rate=safe_float(row[4]),
                avg_latency_ms=safe_float(row[5]),
            ))

        return hosts
    except Exception as e:
        logger.error(f"Error fetching outbound stats by host: {e}")
        raise HTTPException(status_code=500, detail="Error fetching outbound stats by host")
