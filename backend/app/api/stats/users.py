"""User analytics endpoints."""

import logging
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import verify_auth
from app.api.stats._common import safe_float
from app.models.stats import (
    UserActivityPoint,
    UserStats,
    UserWithErrors,
)
from app.services.clickhouse import get_clickhouse_client

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/stats/top-users", response_model=List[UserStats])
async def get_top_users(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    limit: int = Query(10, ge=1, le=100),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    type: Optional[Literal["all", "inbound", "outbound"]] = Query("all", description="Filter by request type"),
    _: bool = Depends(verify_auth),
):
    """Get top users by request count."""
    try:
        client = get_clickhouse_client()

        # Build WHERE conditions with parameterized queries
        params = {}
        conditions = []

        if project_id:
            conditions.append("toString(project_id) = %(project_id)s")
            params["project_id"] = project_id
        if start_date:
            conditions.append("timestamp >= parseDateTimeBestEffort(%(start_date)s)")
            params["start_date"] = start_date
        if end_date:
            conditions.append("timestamp <= parseDateTimeBestEffort(%(end_date)s)")
            params["end_date"] = end_date

        # Add type filter
        if type == "inbound":
            conditions.append("is_outbound = 0")
        elif type == "outbound":
            conditions.append("is_outbound = 1")

        # Filter out empty user_id and user_name
        conditions.append("user_id != ''")
        conditions.append("user_name != ''")

        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

        # Add limit parameter to prevent SQL injection
        params["limit"] = limit

        query = f"""
            SELECT
                user_id,
                user_name,
                count(*) as total_requests,
                countIf(status_code >= 400) as error_count,
                round(countIf(status_code >= 400) * 100.0 / count(*), 2) as error_rate,
                round(avg(response_time_ms), 2) as avg_response_time
            FROM logs
            {where_clause}
            GROUP BY user_id, user_name
            ORDER BY total_requests DESC
            LIMIT %(limit)s
        """

        result = client.query(query, parameters=params)

        users = []
        for row in result.result_rows:
            users.append(UserStats(
                user_id=row[0],
                user_name=row[1],
                total_requests=row[2] or 0,
                error_count=row[3] or 0,
                error_rate=safe_float(row[4]),
                avg_response_time=safe_float(row[5])
            ))

        return users
    except Exception:
        logger.exception("Error fetching top users")
        raise HTTPException(status_code=500, detail="Error fetching top users")


@router.get("/stats/user-activity", response_model=List[UserActivityPoint])
async def get_user_activity(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    user_id: str = Query(..., description="User ID to get activity for"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    interval: Optional[Literal["hour", "day"]] = Query("hour", description="Time interval"),
    _: bool = Depends(verify_auth),
):
    """Get user activity timeline."""
    try:
        client = get_clickhouse_client()

        # Map interval to ClickHouse function
        interval_map = {
            "hour": "toStartOfHour",
            "day": "toStartOfDay",
        }
        time_func = interval_map.get(interval, "toStartOfHour")

        # Build WHERE conditions with parameterized queries
        params = {}
        conditions = []

        conditions.append("user_id = %(user_id)s")
        params["user_id"] = user_id

        if project_id:
            conditions.append("toString(project_id) = %(project_id)s")
            params["project_id"] = project_id
        if start_date:
            conditions.append("timestamp >= parseDateTimeBestEffort(%(start_date)s)")
            params["start_date"] = start_date
        if end_date:
            conditions.append("timestamp <= parseDateTimeBestEffort(%(end_date)s)")
            params["end_date"] = end_date

        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

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

        activity = []
        for row in result.result_rows:
            activity.append(UserActivityPoint(
                timestamp=row[0].isoformat() if hasattr(row[0], 'isoformat') else str(row[0]),
                requests=row[1],
                errors=row[2]
            ))

        return activity
    except Exception:
        logger.exception("Error fetching user activity")
        raise HTTPException(status_code=500, detail="Error fetching user activity")


@router.get("/stats/users-with-errors", response_model=List[UserWithErrors])
async def get_users_with_errors(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    limit: int = Query(10, ge=1, le=100),
    min_requests: int = Query(10, ge=1, description="Minimum requests to include user"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    _: bool = Depends(verify_auth),
):
    """Get users with highest error rates."""
    try:
        client = get_clickhouse_client()

        # Build WHERE conditions with parameterized queries
        params = {}
        conditions = []

        if project_id:
            conditions.append("toString(project_id) = %(project_id)s")
            params["project_id"] = project_id
        if start_date:
            conditions.append("timestamp >= parseDateTimeBestEffort(%(start_date)s)")
            params["start_date"] = start_date
        if end_date:
            conditions.append("timestamp <= parseDateTimeBestEffort(%(end_date)s)")
            params["end_date"] = end_date

        # Filter out empty user_id and user_name
        conditions.append("user_id != ''")
        conditions.append("user_name != ''")

        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

        # Add limit and min_requests parameters
        params["limit"] = limit
        params["min_requests"] = min_requests

        query = f"""
            SELECT
                user_id,
                user_name,
                count(*) as total_requests,
                countIf(status_code >= 400) as error_count,
                round(countIf(status_code >= 400) * 100.0 / count(*), 2) as error_rate
            FROM logs
            {where_clause}
            GROUP BY user_id, user_name
            HAVING total_requests >= %(min_requests)s
            ORDER BY error_rate DESC, error_count DESC
            LIMIT %(limit)s
        """

        result = client.query(query, parameters=params)

        users = []
        for row in result.result_rows:
            users.append(UserWithErrors(
                user_id=row[0],
                user_name=row[1],
                total_requests=row[2] or 0,
                error_count=row[3] or 0,
                error_rate=safe_float(row[4])
            ))

        return users
    except Exception:
        logger.exception("Error fetching users with errors")
        raise HTTPException(status_code=500, detail="Error fetching users with errors")
