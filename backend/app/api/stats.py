from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.models.stats import DashboardStats, TimeSeriesData
from app.api.auth import verify_auth

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    _: bool = Depends(verify_auth),
):
    """Get dashboard statistics."""
    # Placeholder - will be implemented with ClickHouse integration
    return DashboardStats(
        total_requests=0,
        error_rate=0.0,
        avg_response_time=0.0,
        requests_per_minute=0.0,
    )


@router.get("/stats/timeseries")
async def get_timeseries_data(
    metric: str = Query("requests", description="Metric to retrieve"),
    interval: str = Query("1h", description="Time interval"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    _: bool = Depends(verify_auth),
):
    """Get time series data for charts."""
    return []


@router.get("/stats/top-endpoints")
async def get_top_endpoints(
    limit: int = Query(10, ge=1, le=100),
    _: bool = Depends(verify_auth),
):
    """Get top endpoints by request count."""
    return []
