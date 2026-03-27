"""Performance metrics endpoints."""

import logging
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import verify_auth
from app.api.stats._common import safe_float
from app.models.stats import (
    ModuleHealth,
    PerformancePercentiles,
    PerformanceTimelinePoint,
    ServiceHealth,
    SlowestEndpoint,
    SlowRequestsSummary,
)
from app.services.clickhouse import get_clickhouse_client
from app.services.query_builder import WhereBuilder

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/stats/service-health", response_model=List[ServiceHealth])
async def get_service_health(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    type: Optional[Literal["all", "inbound", "outbound"]] = Query("all", description="Filter by request type"),
    _: bool = Depends(verify_auth),
):
    """Get health status of third-party services based on outbound requests."""
    try:
        # Service health only makes sense for outbound requests
        # Return empty array for inbound-only filter
        if type == "inbound":
            return []

        client = get_clickhouse_client()

        # Build additional conditions
        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, best_effort=True)
        additional_conditions, params = wb.build_and()

        query = f"""
            SELECT
                third_party_service as service_name,
                count(*) as total_requests,
                countIf(status_code >= 200 AND status_code < 400) as successful,
                countIf(status_code >= 400) as failed,
                round(countIf(status_code >= 200 AND status_code < 400) * 100.0 / count(*), 2) as success_rate,
                round(avg(response_time_ms), 2) as avg_response_time
            FROM logs
            WHERE is_outbound = true
                AND third_party_service IS NOT NULL
                AND third_party_service != ''
                {additional_conditions}
            GROUP BY third_party_service
            ORDER BY total_requests DESC
        """

        result = client.query(query, parameters=params)

        services = []
        for row in result.result_rows:
            services.append(ServiceHealth(
                service_name=row[0] or "Unknown",
                total_requests=row[1] or 0,
                successful=row[2] or 0,
                failed=row[3] or 0,
                success_rate=safe_float(row[4]),
                avg_response_time=safe_float(row[5])
            ))

        return services
    except Exception:
        logger.exception("Error fetching service health")
        raise HTTPException(status_code=500, detail="Error fetching service health")


@router.get("/stats/module-health", response_model=List[ModuleHealth])
async def get_module_health(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    type: Optional[Literal["all", "inbound", "outbound"]] = Query("all", description="Filter by request type"),
    _: bool = Depends(verify_auth),
):
    """Get health status of modules based on inbound requests."""
    try:
        # Module health only makes sense for inbound requests
        # Return empty array for outbound-only filter
        if type == "outbound":
            return []

        client = get_clickhouse_client()

        # Build additional conditions
        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, best_effort=True)
        additional_conditions, params = wb.build_and()

        query = f"""
            SELECT
                module as module_name,
                count(*) as total_requests,
                countIf(status_code >= 200 AND status_code < 400) as success_count,
                countIf(status_code >= 400) as error_count,
                round(countIf(status_code >= 200 AND status_code < 400) * 100.0 / count(*), 2) as success_rate,
                round(avg(response_time_ms), 2) as avg_response_time
            FROM logs
            WHERE is_outbound = false
                AND module IS NOT NULL
                AND module != ''
                {additional_conditions}
            GROUP BY module
            ORDER BY total_requests DESC
        """

        result = client.query(query, parameters=params)

        modules = []
        for row in result.result_rows:
            modules.append(ModuleHealth(
                module_name=row[0] or "Unknown",
                total_requests=row[1] or 0,
                success_count=row[2] or 0,
                error_count=row[3] or 0,
                success_rate=safe_float(row[4]),
                avg_response_time=safe_float(row[5])
            ))

        return modules
    except Exception:
        logger.exception("Error fetching module health")
        raise HTTPException(status_code=500, detail="Error fetching module health")


@router.get("/stats/percentiles", response_model=PerformancePercentiles)
async def get_performance_percentiles(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    type: Optional[Literal["all", "inbound", "outbound"]] = Query("all", description="Filter by request type"),
    _: bool = Depends(verify_auth),
):
    """Get response time percentiles."""
    try:
        client = get_clickhouse_client()

        # Build WHERE conditions
        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, best_effort=True).request_type(type)
        where_clause, params = wb.build()

        # Query percentiles using ClickHouse quantile functions
        query = f"""
            SELECT
                quantile(0.5)(response_time_ms) as p50,
                quantile(0.75)(response_time_ms) as p75,
                quantile(0.9)(response_time_ms) as p90,
                quantile(0.95)(response_time_ms) as p95,
                quantile(0.99)(response_time_ms) as p99,
                max(response_time_ms) as max_time,
                min(response_time_ms) as min_time,
                avg(response_time_ms) as avg_time,
                count(*) as total_requests
            FROM logs
            {where_clause}
        """

        result = client.query(query, parameters=params)
        row = result.result_rows[0] if result.result_rows else (0, 0, 0, 0, 0, 0, 0, 0, 0)

        return PerformancePercentiles(
            p50=safe_float(row[0]),
            p75=safe_float(row[1]),
            p90=safe_float(row[2]),
            p95=safe_float(row[3]),
            p99=safe_float(row[4]),
            max=safe_float(row[5]),
            min=safe_float(row[6]),
            avg=safe_float(row[7]),
            total_requests=row[8] or 0
        )
    except Exception:
        logger.exception("Error fetching performance percentiles")
        raise HTTPException(status_code=500, detail="Error fetching performance percentiles")


@router.get("/stats/slow-requests", response_model=SlowRequestsSummary)
async def get_slow_requests(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    threshold_ms: int = Query(1000, ge=1, description="Response time threshold in milliseconds"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    _: bool = Depends(verify_auth),
):
    """Get slow requests summary."""
    try:
        client = get_clickhouse_client()

        # Build WHERE conditions
        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, best_effort=True)
        where_clause, params = wb.build()
        params["threshold_ms"] = threshold_ms

        # Query for total and slow request counts
        count_query = f"""
            SELECT
                count(*) as total_requests,
                countIf(response_time_ms >= %(threshold_ms)s) as slow_count
            FROM logs
            {where_clause}
        """

        count_result = client.query(count_query, parameters=params)
        count_row = count_result.result_rows[0] if count_result.result_rows else (0, 0)

        total_requests = count_row[0] or 0
        slow_count = count_row[1] or 0
        slow_percentage = round((slow_count / total_requests * 100), 2) if total_requests > 0 else 0.0

        # Query for slowest endpoints
        inner_wb = WhereBuilder()
        inner_wb.project(project_id).date_range(start_date, end_date, best_effort=True)
        inner_wb.raw("response_time_ms >= %(threshold_ms)s", threshold_ms=threshold_ms)
        slowest_where_clause, slowest_params = inner_wb.build()

        slowest_query = f"""
            SELECT
                endpoint,
                method,
                round(avg(response_time_ms), 2) as avg_response_time,
                round(quantile(0.95)(response_time_ms), 2) as p95_response_time,
                count(*) as request_count
            FROM logs
            {slowest_where_clause}
            GROUP BY endpoint, method
            ORDER BY avg_response_time DESC
            LIMIT 10
        """

        slowest_result = client.query(slowest_query, parameters=slowest_params)

        slowest_endpoints = []
        for row in slowest_result.result_rows:
            slowest_endpoints.append(SlowestEndpoint(
                endpoint=row[0],
                method=row[1],
                avg_response_time=safe_float(row[2]),
                p95_response_time=safe_float(row[3]),
                request_count=row[4] or 0,
            ))

        return SlowRequestsSummary(
            total_requests=total_requests,
            slow_count=slow_count,
            slow_percentage=slow_percentage,
            slowest_endpoints=slowest_endpoints
        )
    except Exception:
        logger.exception("Error fetching slow requests")
        raise HTTPException(status_code=500, detail="Error fetching slow requests")


@router.get("/stats/performance-timeline", response_model=List[PerformanceTimelinePoint])
async def get_performance_timeline(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    interval: Optional[Literal["hour", "day"]] = Query("hour", description="Time interval"),
    _: bool = Depends(verify_auth),
):
    """Get percentiles over time."""
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
        wb.project(project_id).date_range(start_date, end_date, best_effort=True)
        where_clause, params = wb.build()

        # Query percentiles over time
        query = f"""
            SELECT
                {time_func}(timestamp) as time_bucket,
                quantile(0.5)(response_time_ms) as p50,
                quantile(0.95)(response_time_ms) as p95,
                quantile(0.99)(response_time_ms) as p99,
                avg(response_time_ms) as avg_time
            FROM logs
            {where_clause}
            GROUP BY time_bucket
            ORDER BY time_bucket ASC
        """

        result = client.query(query, parameters=params)

        timeline = []
        for row in result.result_rows:
            timeline.append(PerformanceTimelinePoint(
                timestamp=row[0].isoformat() if hasattr(row[0], 'isoformat') else str(row[0]),
                p50=safe_float(row[1]),
                p95=safe_float(row[2]),
                p99=safe_float(row[3]),
                avg=safe_float(row[4])
            ))

        return timeline
    except Exception:
        logger.exception("Error fetching performance timeline")
        raise HTTPException(status_code=500, detail="Error fetching performance timeline")
