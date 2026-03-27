"""
Pydantic models for audit log request/response schemas.
"""
import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    """Schema for a single audit log entry."""
    id: uuid.UUID
    actor_id: Optional[uuid.UUID] = None
    actor_type: str = "user"
    actor_name: Optional[str] = None
    actor_email: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[uuid.UUID] = None
    metadata: Optional[dict[str, Any]] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    """Schema for paginated audit log response."""
    items: list[AuditLogResponse]
    total: int
    page: int
    per_page: int
