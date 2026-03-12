"""
Pydantic models for organization request/response schemas.
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class MemberRole(str, Enum):
    """Organization member role enum."""
    owner = "owner"
    admin = "admin"
    member = "member"


class OrganizationCreate(BaseModel):
    """Schema for creating a new organization."""
    name: str = Field(..., min_length=1, max_length=255, description="Organization name")


class OrganizationUpdate(BaseModel):
    """Schema for updating organization (all fields optional)."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)


class OrganizationResponse(BaseModel):
    """Schema for organization response."""
    id: uuid.UUID = Field(..., description="Organization UUID")
    name: str = Field(..., description="Organization name")
    slug: str = Field(..., description="URL-friendly organization slug")
    plan: str = Field(..., description="Subscription plan (free, pro, enterprise)")
    owner_id: uuid.UUID = Field(..., description="UUID of the organization owner")
    created_at: datetime = Field(..., description="Organization creation timestamp")

    class Config:
        from_attributes = True


class OrganizationListResponse(BaseModel):
    """Schema for list of organizations."""
    organizations: List[OrganizationResponse] = Field(..., description="List of organizations the user belongs to")


class OrganizationMemberResponse(BaseModel):
    """Schema for organization member response."""
    id: uuid.UUID = Field(..., description="Membership UUID")
    user_id: uuid.UUID = Field(..., description="Member's user UUID")
    user_email: str = Field(..., description="Member's email address")
    user_name: str = Field(..., description="Member's display name")
    role: MemberRole = Field(..., description="Member role (owner, admin, member)")
    joined_at: Optional[datetime] = Field(None, description="Timestamp when user joined the organization")

    class Config:
        from_attributes = True


class InviteMemberRequest(BaseModel):
    """Schema for inviting a member to organization."""
    email: str = Field(..., description="Email address of the user to invite")
    role: MemberRole = Field(..., description="Role to assign to the member")

    class Config:
        use_enum_values = True
