"""
Pydantic models for feedback / bug report endpoints.
"""
import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class FeedbackCreate(BaseModel):
    """Request body for creating feedback."""
    category: str = Field(..., description="bug, feature, improvement, question, other")
    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=10, max_length=5000)
    priority: str = Field("medium", description="low, medium, high, critical")
    page_url: Optional[str] = Field(None, max_length=500)
    user_agent: Optional[str] = Field(None, max_length=500)
    screenshot_url: Optional[str] = Field(None, max_length=500)
    metadata: Optional[dict[str, Any]] = Field(None, description="Additional context")


class FeedbackUpdate(BaseModel):
    """Request body for updating feedback status."""
    status: Optional[str] = Field(None, description="open, in_progress, resolved, closed")
    priority: Optional[str] = Field(None, description="low, medium, high, critical")


class FeedbackResponse(BaseModel):
    """Response body for a single feedback entry."""
    id: uuid.UUID
    org_id: Optional[uuid.UUID] = None
    project_id: Optional[uuid.UUID] = None
    user_id: Optional[uuid.UUID] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    category: str
    title: str
    description: str
    priority: str
    status: str
    page_url: Optional[str] = None
    user_agent: Optional[str] = None
    screenshot_url: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FeedbackListResponse(BaseModel):
    """Response body for paginated feedback list."""
    items: list[FeedbackResponse]
    total: int
    page: int
    per_page: int
