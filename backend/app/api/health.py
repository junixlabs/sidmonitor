from fastapi import APIRouter

from app.models.health import HealthResponse, ReadyResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, summary="Health check")
async def health_check():
    """Check if the API server is running."""
    return HealthResponse(status="healthy")


@router.get("/ready", response_model=ReadyResponse, summary="Readiness check")
async def readiness_check():
    """Check if the API server is ready to accept requests."""
    return ReadyResponse(status="ready")
