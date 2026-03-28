"""Pydantic schemas for saved views."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class SavedViewCreate(BaseModel):
    """Request schema for creating a saved view."""
    name: str = Field(..., min_length=1, max_length=100)
    filters: dict[str, Any] = Field(..., description="Filter parameters to save")
    color: Optional[str] = Field(None, max_length=20)
    is_default: bool = False


class SavedViewUpdate(BaseModel):
    """Request schema for updating a saved view."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    filters: Optional[dict[str, Any]] = None
    color: Optional[str] = Field(None, max_length=20)
    is_default: Optional[bool] = None


class SavedViewResponse(BaseModel):
    """Response schema for a saved view."""
    id: str
    project_id: str
    user_id: str
    name: str
    filters: dict[str, Any]
    color: Optional[str] = None
    is_default: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
