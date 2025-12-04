from pydantic import BaseModel
from typing import Optional


class DashboardStats(BaseModel):
    total_requests: int
    error_rate: float
    avg_response_time: float
    requests_per_minute: float


class TimeSeriesData(BaseModel):
    timestamp: str
    value: float


class EndpointStats(BaseModel):
    endpoint: str
    method: str
    request_count: int
    avg_response_time: float
    error_rate: float
