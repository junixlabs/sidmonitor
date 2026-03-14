"""
Pydantic models for project request/response schemas.
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class ProjectRole(str, Enum):
    """Project member role enum."""
    admin = "admin"
    member = "member"
    viewer = "viewer"


class ProjectCreate(BaseModel):
    """Schema for project creation request."""
    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    platform: Optional[str] = Field(default="laravel", max_length=50, description="Platform (laravel, node, python, etc.)")
    environment: str = Field(default="production", max_length=50, description="Environment (production, staging, development)")


class ProjectUpdate(BaseModel):
    """Schema for project update request (all fields optional)."""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Project name")
    platform: Optional[str] = Field(None, max_length=50, description="Platform")
    environment: Optional[str] = Field(None, max_length=50, description="Environment")


class ProjectResponse(BaseModel):
    """Schema for project response."""
    id: uuid.UUID = Field(..., description="Project UUID")
    name: str = Field(..., description="Project name")
    slug: str = Field(..., description="URL-friendly project slug")
    platform: str = Field(..., description="Platform (laravel, node, python, etc.)")
    environment: str = Field(..., description="Environment (production, staging, development)")
    dsn: str = Field(..., description="Data Source Name for SDK configuration")
    created_at: datetime = Field(..., description="Project creation timestamp")
    created_by: uuid.UUID = Field(..., description="UUID of the user who created the project")

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    """Schema for project list response."""
    projects: List[ProjectResponse] = Field(..., description="List of projects in the organization")


class ApiKeyCreate(BaseModel):
    """Schema for API key creation request."""
    name: str = Field(..., min_length=1, max_length=255, description="API key name/description")
    scopes: List[str] = Field(default=["ingest:write"], description="API key scopes (ingest:write, data:read, settings:read, settings:write)")


class ApiKeyResponse(BaseModel):
    """Schema for API key response (without full key)."""
    id: uuid.UUID = Field(..., description="API key UUID")
    name: str = Field(..., description="API key name/description")
    key_prefix: str = Field(..., description="First characters of the API key for identification")
    scopes: List[str] = Field(..., description="API key permission scopes")
    created_at: datetime = Field(..., description="API key creation timestamp")
    last_used_at: Optional[datetime] = Field(None, description="Last time the API key was used")

    class Config:
        from_attributes = True


class ApiKeyCreatedResponse(BaseModel):
    """Schema for API key creation response (includes full key - only shown once!)."""
    id: uuid.UUID = Field(..., description="API key UUID")
    name: str = Field(..., description="API key name/description")
    key_prefix: str = Field(..., description="First characters of the API key for identification")
    key: str = Field(..., description="Full API key value (only shown once on creation)")
    scopes: List[str] = Field(..., description="API key permission scopes")
    created_at: datetime = Field(..., description="API key creation timestamp")
    last_used_at: Optional[datetime] = Field(None, description="Last time the API key was used")

    class Config:
        from_attributes = True


class ApiKeyListResponse(BaseModel):
    """Schema for API key list response."""
    api_keys: List[ApiKeyResponse] = Field(..., description="List of API keys for the project")


class DsnResponse(BaseModel):
    """Schema for DSN response."""
    dsn: str = Field(..., description="Data Source Name URL for SDK configuration")


class ProjectMemberCreate(BaseModel):
    """Schema for adding a member to a project."""
    email: str = Field(..., description="Email of the user to add")
    role: ProjectRole = Field(default=ProjectRole.member, description="Role: admin, member, viewer")

    class Config:
        use_enum_values = True


class ProjectMemberUpdate(BaseModel):
    """Schema for updating a project member's role."""
    role: ProjectRole = Field(..., description="New role: admin, member, viewer")

    class Config:
        use_enum_values = True


class ProjectMemberResponse(BaseModel):
    """Schema for project member response."""
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    role: str

