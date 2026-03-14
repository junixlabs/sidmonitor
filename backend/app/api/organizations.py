"""
Organization API endpoints for managing organizations and memberships.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.database import get_db
from app.models.database import User
from app.models.audit import AuditLogListResponse, AuditLogResponse
from app.models.organization import (
    InviteMemberRequest,
    MemberRole,
    OrganizationCreate,
    OrganizationListResponse,
    OrganizationMemberResponse,
    OrganizationResponse,
    OrganizationUpdate,
)
from app.services.organizations import (
    add_member,
    check_organization_permission,
    create_organization,
    get_organization_by_slug,
    get_organization_members,
    get_user_membership,
    get_user_organizations,
    remove_member,
    update_member_role,
)
from app.services.audit_service import enrich_audit_logs, get_audit_logs

router = APIRouter()


@router.get("/organizations", response_model=OrganizationListResponse)
async def list_organizations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all organizations the current user is a member of.

    Returns organizations ordered by creation date (newest first).
    """
    organizations = await get_user_organizations(db, current_user.id)

    return OrganizationListResponse(
        organizations=[OrganizationResponse.model_validate(org) for org in organizations]
    )


@router.post("/organizations", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_new_organization(
    data: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new organization.

    The current user will automatically become the owner of the organization.
    A unique slug will be generated from the organization name.
    """
    organization = await create_organization(db, current_user.id, data)

    return OrganizationResponse.model_validate(organization)


@router.get("/organizations/{slug}", response_model=OrganizationResponse)
async def get_organization(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get organization details by slug.

    Requires user to be a member of the organization.
    """
    organization = await get_organization_by_slug(db, slug)

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    # Check if user is a member
    has_permission = await check_organization_permission(
        db, current_user.id, organization.id, MemberRole.member
    )

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization",
        )

    return OrganizationResponse.model_validate(organization)


@router.patch("/organizations/{slug}", response_model=OrganizationResponse)
async def update_organization(
    slug: str,
    data: OrganizationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update organization details.

    Requires admin or owner role.
    """
    organization = await get_organization_by_slug(db, slug)

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    # Check admin+ permission
    has_permission = await check_organization_permission(
        db, current_user.id, organization.id, MemberRole.admin
    )

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update organization",
        )

    # Update only provided fields
    if data.name is not None:
        organization.name = data.name

    await db.commit()
    await db.refresh(organization)

    return OrganizationResponse.model_validate(organization)


@router.delete("/organizations/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete organization.

    Requires owner role. This will cascade delete all members, projects, and related data.
    """
    organization = await get_organization_by_slug(db, slug)

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    # Check owner permission
    has_permission = await check_organization_permission(
        db, current_user.id, organization.id, MemberRole.owner
    )

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can delete the organization",
        )

    await db.delete(organization)
    await db.commit()

    return None


@router.get("/organizations/{slug}/members", response_model=list[OrganizationMemberResponse])
async def list_members(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all members of an organization.

    Requires user to be a member of the organization.
    """
    organization = await get_organization_by_slug(db, slug)

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    # Check if user is a member
    has_permission = await check_organization_permission(
        db, current_user.id, organization.id, MemberRole.member
    )

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization",
        )

    members = await get_organization_members(db, organization.id)

    return [OrganizationMemberResponse.model_validate(member) for member in members]


@router.post("/organizations/{slug}/members", response_model=OrganizationMemberResponse, status_code=status.HTTP_201_CREATED)
async def invite_member(
    slug: str,
    data: InviteMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Invite a member to the organization.

    Requires admin or owner role. The user must already exist in the system.
    """
    organization = await get_organization_by_slug(db, slug)

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    # Check admin+ permission
    has_permission = await check_organization_permission(
        db, current_user.id, organization.id, MemberRole.admin
    )

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to invite members",
        )

    # Cannot invite as owner
    if data.role == MemberRole.owner:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot invite someone as owner",
        )

    # Find user by email
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User with this email not found",
        )

    # Add member
    membership = await add_member(db, organization.id, user.id, data.role)

    # Fetch user details for response
    membership.user_email = user.email
    membership.user_name = user.name

    return OrganizationMemberResponse.model_validate(membership)


@router.patch("/organizations/{slug}/members/{member_id}", response_model=OrganizationMemberResponse)
async def update_member(
    slug: str,
    member_id: str,
    data: InviteMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update a member's role.

    Requires admin or owner role. Admin cannot change owner's role or promote to owner.
    """
    organization = await get_organization_by_slug(db, slug)

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    # Check admin+ permission
    current_membership = await get_user_membership(db, current_user.id, organization.id)

    if not current_membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization",
        )

    has_permission = await check_organization_permission(
        db, current_user.id, organization.id, MemberRole.admin
    )

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update members",
        )

    # Update member role
    membership = await update_member_role(
        db, organization.id, member_id, data.role, current_membership.role
    )

    # Fetch user details for response
    result = await db.execute(select(User).where(User.id == membership.user_id))
    user = result.scalar_one_or_none()

    membership.user_email = user.email
    membership.user_name = user.name

    return OrganizationMemberResponse.model_validate(membership)


@router.delete("/organizations/{slug}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member_from_organization(
    slug: str,
    member_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Remove a member from the organization.

    Requires admin or owner role. Cannot remove the owner.
    """
    organization = await get_organization_by_slug(db, slug)

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    # Check admin+ permission
    has_permission = await check_organization_permission(
        db, current_user.id, organization.id, MemberRole.admin
    )

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to remove members",
        )

    # Remove member
    await remove_member(db, organization.id, member_id)

    return None


@router.get("/organizations/{slug}/audit-log", response_model=AuditLogListResponse)
async def list_audit_logs(
    slug: str,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get paginated audit log for an organization.

    Requires admin or owner role.
    """
    organization = await get_organization_by_slug(db, slug)

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    # Check admin+ permission
    has_permission = await check_organization_permission(
        db, current_user.id, organization.id, MemberRole.admin
    )

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view audit log",
        )

    entries, total = await get_audit_logs(db, organization.id, page, per_page)
    enriched = await enrich_audit_logs(db, entries)

    return AuditLogListResponse(
        items=[AuditLogResponse(**item) for item in enriched],
        total=total,
        page=page,
        per_page=per_page,
    )
