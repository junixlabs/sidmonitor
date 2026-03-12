from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class InboundLogEntry(BaseModel):
    """Log entry for inbound HTTP requests to the Laravel application."""
    request_id: str = Field(..., description="Unique request identifier")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Request timestamp (defaults to current UTC time)")
    endpoint: str = Field(..., description="Request endpoint path")
    method: str = Field(..., description="HTTP method (GET, POST, etc.)")
    status_code: int = Field(..., ge=100, le=599, description="HTTP status code")
    response_time_ms: float = Field(..., ge=0, description="Response time in milliseconds")
    user_id: Optional[str] = Field(None, description="Authenticated user ID")
    user_name: Optional[str] = Field(None, description="Authenticated user name")
    module: Optional[str] = Field(None, description="Application module")
    tags: Optional[list[str]] = Field(default_factory=list, description="Custom tags")
    request_body: Optional[str] = Field(None, description="Request body (truncated)")
    response_body: Optional[str] = Field(None, description="Response body (truncated)")


class OutboundLogEntry(BaseModel):
    """Log entry for outbound HTTP requests to third-party APIs."""
    request_id: str = Field(..., description="Unique request identifier")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Request timestamp (defaults to current UTC time)")
    endpoint: str = Field(..., description="External API endpoint URL")
    method: str = Field(..., description="HTTP method (GET, POST, etc.)")
    status_code: int = Field(..., ge=100, le=599, description="HTTP status code")
    response_time_ms: float = Field(..., ge=0, description="Response time in milliseconds")
    third_party_service: str = Field(..., description="Name of the third-party service")
    user_id: Optional[str] = Field(None, description="User who triggered the request")
    user_name: Optional[str] = Field(None, description="User name who triggered the request")
    module: Optional[str] = Field(None, description="Application module")
    tags: Optional[list[str]] = Field(default_factory=list, description="Custom tags")
    request_body: Optional[str] = Field(None, description="Request body (truncated)")
    response_body: Optional[str] = Field(None, description="Response body (truncated)")


class BatchIngestRequest(BaseModel):
    """Batch request for ingesting multiple log entries."""
    inbound_logs: list[InboundLogEntry] = Field(default_factory=list, description="Inbound log entries")
    outbound_logs: list[OutboundLogEntry] = Field(default_factory=list, description="Outbound log entries")


class IngestResponse(BaseModel):
    """Response for ingest operations."""
    success: bool = Field(..., description="Whether the ingest operation succeeded")
    message: str = Field(..., description="Status message describing the result")
    ingested_count: int = Field(0, description="Number of log entries successfully ingested")


# ============================================
# New Outbound Logs Models (for outbound_logs table)
# ============================================

class OutboundLogEntryNew(BaseModel):
    """Log entry for the new outbound_logs table with enhanced fields."""
    # Required identifiers
    request_id: str = Field(default="", description="Unique request identifier")
    parent_request_id: str = Field(default="", description="Parent inbound request ID")
    trace_id: str = Field(default="", description="Distributed tracing ID")
    span_id: str = Field(default="", description="Span ID for distributed tracing")

    # Timing
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Request timestamp (defaults to current UTC time)")

    # Service info
    service_name: str = Field(..., description="Third-party service name")
    target_host: str = Field(default="", description="Target host (extracted from URL)")
    target_url: str = Field(..., description="Full target URL")

    # Request details
    method: str = Field(..., description="HTTP method (GET, POST, etc.)")

    # Response
    status_code: int = Field(..., ge=100, le=599, description="HTTP status code")
    latency_ms: float = Field(..., ge=0, description="Response latency in milliseconds")
    is_success: int = Field(default=1, ge=0, le=1, description="1=success, 0=failure")

    # Sizes
    request_size: int = Field(default=0, ge=0, description="Request body size in bytes")
    response_size: int = Field(default=0, ge=0, description="Response body size in bytes")

    # Error info
    error_message: str = Field(default="", description="Error message if failed")
    error_code: str = Field(default="", description="Error code from service")
    retry_count: int = Field(default=0, ge=0, description="Number of retries")

    # Context
    module: str = Field(default="", description="Application module")
    user_id: str = Field(default="", description="User ID context")

    # Optional headers & body
    request_headers: str = Field(default="", description="Request headers (JSON)")
    response_headers: str = Field(default="", description="Response headers (JSON)")
    request_body: str = Field(default="", description="Request body (truncated)")
    response_body: str = Field(default="", description="Response body (truncated)")

    # Custom
    tags: list[str] = Field(default_factory=list, description="Custom tags")
    metadata: str = Field(default="", description="Additional metadata (JSON)")


class BatchOutboundIngestRequest(BaseModel):
    """Batch request for ingesting outbound log entries to the new table."""
    logs: list[OutboundLogEntryNew] = Field(..., description="Outbound log entries")


class OutboundLogResponse(BaseModel):
    """Response model for outbound log queries."""
    id: str
    project_id: str
    request_id: str
    parent_request_id: str
    trace_id: str
    span_id: str
    timestamp: str
    service_name: str
    target_host: str
    target_url: str
    method: str
    status_code: int
    latency_ms: float
    is_success: int
    request_size: int
    response_size: int
    error_message: str
    error_code: str
    retry_count: int
    module: str
    user_id: str
    request_headers: str = ""
    response_headers: str = ""
    request_body: str = ""
    response_body: str = ""
    tags: list[str] = []
    metadata: str = ""


class PaginatedOutboundLogsResponse(BaseModel):
    """Paginated response for outbound logs."""
    logs: list[OutboundLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
