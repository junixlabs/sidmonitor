from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from app.models.outbound import OutboundLogEntry


class InboundLogEntry(BaseModel):
    """Log entry for inbound HTTP requests to the Laravel application."""
    request_id: str = Field(..., description="Unique request identifier")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Request timestamp (defaults to current UTC time)")
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


class BatchIngestRequest(BaseModel):
    """Batch request for ingesting multiple log entries."""
    inbound_logs: list[InboundLogEntry] = Field(default_factory=list, description="Inbound log entries")
    outbound_logs: list[OutboundLogEntry] = Field(default_factory=list, description="Outbound log entries")


class IngestResponse(BaseModel):
    """Response for ingest operations."""
    success: bool = Field(..., description="Whether the ingest operation succeeded")
    message: str = Field(..., description="Status message describing the result")
    ingested_count: int = Field(0, description="Number of log entries successfully ingested")
