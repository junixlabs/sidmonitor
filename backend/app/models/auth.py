"""
Pydantic models for authentication request/response schemas.
"""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    """Schema for user registration request."""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    name: str = Field(..., min_length=1, max_length=255, description="User display name")


class UserLogin(BaseModel):
    """Schema for user login request."""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class UserResponse(BaseModel):
    """Schema for user response (excludes password)."""
    id: uuid.UUID = Field(..., description="User UUID")
    email: str = Field(..., description="User email address")
    name: str = Field(..., description="User display name")
    avatar_url: Optional[str] = Field(None, description="User avatar URL")
    created_at: datetime = Field(..., description="Account creation timestamp")

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Schema for JWT token response after successful login."""
    access_token: str = Field(..., description="JWT access token for authenticating subsequent requests")
    token_type: str = Field("bearer", description="Token type (always 'bearer')")
    user: UserResponse = Field(..., description="Authenticated user details")


class UserUpdate(BaseModel):
    """Schema for updating user profile (all fields optional)."""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="New display name")
    avatar_url: Optional[str] = Field(None, max_length=500, description="New avatar URL")
