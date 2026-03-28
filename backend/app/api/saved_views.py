"""Saved views API endpoints for persisting filter combinations."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.database import get_db
from app.models.database import SavedView, User
from app.models.saved_view import SavedViewCreate, SavedViewResponse, SavedViewUpdate

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_SAVED_VIEWS_PER_PROJECT = 20


@router.get("/saved-views", response_model=list[SavedViewResponse])
async def list_saved_views(
    project_id: str = Query(..., description="Project ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all saved views for the current user in a project."""
    result = await db.execute(
        select(SavedView)
        .where(SavedView.project_id == project_id, SavedView.user_id == current_user.id)
        .order_by(SavedView.created_at.asc())
    )
    views = result.scalars().all()
    return [
        SavedViewResponse(
            id=str(v.id),
            project_id=str(v.project_id),
            user_id=str(v.user_id),
            name=v.name,
            filters=v.filters,
            color=v.color,
            is_default=v.is_default,
            created_at=v.created_at,
            updated_at=v.updated_at,
        )
        for v in views
    ]


@router.post("/saved-views", response_model=SavedViewResponse, status_code=status.HTTP_201_CREATED)
async def create_saved_view(
    data: SavedViewCreate,
    project_id: str = Query(..., description="Project ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new saved view."""
    # Check limit
    count_result = await db.execute(
        select(SavedView)
        .where(SavedView.project_id == project_id, SavedView.user_id == current_user.id)
    )
    existing = count_result.scalars().all()
    if len(existing) >= MAX_SAVED_VIEWS_PER_PROJECT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {MAX_SAVED_VIEWS_PER_PROJECT} saved views per project",
        )

    # If setting as default, unset other defaults
    if data.is_default:
        await db.execute(
            update(SavedView)
            .where(SavedView.project_id == project_id, SavedView.user_id == current_user.id)
            .values(is_default=False)
        )

    view = SavedView(
        project_id=project_id,
        user_id=current_user.id,
        name=data.name,
        filters=data.filters,
        color=data.color,
        is_default=data.is_default,
    )
    db.add(view)
    await db.flush()
    await db.refresh(view)

    return SavedViewResponse(
        id=str(view.id),
        project_id=str(view.project_id),
        user_id=str(view.user_id),
        name=view.name,
        filters=view.filters,
        color=view.color,
        is_default=view.is_default,
        created_at=view.created_at,
        updated_at=view.updated_at,
    )


@router.patch("/saved-views/{view_id}", response_model=SavedViewResponse)
async def update_saved_view(
    view_id: str,
    data: SavedViewUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a saved view."""
    result = await db.execute(
        select(SavedView).where(SavedView.id == view_id, SavedView.user_id == current_user.id)
    )
    view = result.scalar_one_or_none()
    if not view:
        raise HTTPException(status_code=404, detail="Saved view not found")

    # If setting as default, unset other defaults
    if data.is_default:
        await db.execute(
            update(SavedView)
            .where(
                SavedView.project_id == view.project_id,
                SavedView.user_id == current_user.id,
                SavedView.id != view.id,
            )
            .values(is_default=False)
        )

    if data.name is not None:
        view.name = data.name
    if data.filters is not None:
        view.filters = data.filters
    if data.color is not None:
        view.color = data.color
    if data.is_default is not None:
        view.is_default = data.is_default

    await db.flush()
    await db.refresh(view)

    return SavedViewResponse(
        id=str(view.id),
        project_id=str(view.project_id),
        user_id=str(view.user_id),
        name=view.name,
        filters=view.filters,
        color=view.color,
        is_default=view.is_default,
        created_at=view.created_at,
        updated_at=view.updated_at,
    )


@router.delete("/saved-views/{view_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_view(
    view_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a saved view."""
    result = await db.execute(
        select(SavedView).where(SavedView.id == view_id, SavedView.user_id == current_user.id)
    )
    view = result.scalar_one_or_none()
    if not view:
        raise HTTPException(status_code=404, detail="Saved view not found")

    await db.delete(view)
