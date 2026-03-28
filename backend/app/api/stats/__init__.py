"""Stats API package — combines all stats sub-routers into a single router."""

from fastapi import APIRouter

from app.api.stats.dashboard import router as dashboard_router
from app.api.stats.endpoint_detail import router as endpoint_detail_router
from app.api.stats.errors import router as errors_router
from app.api.stats.performance import router as performance_router
from app.api.stats.traffic import router as traffic_router
from app.api.stats.users import router as users_router

router = APIRouter()

router.include_router(dashboard_router)
router.include_router(traffic_router)
router.include_router(performance_router)
router.include_router(users_router)
router.include_router(errors_router)
router.include_router(endpoint_detail_router)
