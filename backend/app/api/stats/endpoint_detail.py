"""Endpoint detail statistics."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import verify_auth
from app.api.stats._common import safe_float
from app.models.stats import (
    EndpointDetail,
    EndpointDetailSummary,
    EndpointRecentError,
    EndpointStatusCodeCount,
    PerformanceTimelinePoint,
    TimeSeriesPoint,
)
from app.services.clickhouse import get_clickhouse_client
from app.services.query_builder import WhereBuilder

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/stats/endpoint-detail", response_model=EndpointDetail)
async def get_endpoint_detail(
    endpoint: str = Query(..., description="Endpoint path to get details for"),
    method: str = Query(..., description="HTTP method (GET, POST, etc.)"),
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    _: bool = Depends(verify_auth),
):
    """Get detailed statistics for a specific endpoint."""
    try:
        client = get_clickhouse_client()

        # Base WHERE builder
        def base_wb():
            wb = WhereBuilder()
            wb.project(project_id).date_range(start_date, end_date, best_effort=True)
            wb.eq("endpoint", endpoint).eq("method", method)
            return wb

        # 1. Summary stats
        wb = base_wb()
        where_clause, params = wb.build()

        summary_query = f"""
            SELECT
                count(*) as request_count,
                countIf(status_code >= 400) as error_count,
                round(countIf(status_code >= 400) * 100.0 / greatest(count(*), 1), 2) as error_rate,
                round(avg(response_time_ms), 2) as avg_response_time,
                round(quantile(0.5)(response_time_ms), 2) as p50,
                round(quantile(0.95)(response_time_ms), 2) as p95,
                round(quantile(0.99)(response_time_ms), 2) as p99,
                round(count(*) / greatest(dateDiff('minute', min(timestamp), max(timestamp)), 1), 2) as rpm
            FROM logs
            {where_clause}
        """
        result = client.query(summary_query, parameters=params)
        row = result.result_rows[0] if result.result_rows else (0, 0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)

        summary = EndpointDetailSummary(
            endpoint=endpoint,
            method=method,
            request_count=row[0] or 0,
            error_count=row[1] or 0,
            error_rate=safe_float(row[2]),
            avg_response_time=safe_float(row[3]),
            p50_response_time=safe_float(row[4]),
            p95_response_time=safe_float(row[5]),
            p99_response_time=safe_float(row[6]),
            requests_per_minute=safe_float(row[7]),
        )

        # Auto-determine interval
        interval_func = "toStartOfHour"
        if start_date:
            from datetime import datetime, timezone
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                end_dt = datetime.now(timezone.utc) if not end_date else datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                hours = (end_dt - start_dt).total_seconds() / 3600
                if hours <= 2:
                    interval_func = "toStartOfMinute"
                elif hours > 48:
                    interval_func = "toStartOfDay"
            except Exception:
                pass

        # 2. Time series (requests + errors over time)
        wb = base_wb()
        where_clause, params = wb.build()

        ts_query = f"""
            SELECT
                {interval_func}(timestamp) as time_bucket,
                count(*) as requests,
                countIf(status_code >= 400) as errors
            FROM logs
            {where_clause}
            GROUP BY time_bucket
            ORDER BY time_bucket ASC
        """
        ts_result = client.query(ts_query, parameters=params)
        timeseries = [
            TimeSeriesPoint(
                timestamp=r[0].isoformat() if hasattr(r[0], 'isoformat') else str(r[0]),
                requests=r[1],
                errors=r[2],
            )
            for r in ts_result.result_rows
        ]

        # 3. Latency percentile timeline
        wb = base_wb()
        where_clause, params = wb.build()

        latency_query = f"""
            SELECT
                {interval_func}(timestamp) as time_bucket,
                round(quantile(0.5)(response_time_ms), 2) as p50,
                round(quantile(0.95)(response_time_ms), 2) as p95,
                round(quantile(0.99)(response_time_ms), 2) as p99,
                round(avg(response_time_ms), 2) as avg
            FROM logs
            {where_clause}
            GROUP BY time_bucket
            ORDER BY time_bucket ASC
        """
        latency_result = client.query(latency_query, parameters=params)
        latency_timeline = [
            PerformanceTimelinePoint(
                timestamp=r[0].isoformat() if hasattr(r[0], 'isoformat') else str(r[0]),
                p50=safe_float(r[1]),
                p95=safe_float(r[2]),
                p99=safe_float(r[3]),
                avg=safe_float(r[4]),
            )
            for r in latency_result.result_rows
        ]

        # 4. Status code breakdown
        wb = base_wb()
        where_clause, params = wb.build()

        status_query = f"""
            SELECT
                status_code,
                count(*) as cnt
            FROM logs
            {where_clause}
            GROUP BY status_code
            ORDER BY cnt DESC
        """
        status_result = client.query(status_query, parameters=params)
        total_for_pct = sum(r[1] for r in status_result.result_rows) or 1
        status_codes = [
            EndpointStatusCodeCount(
                status_code=r[0],
                count=r[1],
                percentage=round(r[1] * 100.0 / total_for_pct, 2),
            )
            for r in status_result.result_rows
        ]

        # 5. Recent errors (last 20)
        wb = base_wb()
        wb.raw("status_code >= 400")
        where_clause, params = wb.build()

        errors_query = f"""
            SELECT
                request_id,
                timestamp,
                status_code,
                response_time_ms,
                user_id,
                user_name
            FROM logs
            {where_clause}
            ORDER BY timestamp DESC
            LIMIT 20
        """
        errors_result = client.query(errors_query, parameters=params)
        recent_errors = [
            EndpointRecentError(
                request_id=str(r[0]),
                timestamp=r[1].isoformat() if hasattr(r[1], 'isoformat') else str(r[1]),
                status_code=r[2],
                response_time_ms=safe_float(r[3]),
                user_id=str(r[4]) if r[4] else "",
                user_name=str(r[5]) if r[5] else "",
            )
            for r in errors_result.result_rows
        ]

        return EndpointDetail(
            summary=summary,
            timeseries=timeseries,
            latency_timeline=latency_timeline,
            status_codes=status_codes,
            recent_errors=recent_errors,
        )
    except Exception:
        logger.exception("Error fetching endpoint detail")
        raise HTTPException(status_code=500, detail="Error fetching endpoint detail")
