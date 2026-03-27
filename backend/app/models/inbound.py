"""
Pydantic models for inbound log query/stats response schemas.
"""
from typing import List, Optional

from pydantic import BaseModel, Field


class InboundLogResponse(BaseModel):
    """Inbound log entry for query responses."""
    id: str = Field(..., description="Unique log entry identifier")
    request_id: str = Field(..., description="Request correlation ID")
    timestamp: str = Field(..., description="Request timestamp (YYYY-MM-DD HH:MM:SS)")
    endpoint: str = Field(..., description="Request endpoint path")
    method: str = Field(..., description="HTTP method (GET, POST, PUT, DELETE, etc.)")
    status_code: int = Field(..., description="HTTP response status code")
    response_time_ms: float = Field(..., description="Response time in milliseconds")
    user_id: Optional[str] = Field(None, description="Authenticated user ID")
    user_name: Optional[str] = Field(None, description="Authenticated user display name")
    module: Optional[str] = Field(None, description="Application module that handled the request")
    tags: List[str] = Field(default_factory=list, description="Custom tags attached to the request")


class InboundLogDetail(InboundLogResponse):
    """Detailed inbound log entry including request/response body."""
    request_body: Optional[str] = Field(None, description="Request body content (may be truncated)")
    response_body: Optional[str] = Field(None, description="Response body content (may be truncated)")


class InboundPaginatedResponse(BaseModel):
    """Paginated response for inbound logs."""
    data: List[InboundLogResponse] = Field(..., description="List of inbound log entries")
    total: int = Field(..., description="Total number of matching records")
    page: int = Field(..., description="Current page number (1-based)")
    page_size: int = Field(..., description="Number of records per page")
    total_pages: int = Field(..., description="Total number of pages")


class InboundOverallStats(BaseModel):
    """Overall inbound statistics for a project within a time range."""
    total_requests: int = Field(..., description="Total number of inbound requests")
    success_count: int = Field(..., description="Number of successful requests (2xx/3xx)")
    error_count: int = Field(..., description="Number of error requests (4xx/5xx)")
    success_rate: float = Field(..., description="Success rate percentage (0-100)")
    avg_response_time_ms: float = Field(..., description="Average response time in milliseconds")
    p95_response_time_ms: float = Field(..., description="95th percentile response time in milliseconds")
    modules_count: int = Field(..., description="Number of distinct application modules")


class InboundModuleStats(BaseModel):
    """Statistics for a specific application module."""
    module: str = Field(..., description="Module name")
    total_requests: int = Field(..., description="Total requests handled by this module")
    success_count: int = Field(..., description="Number of successful requests (2xx/3xx)")
    error_count: int = Field(..., description="Number of error requests (4xx/5xx)")
    success_rate: float = Field(..., description="Success rate percentage (0-100)")
    error_rate: float = Field(..., description="Error rate percentage (0-100)")
    avg_response_time_ms: float = Field(..., description="Average response time in milliseconds")
    p95_response_time_ms: float = Field(..., description="95th percentile response time in milliseconds")


class InboundEndpointStats(BaseModel):
    """Statistics for a specific endpoint of a module. Similar URLs are grouped by replacing numeric segments with {id}."""
    endpoint_pattern: str = Field(..., description="Normalized endpoint pattern (e.g., /users/{id})")
    method: str = Field(..., description="HTTP method")
    total_requests: int = Field(..., description="Total requests to this endpoint")
    success_count: int = Field(..., description="Number of successful requests (2xx/3xx)")
    error_count: int = Field(..., description="Number of error requests (4xx/5xx)")
    success_rate: float = Field(..., description="Success rate percentage (0-100)")
    error_rate: float = Field(..., description="Error rate percentage (0-100)")
    avg_response_time_ms: float = Field(..., description="Average response time in milliseconds")
    p95_response_time_ms: float = Field(..., description="95th percentile response time in milliseconds")
    p99_response_time_ms: float = Field(..., description="99th percentile response time in milliseconds")
