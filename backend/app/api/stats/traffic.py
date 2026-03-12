"""Traffic pattern analysis endpoints."""

import logging
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import verify_auth
from app.api.stats._common import safe_float
from app.services.query_builder import WhereBuilder
from app.models.stats import (
    PeakHourStats,
    ThroughputStats,
    ThroughputTimeline,
    TrafficByDay,
    TrafficByMethod,
)
from app.services.clickhouse import get_clickhouse_client

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/stats/traffic-by-method", response_model=List[TrafficByMethod])
async def get_traffic_by_method(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    _: bool = Depends(verify_auth),
):
    """Get requests distribution by HTTP method."""
    try:
        client = get_clickhouse_client()

        # Build WHERE conditions
        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, best_effort=True)
        where_clause, params = wb.build()

        query = f"""
            SELECT
                method,
                count(*) as count,
                round(avg(response_time_ms), 2) as avg_response_time,
                round(countIf(status_code >= 400) * 100.0 / count(*), 2) as error_rate
            FROM logs
            {where_clause}
            GROUP BY method
            ORDER BY count DESC
        """

        result = client.query(query, parameters=params)

        # Calculate total for percentage
        total = sum(row[1] for row in result.result_rows)

        traffic = []
        for row in result.result_rows:
            method = row[0]
            count = row[1] or 0
            avg_response_time = safe_float(row[2])
            error_rate = safe_float(row[3])
            percentage = round((count / total * 100), 2) if total > 0 else 0.0

            traffic.append(TrafficByMethod(
                method=method,
                count=count,
                percentage=percentage,
                avg_response_time=avg_response_time,
                error_rate=error_rate
            ))

        return traffic
    except Exception:
        logger.exception("Error fetching traffic by method")
        raise HTTPException(status_code=500, detail="Error fetching traffic by method")


@router.get("/stats/peak-hours", response_model=List[PeakHourStats])
async def get_peak_hours(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    timezone: str = Query("UTC", description="Timezone for hour calculation"),
    _: bool = Depends(verify_auth),
):
    """Get traffic by hour of day."""
    try:
        client = get_clickhouse_client()

        # Build WHERE conditions
        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, best_effort=True)
        where_clause, params = wb.build()

        query = f"""
            SELECT
                toHour(timestamp) as hour,
                count(*) as total_requests,
                toDate(timestamp) as date,
                round(avg(response_time_ms), 2) as avg_response_time
            FROM logs
            {where_clause}
            GROUP BY hour, date
        """

        result = client.query(query, parameters=params)

        # Aggregate by hour across all dates
        hour_stats = {}
        for row in result.result_rows:
            hour = row[0]
            requests = row[1] or 0
            avg_response_time = safe_float(row[3])

            if hour not in hour_stats:
                hour_stats[hour] = {
                    'requests': [],
                    'response_times': []
                }

            hour_stats[hour]['requests'].append(requests)
            hour_stats[hour]['response_times'].append(avg_response_time)

        # Calculate averages and peaks
        peak_hours = []
        for hour in range(24):
            if hour in hour_stats:
                requests_list = hour_stats[hour]['requests']
                response_times = hour_stats[hour]['response_times']

                avg_requests = sum(requests_list) / len(requests_list)
                peak_requests = max(requests_list)
                avg_response_time = sum(response_times) / len(response_times)
            else:
                avg_requests = 0.0
                peak_requests = 0
                avg_response_time = 0.0

            peak_hours.append(PeakHourStats(
                hour=hour,
                avg_requests=round(avg_requests, 2),
                peak_requests=peak_requests,
                avg_response_time=round(avg_response_time, 2)
            ))

        return peak_hours
    except Exception:
        logger.exception("Error fetching peak hours")
        raise HTTPException(status_code=500, detail="Error fetching peak hours")


@router.get("/stats/traffic-by-day", response_model=List[TrafficByDay])
async def get_traffic_by_day(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    _: bool = Depends(verify_auth),
):
    """Get traffic by day of week."""
    try:
        client = get_clickhouse_client()

        # Build WHERE conditions
        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, best_effort=True)
        where_clause, params = wb.build()

        query = f"""
            SELECT
                toDayOfWeek(timestamp) as day_of_week,
                count(*) as total_requests,
                toDate(timestamp) as date
            FROM logs
            {where_clause}
            GROUP BY day_of_week, date
        """

        result = client.query(query, parameters=params)

        # Aggregate by day of week across all dates
        day_stats = {}
        for row in result.result_rows:
            # ClickHouse toDayOfWeek returns 1=Monday...7=Sunday
            # Convert to 0=Sunday...6=Saturday
            day_of_week_ch = row[0]
            day_of_week = 0 if day_of_week_ch == 7 else day_of_week_ch
            requests = row[1] or 0

            if day_of_week not in day_stats:
                day_stats[day_of_week] = []

            day_stats[day_of_week].append(requests)

        # Day names
        day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

        # Calculate averages and peaks
        traffic_by_day = []
        for day in range(7):
            if day in day_stats:
                requests_list = day_stats[day]
                avg_requests = sum(requests_list) / len(requests_list)
                peak_requests = max(requests_list)
            else:
                avg_requests = 0.0
                peak_requests = 0

            traffic_by_day.append(TrafficByDay(
                day_of_week=day,
                day_name=day_names[day],
                avg_requests=round(avg_requests, 2),
                peak_requests=peak_requests
            ))

        return traffic_by_day
    except Exception:
        logger.exception("Error fetching traffic by day")
        raise HTTPException(status_code=500, detail="Error fetching traffic by day")


@router.get("/stats/throughput", response_model=ThroughputStats)
async def get_throughput(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    interval: Literal["minute", "hour"] = Query("minute", description="Time interval for throughput calculation"),
    _: bool = Depends(verify_auth),
):
    """Get throughput metrics."""
    try:
        client = get_clickhouse_client()

        # Build WHERE conditions
        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date, best_effort=True)
        where_clause, params = wb.build()

        # Map interval to ClickHouse function
        time_func = "toStartOfMinute" if interval == "minute" else "toStartOfHour"

        query = f"""
            SELECT
                {time_func}(timestamp) as time_bucket,
                count(*) as requests
            FROM logs
            {where_clause}
            GROUP BY time_bucket
            ORDER BY time_bucket ASC
        """

        result = client.query(query, parameters=params)

        timeline = []
        requests_per_minute_list = []

        for row in result.result_rows:
            timestamp = row[0].isoformat() if hasattr(row[0], 'isoformat') else str(row[0])
            requests = row[1] or 0

            # Calculate requests per minute based on interval
            if interval == "minute":
                requests_per_minute = float(requests)
            else:  # hour
                requests_per_minute = round(requests / 60.0, 2)

            requests_per_minute_list.append(requests_per_minute)

            timeline.append(ThroughputTimeline(
                timestamp=timestamp,
                requests_per_minute=requests_per_minute
            ))

        # Calculate overall metrics
        if requests_per_minute_list:
            avg_requests_per_minute = round(sum(requests_per_minute_list) / len(requests_per_minute_list), 2)
            peak_requests_per_minute = round(max(requests_per_minute_list), 2)
            avg_requests_per_second = round(avg_requests_per_minute / 60.0, 2)
        else:
            avg_requests_per_minute = 0.0
            peak_requests_per_minute = 0.0
            avg_requests_per_second = 0.0

        return ThroughputStats(
            avg_requests_per_minute=avg_requests_per_minute,
            peak_requests_per_minute=peak_requests_per_minute,
            avg_requests_per_second=avg_requests_per_second,
            timeline=timeline
        )
    except Exception:
        logger.exception("Error fetching throughput")
        raise HTTPException(status_code=500, detail="Error fetching throughput")
