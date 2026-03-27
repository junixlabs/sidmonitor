"""
Feedback / Bug Report API endpoints.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.database import get_db
from app.models.database import Feedback, User
from app.models.feedback import (
    FeedbackCreate,
    FeedbackListResponse,
    FeedbackResponse,
    FeedbackUpdate,
)

router = APIRouter()

VALID_CATEGORIES = {"bug", "feature", "improvement", "question", "other"}
VALID_PRIORITIES = {"low", "medium", "high", "critical"}
VALID_STATUSES = {"open", "in_progress", "resolved", "closed"}


def _feedback_to_response(fb: Feedback, user: Optional[User] = None) -> FeedbackResponse:
    return FeedbackResponse(
        id=fb.id,
        org_id=fb.org_id,
        project_id=fb.project_id,
        user_id=fb.user_id,
        user_name=user.name if user else None,
        user_email=user.email if user else None,
        category=fb.category,
        title=fb.title,
        description=fb.description,
        priority=fb.priority,
        status=fb.status,
        page_url=fb.page_url,
        user_agent=fb.user_agent,
        screenshot_url=fb.screenshot_url,
        metadata=fb.extra_data,
        resolved_at=fb.resolved_at,
        created_at=fb.created_at,
        updated_at=fb.updated_at,
    )


@router.post("/feedback", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def create_feedback(
    body: FeedbackCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a new feedback or bug report."""
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(400, f"Invalid category. Must be one of: {', '.join(sorted(VALID_CATEGORIES))}")
    if body.priority not in VALID_PRIORITIES:
        raise HTTPException(400, f"Invalid priority. Must be one of: {', '.join(sorted(VALID_PRIORITIES))}")

    # Get org/project from user context if available
    from app.models.database import OrganizationMember
    org_id = None
    result = await db.execute(
        select(OrganizationMember.organization_id)
        .where(OrganizationMember.user_id == current_user.id)
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row:
        org_id = row

    fb = Feedback(
        user_id=current_user.id,
        org_id=org_id,
        category=body.category,
        title=body.title,
        description=body.description,
        priority=body.priority,
        page_url=body.page_url,
        user_agent=body.user_agent or request.headers.get("User-Agent"),
        screenshot_url=body.screenshot_url,
        extra_data=body.metadata or {},
    )
    db.add(fb)
    await db.flush()
    await db.refresh(fb)

    return _feedback_to_response(fb, current_user)


@router.get("/feedback", response_model=FeedbackListResponse)
async def list_feedback(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List feedback entries (scoped to user's organizations)."""
    query = select(Feedback).order_by(Feedback.created_at.desc())

    # Filter by status
    if status_filter and status_filter in VALID_STATUSES:
        query = query.where(Feedback.status == status_filter)
    if category and category in VALID_CATEGORIES:
        query = query.where(Feedback.category == category)
    if priority and priority in VALID_PRIORITIES:
        query = query.where(Feedback.priority == priority)

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Paginate
    offset = (page - 1) * per_page
    result = await db.execute(query.offset(offset).limit(per_page))
    items = result.scalars().all()

    # Enrich with user info
    user_ids = {fb.user_id for fb in items if fb.user_id}
    users_map: dict[uuid.UUID, User] = {}
    if user_ids:
        users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        for u in users_result.scalars().all():
            users_map[u.id] = u

    responses = [_feedback_to_response(fb, users_map.get(fb.user_id)) for fb in items]

    return FeedbackListResponse(items=responses, total=total, page=page, per_page=per_page)


@router.get("/feedback/{feedback_id}", response_model=FeedbackResponse)
async def get_feedback(
    feedback_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single feedback entry."""
    result = await db.execute(select(Feedback).where(Feedback.id == feedback_id))
    fb = result.scalar_one_or_none()
    if not fb:
        raise HTTPException(404, "Feedback not found")

    user = None
    if fb.user_id:
        u_result = await db.execute(select(User).where(User.id == fb.user_id))
        user = u_result.scalar_one_or_none()

    return _feedback_to_response(fb, user)


@router.patch("/feedback/{feedback_id}", response_model=FeedbackResponse)
async def update_feedback(
    feedback_id: uuid.UUID,
    body: FeedbackUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update feedback status/priority (admin or author)."""
    result = await db.execute(select(Feedback).where(Feedback.id == feedback_id))
    fb = result.scalar_one_or_none()
    if not fb:
        raise HTTPException(404, "Feedback not found")

    if body.status:
        if body.status not in VALID_STATUSES:
            raise HTTPException(400, f"Invalid status. Must be one of: {', '.join(sorted(VALID_STATUSES))}")
        fb.status = body.status
        if body.status == "resolved":
            fb.resolved_at = datetime.now(timezone.utc)

    if body.priority:
        if body.priority not in VALID_PRIORITIES:
            raise HTTPException(400, f"Invalid priority. Must be one of: {', '.join(sorted(VALID_PRIORITIES))}")
        fb.priority = body.priority

    await db.flush()
    await db.refresh(fb)

    user = None
    if fb.user_id:
        u_result = await db.execute(select(User).where(User.id == fb.user_id))
        user = u_result.scalar_one_or_none()

    return _feedback_to_response(fb, user)


@router.delete("/feedback/{feedback_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feedback(
    feedback_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a feedback entry (author or admin only)."""
    result = await db.execute(select(Feedback).where(Feedback.id == feedback_id))
    fb = result.scalar_one_or_none()
    if not fb:
        raise HTTPException(404, "Feedback not found")

    # Only author can delete
    if fb.user_id != current_user.id:
        raise HTTPException(403, "Only the author can delete this feedback")

    await db.delete(fb)
    await db.flush()
