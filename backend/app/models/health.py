"""
Pydantic models for health check response schemas.
"""
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response indicating the API server is running."""
    status: str = Field(..., description="Server health status", examples=["healthy"])


class ReadyResponse(BaseModel):
    """Readiness check response indicating the API server is ready to accept requests."""
    status: str = Field(..., description="Server readiness status", examples=["ready"])
