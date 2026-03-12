"""
Pydantic models for general log query response schemas.
"""
from typing import Optional

from pydantic import BaseModel, Field


class LogEntry(BaseModel):
    """Log entry for query responses (covers both inbound and outbound in legacy logs table)."""
    id: str = Field(..., description="Unique log entry identifier")
    request_id: str = Field(..., description="Request correlation ID")
    timestamp: str = Field(..., description="Request timestamp (YYYY-MM-DD HH:MM:SS)")
    endpoint: str = Field(..., description="Request endpoint path or external URL")
    method: str = Field(..., description="HTTP method (GET, POST, PUT, DELETE, etc.)")
    status_code: int = Field(..., description="HTTP response status code")
    response_time_ms: float = Field(..., description="Response time in milliseconds")
    user_id: Optional[str] = Field(None, description="Authenticated user ID")
    user_name: Optional[str] = Field(None, description="Authenticated user display name")
    module: Optional[str] = Field(None, description="Application module that handled the request")
    tags: Optional[list[str]] = Field(None, description="Custom tags attached to the request")
    is_outbound: bool = Field(False, description="Whether this is an outbound request (true) or inbound (false)")
    third_party_service: Optional[str] = Field(None, description="Third-party service name (outbound only)")
    request_body: Optional[str] = Field(None, description="Request body content (may be truncated)")
    response_body: Optional[str] = Field(None, description="Response body content (may be truncated)")


class PaginatedResponse(BaseModel):
    """Paginated response wrapper for list endpoints."""
    data: list = Field(..., description="List of items in the current page")
    total: int = Field(..., description="Total number of matching records")
    page: int = Field(..., description="Current page number (1-based)")
    page_size: int = Field(..., description="Number of records per page")
    total_pages: int = Field(..., description="Total number of pages")
