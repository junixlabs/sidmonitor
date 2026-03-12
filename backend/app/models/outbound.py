from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class OutboundLogEntry(BaseModel):
    """Log entry for outbound HTTP requests to third-party services."""
    # Required identifiers
    request_id: str = Field(..., description="Unique request identifier")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Request timestamp (defaults to current UTC time)")

    # Service info
    service_name: str = Field(..., description="Name of the third-party service")
    target_host: str = Field(..., description="Target host/domain")
    target_url: str = Field(..., description="Full target URL")

    # Request details
    method: str = Field(..., description="HTTP method (GET, POST, etc.)")

    # Response
    status_code: int = Field(..., ge=100, le=599, description="HTTP status code")
    latency_ms: float = Field(..., ge=0, description="Response time in milliseconds")

    # Optional identifiers for distributed tracing
    parent_request_id: Optional[str] = Field(None, description="Parent request ID")
    trace_id: Optional[str] = Field(None, description="Distributed trace ID")
    span_id: Optional[str] = Field(None, description="Span ID")

    # Sizes
    request_size: Optional[int] = Field(0, ge=0, description="Request size in bytes")
    response_size: Optional[int] = Field(0, ge=0, description="Response size in bytes")

    # Error info
    error_message: Optional[str] = Field(None, description="Error message if failed")
    error_code: Optional[str] = Field(None, description="Error code")
    retry_count: Optional[int] = Field(0, ge=0, description="Number of retries")

    # Context
    module: Optional[str] = Field(None, description="Application module")
    user_id: Optional[str] = Field(None, description="User ID")

    # Optional headers & body (JSON strings)
    request_headers: Optional[str] = Field(None, description="Request headers JSON")
    response_headers: Optional[str] = Field(None, description="Response headers JSON")
    request_body: Optional[str] = Field(None, description="Request body (truncated)")
    response_body: Optional[str] = Field(None, description="Response body (truncated)")

    # Custom
    tags: Optional[list[str]] = Field(default_factory=list, description="Custom tags")
    metadata: Optional[str] = Field(None, description="Additional metadata JSON")


class BatchOutboundIngestRequest(BaseModel):
    """Batch request for ingesting multiple outbound log entries."""
    logs: list[OutboundLogEntry] = Field(..., description="Outbound log entries")


class OutboundIngestResponse(BaseModel):
    """Response for outbound ingest operations."""
    success: bool = Field(..., description="Whether the ingest operation succeeded")
    message: str = Field(..., description="Human-readable result message")
    ingested_count: int = Field(0, description="Number of log entries successfully ingested")


# Query response models

class OutboundLogResponse(BaseModel):
    """Outbound log entry for query responses."""
    id: str = Field(..., description="Unique log entry identifier")
    project_id: str = Field(..., description="Project UUID that owns this log")
    request_id: str = Field(..., description="Request correlation ID")
    parent_request_id: str = Field(..., description="Parent inbound request ID for tracing")
    trace_id: str = Field(..., description="Distributed trace ID")
    span_id: str = Field(..., description="Span ID within the trace")
    timestamp: str = Field(..., description="Request timestamp (YYYY-MM-DD HH:MM:SS)")
    service_name: str = Field(..., description="Third-party service name")
    target_host: str = Field(..., description="Target host/domain")
    target_url: str = Field(..., description="Full target URL")
    method: str = Field(..., description="HTTP method (GET, POST, etc.)")
    status_code: int = Field(..., description="HTTP response status code")
    latency_ms: float = Field(..., description="Response latency in milliseconds")
    is_success: bool = Field(..., description="Whether the request was successful (2xx/3xx)")
    request_size: int = Field(..., description="Request body size in bytes")
    response_size: int = Field(..., description="Response body size in bytes")
    error_message: str = Field(..., description="Error message if the request failed")
    error_code: str = Field(..., description="Service-specific error code")
    retry_count: int = Field(..., description="Number of retry attempts")
    module: str = Field(..., description="Application module that made the request")
    user_id: str = Field(..., description="User ID context")
    tags: list[str] = Field(default_factory=list, description="Custom tags")


class OutboundLogDetail(OutboundLogResponse):
    """Detailed outbound log entry including headers and body."""
    request_headers: str = Field(..., description="Request headers as JSON string")
    response_headers: str = Field(..., description="Response headers as JSON string")
    request_body: str = Field(..., description="Request body content (may be truncated)")
    response_body: str = Field(..., description="Response body content (may be truncated)")
    metadata: str = Field(..., description="Additional metadata as JSON string")


class OutboundPaginatedResponse(BaseModel):
    """Paginated response for outbound logs."""
    data: list[OutboundLogResponse] = Field(..., description="List of outbound log entries")
    total: int = Field(..., description="Total number of matching records")
    page: int = Field(..., description="Current page number (1-based)")
    page_size: int = Field(..., description="Number of records per page")
    total_pages: int = Field(..., description="Total number of pages")


class OutboundServiceStats(BaseModel):
    """Statistics for a specific third-party service."""
    service_name: str = Field(..., description="Service name")
    total_requests: int = Field(..., description="Total outbound requests to this service")
    success_count: int = Field(..., description="Number of successful requests")
    failure_count: int = Field(..., description="Number of failed requests")
    success_rate: float = Field(..., description="Success rate percentage (0-100)")
    avg_latency_ms: float = Field(..., description="Average response latency in milliseconds")
    p95_latency_ms: float = Field(..., description="95th percentile latency in milliseconds")
    error_rate: float = Field(..., description="Error rate percentage (0-100)")


class OutboundHostStats(BaseModel):
    """Statistics for a specific target host."""
    target_host: str = Field(..., description="Target host/domain")
    total_requests: int = Field(..., description="Total requests to this host")
    success_count: int = Field(..., description="Number of successful requests")
    failure_count: int = Field(..., description="Number of failed requests")
    success_rate: float = Field(..., description="Success rate percentage (0-100)")
    avg_latency_ms: float = Field(..., description="Average response latency in milliseconds")


class OutboundOverallStats(BaseModel):
    """Overall outbound statistics for a project."""
    total_requests: int = Field(..., description="Total outbound requests")
    success_count: int = Field(..., description="Number of successful requests")
    failure_count: int = Field(..., description="Number of failed requests")
    success_rate: float = Field(..., description="Success rate percentage (0-100)")
    avg_latency_ms: float = Field(..., description="Average response latency in milliseconds")
    p95_latency_ms: float = Field(..., description="95th percentile latency in milliseconds")
    services_count: int = Field(..., description="Number of distinct external services called")
    timeout_count: int = Field(..., description="Number of timeout errors (408/504)")
    total_retries: int = Field(..., description="Total number of retry attempts across all requests")


class OutboundEndpointStats(BaseModel):
    """Statistics for a specific endpoint of a service. Similar URLs are grouped by replacing numeric segments with {id}."""
    endpoint_pattern: str = Field(..., description="Normalized URL path pattern (e.g., /users/{id})")
    method: str = Field(..., description="HTTP method")
    total_requests: int = Field(..., description="Total requests to this endpoint")
    success_count: int = Field(..., description="Number of successful requests")
    failure_count: int = Field(..., description="Number of failed requests")
    success_rate: float = Field(..., description="Success rate percentage (0-100)")
    error_rate: float = Field(..., description="Error rate percentage (0-100)")
    avg_latency_ms: float = Field(..., description="Average response latency in milliseconds")
    p95_latency_ms: float = Field(..., description="95th percentile latency in milliseconds")
    p99_latency_ms: float = Field(..., description="99th percentile latency in milliseconds")
    avg_request_size: float = Field(..., description="Average request body size in bytes")
    avg_response_size: float = Field(..., description="Average response body size in bytes")
