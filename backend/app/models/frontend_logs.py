"""
Pydantic models for frontend error logging schemas.
"""
from typing import List, Optional

from pydantic import BaseModel, Field


class FrontendLogEntry(BaseModel):
    """Frontend log entry submitted by the browser client."""
    timestamp: str = Field(..., description="Client-side timestamp when the event occurred")
    type: str = Field(..., description="Log type: error, warning, navigation, api, render")
    message: str = Field(..., description="Log message or error description")
    stack: Optional[str] = Field(None, description="JavaScript stack trace (for errors)")
    url: Optional[str] = Field(None, description="Page URL where the event occurred")
    component: Optional[str] = Field(None, description="React component name (for render errors)")
    metadata: Optional[dict] = Field(None, description="Additional context data as key-value pairs")


class FrontendLogStored(BaseModel):
    """Frontend log entry as stored on the server (includes server-side received_at)."""
    received_at: str = Field(..., description="Server-side timestamp when the log was received (ISO format)")
    timestamp: str = Field(..., description="Client-side timestamp when the event occurred")
    type: str = Field(..., description="Log type: error, warning, navigation, api, render")
    message: str = Field(..., description="Log message or error description")
    stack: Optional[str] = Field(None, description="JavaScript stack trace (for errors)")
    url: Optional[str] = Field(None, description="Page URL where the event occurred")
    component: Optional[str] = Field(None, description="React component name (for render errors)")
    metadata: Optional[dict] = Field(None, description="Additional context data as key-value pairs")


class FrontendLogResponse(BaseModel):
    """Response after successfully logging a frontend event."""
    status: str = Field(..., description="Operation status", examples=["logged"])


class FrontendLogsListResponse(BaseModel):
    """Response containing a list of recent frontend logs."""
    logs: List[FrontendLogStored] = Field(..., description="List of frontend log entries (most recent last)")


class FrontendLogsClearResponse(BaseModel):
    """Response after clearing all frontend logs."""
    status: str = Field(..., description="Operation status", examples=["cleared"])
