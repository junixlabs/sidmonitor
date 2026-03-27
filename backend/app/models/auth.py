"""
Pydantic models for authentication request/response schemas.
"""
import re
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserRegister(BaseModel):
    """Schema for user registration request."""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=10, description="Password must be at least 10 characters")
    name: str = Field(..., min_length=1, max_length=255, description="User display name")

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Ensure password contains at least 1 uppercase, 1 lowercase, and 1 digit."""
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        return v


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
