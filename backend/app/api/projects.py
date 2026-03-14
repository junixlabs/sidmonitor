"""
Project API endpoints for project CRUD and API key management.
"""
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.database import get_db
from app.models.database import (
    ApiKey,
    Organization,
    OrganizationMember,
    Project,
    ProjectMember,
    User,
)
from app.models.organization import MemberRole
from app.models.project import (
    ApiKeyCreate,
    ApiKeyCreatedResponse,
    ApiKeyListResponse,
    ApiKeyResponse,
    DsnResponse,
    ProjectCreate,
    ProjectListResponse,
    ProjectMemberCreate,
    ProjectMemberResponse,
    ProjectMemberUpdate,
    ProjectResponse,
    ProjectUpdate,
)
from app.services.projects import (
    build_dsn,
    create_api_key,
    create_project,
    generate_api_key as generate_api_key_values,
    get_project_by_slug,
    hash_api_key,
    revoke_api_key,
    update_project,
)
from app.services.audit_service import log_action

router = APIRouter()


def get_client_ip(request: Request) -> str | None:
    """Extract client IP address from request."""
    if request and request.client:
        return request.client.host
    return None


async def get_organization_by_slug(slug: str, db: AsyncSession) -> Organization:
    """
    Get organization by slug.

    Args:
        slug: Organization slug
        db: Database session

    Returns:
        Organization

    Raises:
        HTTPException: If organization not found
    """
    result = await db.execute(
        select(Organization).where(Organization.slug == slug)
    )
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization '{slug}' not found"
        )

    return org


async def check_org_member(
    org: Organization,
    user: User,
    db: AsyncSession,
    min_role: MemberRole = MemberRole.member
) -> OrganizationMember:
    """
    Check if user is a member of the organization with minimum role.

    Args:
        org: Organization
        user: User
        db: Database session
        min_role: Minimum required role (member, admin, owner)

    Returns:
        OrganizationMember

    Raises:
        HTTPException: If user is not a member or doesn't have required role
    """
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.user_id == user.id
        )
    )
    membership = result.scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization"
        )

    # Check role hierarchy: owner > admin > member
    role_hierarchy = {MemberRole.member: 1, MemberRole.admin: 2, MemberRole.owner: 3}
    if role_hierarchy.get(membership.role, 0) < role_hierarchy.get(min_role, 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions. Required role: {min_role}"
        )

    return membership


async def check_project_access(
    project: Project,
    user: User,
    db: AsyncSession
) -> bool:
    """
    Check if user has access to project (via organization membership).

    Args:
        project: Project
        user: User
        db: Database session

    Returns:
        True if user has access

    Raises:
        HTTPException: If user doesn't have access
    """
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == project.organization_id,
            OrganizationMember.user_id == user.id
        )
    )
    membership = result.scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this project"
        )

    return True


# ========== Project CRUD Endpoints ==========

@router.get("/organizations/{org_slug}/projects", response_model=ProjectListResponse)
async def list_projects(
    org_slug: str = Path(..., description="Organization slug"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all projects in an organization.

    Requires organization membership.
    """
    # Get organization
    org = await get_organization_by_slug(org_slug, db)

    # Check membership
    await check_org_member(org, current_user, db, min_role=MemberRole.member)

    # Get all projects in organization
    result = await db.execute(
        select(Project).where(Project.organization_id == org.id)
    )
    projects = result.scalars().all()

    # Build response with DSN
    project_responses = []
    for project in projects:
        project_dict = {
            "id": project.id,
            "name": project.name,
            "slug": project.slug,
            "platform": project.platform,
            "environment": project.environment,
            "dsn": build_dsn(project),
            "created_at": project.created_at,
            "created_by": project.created_by,
        }
        project_responses.append(ProjectResponse(**project_dict))

    return ProjectListResponse(projects=project_responses)


@router.post(
    "/organizations/{org_slug}/projects",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_new_project(
    project_data: ProjectCreate,
    org_slug: str = Path(..., description="Organization slug"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """
    Create a new project in an organization.

    Requires admin or owner role.
    """
    # Get organization
    org = await get_organization_by_slug(org_slug, db)

    # Check membership (admin or owner can create projects)
    await check_org_member(org, current_user, db, min_role=MemberRole.admin)

    # Create project
    project = await create_project(org.id, current_user.id, project_data, db)

    # Audit log
    await log_action(
        db,
        org_id=org.id,
        actor_id=current_user.id,
        action="project.create",
        target_type="project",
        target_id=project.id,
        metadata={"name": project.name, "slug": project.slug, "platform": project.platform},
        ip_address=get_client_ip(request),
    )

    await db.commit()
    await db.refresh(project)

    return ProjectResponse(
        id=project.id,
        name=project.name,
        slug=project.slug,
        platform=project.platform,
        environment=project.environment,
        dsn=build_dsn(project),
        created_at=project.created_at,
        created_by=project.created_by,
    )


@router.get("/projects/{project_slug}", response_model=ProjectResponse)
async def get_project(
    project_slug: str = Path(..., description="Project slug"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get project details by slug.

    Requires project access (via organization membership).
    """
    # Get project
    project = await get_project_by_slug(project_slug, db, user=current_user)

    # Check access
    await check_project_access(project, current_user, db)

    return ProjectResponse(
        id=project.id,
        name=project.name,
        slug=project.slug,
        platform=project.platform,
        environment=project.environment,
        dsn=build_dsn(project),
        created_at=project.created_at,
        created_by=project.created_by,
    )


@router.patch("/projects/{project_slug}", response_model=ProjectResponse)
async def update_existing_project(
    project_update: ProjectUpdate,
    project_slug: str = Path(..., description="Project slug"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update project information.

    Requires admin or owner role in organization.
    """
    # Get project
    project = await get_project_by_slug(project_slug, db, user=current_user)

    # Get organization
    result = await db.execute(
        select(Organization).where(Organization.id == project.organization_id)
    )
    org = result.scalar_one()

    # Check membership (admin or owner can update projects)
    await check_org_member(org, current_user, db, min_role=MemberRole.admin)

    # Update project
    updated_project = await update_project(project, project_update, db)
    await db.commit()
    await db.refresh(updated_project)

    return ProjectResponse(
        id=updated_project.id,
        name=updated_project.name,
        slug=updated_project.slug,
        platform=updated_project.platform,
        environment=updated_project.environment,
        dsn=build_dsn(updated_project),
        created_at=updated_project.created_at,
        created_by=updated_project.created_by,
    )


@router.delete("/projects/{project_slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_slug: str = Path(..., description="Project slug"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """
    Delete a project.

    Requires admin or owner role in organization.
    This will also delete all associated API keys and data.
    """
    # Get project
    project = await get_project_by_slug(project_slug, db, user=current_user)

    # Get organization
    result = await db.execute(
        select(Organization).where(Organization.id == project.organization_id)
    )
    org = result.scalar_one()

    # Check membership (admin or owner can delete projects)
    await check_org_member(org, current_user, db, min_role=MemberRole.admin)

    # Audit log (before delete so we can reference project)
    await log_action(
        db,
        org_id=org.id,
        actor_id=current_user.id,
        action="project.delete",
        target_type="project",
        target_id=project.id,
        metadata={"name": project.name, "slug": project.slug},
        ip_address=get_client_ip(request),
    )

    # Delete project (cascade will handle API keys and memberships)
    await db.delete(project)
    await db.commit()

    return None


# ========== API Key Management Endpoints ==========

@router.get("/projects/{project_slug}/api-keys", response_model=ApiKeyListResponse)
async def list_api_keys(
    project_slug: str = Path(..., description="Project slug"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all API keys for a project.

    Returns API keys with prefix only (not full key).
    """
    # Get project
    project = await get_project_by_slug(project_slug, db, user=current_user)

    # Check access
    await check_project_access(project, current_user, db)

    # Get all non-revoked API keys
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.project_id == project.id,
            ApiKey.revoked_at.is_(None)
        )
    )
    api_keys = result.scalars().all()

    return ApiKeyListResponse(
        api_keys=[ApiKeyResponse.model_validate(key) for key in api_keys]
    )


@router.post(
    "/projects/{project_slug}/api-keys",
    response_model=ApiKeyCreatedResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_new_api_key(
    api_key_data: ApiKeyCreate,
    project_slug: str = Path(..., description="Project slug"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """
    Create a new API key for a project.

    Returns the full API key ONLY ONCE. Save it immediately!
    """
    # Get project
    project = await get_project_by_slug(project_slug, db, user=current_user)

    # Check access
    await check_project_access(project, current_user, db)

    # Create API key
    api_key, full_key = await create_api_key(
        project.id,
        current_user.id,
        api_key_data,
        db
    )

    # Audit log
    await log_action(
        db,
        org_id=project.organization_id,
        actor_id=current_user.id,
        action="api_key.create",
        target_type="api_key",
        target_id=api_key.id,
        metadata={"project": project.slug, "key_name": api_key.name, "scopes": api_key.scopes},
        ip_address=get_client_ip(request),
    )

    await db.commit()
    await db.refresh(api_key)

    # Return response with full key (only shown once!)
    return ApiKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        key=full_key,  # Full key included!
        scopes=api_key.scopes,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at,
    )


@router.delete(
    "/projects/{project_slug}/api-keys/{key_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
async def revoke_existing_api_key(
    project_slug: str = Path(..., description="Project slug"),
    key_id: uuid.UUID = Path(..., description="API key ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """
    Revoke an API key.

    Revoked keys cannot be used for authentication.
    """
    # Get project
    project = await get_project_by_slug(project_slug, db, user=current_user)

    # Check access
    await check_project_access(project, current_user, db)

    # Get API key
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.project_id == project.id
        )
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )

    if api_key.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API key is already revoked"
        )

    # Audit log
    await log_action(
        db,
        org_id=project.organization_id,
        actor_id=current_user.id,
        action="api_key.revoke",
        target_type="api_key",
        target_id=api_key.id,
        metadata={"project": project.slug, "key_name": api_key.name, "key_prefix": api_key.key_prefix},
        ip_address=get_client_ip(request),
    )

    # Revoke API key
    await revoke_api_key(api_key, db)
    await db.commit()

    return None


# ========== DSN Endpoint ==========

@router.get("/projects/{project_slug}/dsn", response_model=DsnResponse)
async def get_project_dsn(
    project_slug: str = Path(..., description="Project slug"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get project DSN (Data Source Name) for sending logs.

    The DSN is used in your application to send logs to this project.
    """
    # Get project
    project = await get_project_by_slug(project_slug, db, user=current_user)

    # Check access
    await check_project_access(project, current_user, db)

    return DsnResponse(dsn=build_dsn(project))


# ========== Project Member CRUD Endpoints ==========

@router.get("/projects/{project_slug}/members", response_model=list[ProjectMemberResponse])
async def list_project_members(
    project_slug: str = Path(..., description="Project slug"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all members of a project."""
    project = await get_project_by_slug(project_slug, db, user=current_user)
    await check_project_access(project, current_user, db)

    result = await db.execute(
        select(ProjectMember, User)
        .join(User, ProjectMember.user_id == User.id)
        .where(ProjectMember.project_id == project.id)
    )
    rows = result.all()

    return [
        ProjectMemberResponse(
            id=pm.id,
            user_id=pm.user_id,
            user_name=user.name,
            user_email=user.email,
            role=pm.role,
        )
        for pm, user in rows
    ]


@router.post(
    "/projects/{project_slug}/members",
    response_model=ProjectMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_project_member(
    data: ProjectMemberCreate,
    project_slug: str = Path(..., description="Project slug"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """Add a member to a project. Requires org admin+ or project admin."""
    project = await get_project_by_slug(project_slug, db, user=current_user)

    # Require admin access
    org = await _get_project_org(project, db)
    await check_org_member(org, current_user, db, min_role=MemberRole.admin)

    # Find user by email
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already a member
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user.id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a project member")

    member = ProjectMember(
        project_id=project.id,
        user_id=user.id,
        role=data.role,
    )
    db.add(member)
    await db.flush()

    # Audit log
    await log_action(
        db,
        org_id=project.organization_id,
        actor_id=current_user.id,
        action="project.member.add",
        target_type="project_member",
        target_id=member.id,
        metadata={"project": project.slug, "user_email": data.email, "role": data.role},
        ip_address=get_client_ip(request),
    )
    await db.commit()

    return ProjectMemberResponse(
        id=member.id,
        user_id=user.id,
        user_name=user.name,
        user_email=user.email,
        role=member.role,
    )


@router.patch("/projects/{project_slug}/members/{member_id}", response_model=ProjectMemberResponse)
async def update_project_member(
    data: ProjectMemberUpdate,
    project_slug: str = Path(..., description="Project slug"),
    member_id: uuid.UUID = Path(..., description="Project member ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """Update a project member's role. Requires org admin+ or project admin."""
    project = await get_project_by_slug(project_slug, db, user=current_user)

    org = await _get_project_org(project, db)
    await check_org_member(org, current_user, db, min_role=MemberRole.admin)

    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.id == member_id,
            ProjectMember.project_id == project.id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Project member not found")

    old_role = member.role
    member.role = data.role
    await db.flush()

    await log_action(
        db,
        org_id=project.organization_id,
        actor_id=current_user.id,
        action="project.member.role_change",
        target_type="project_member",
        target_id=member.id,
        metadata={"project": project.slug, "old_role": old_role, "new_role": data.role},
        ip_address=get_client_ip(request),
    )
    await db.commit()

    # Fetch user for response
    result = await db.execute(select(User).where(User.id == member.user_id))
    user = result.scalar_one()

    return ProjectMemberResponse(
        id=member.id,
        user_id=user.id,
        user_name=user.name,
        user_email=user.email,
        role=member.role,
    )


@router.delete(
    "/projects/{project_slug}/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_project_member(
    project_slug: str = Path(..., description="Project slug"),
    member_id: uuid.UUID = Path(..., description="Project member ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """Remove a member from a project. Requires org admin+ or project admin."""
    project = await get_project_by_slug(project_slug, db, user=current_user)

    org = await _get_project_org(project, db)
    await check_org_member(org, current_user, db, min_role=MemberRole.admin)

    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.id == member_id,
            ProjectMember.project_id == project.id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Project member not found")

    await log_action(
        db,
        org_id=project.organization_id,
        actor_id=current_user.id,
        action="project.member.remove",
        target_type="project_member",
        target_id=member.id,
        metadata={"project": project.slug, "user_id": str(member.user_id)},
        ip_address=get_client_ip(request),
    )

    await db.delete(member)
    await db.commit()
    return None


# ========== API Key Rotation Endpoint ==========

@router.post(
    "/projects/{project_slug}/api-keys/{key_id}/rotate",
    response_model=ApiKeyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def rotate_api_key(
    project_slug: str = Path(..., description="Project slug"),
    key_id: uuid.UUID = Path(..., description="API key ID to rotate"),
    grace_hours: int = Query(default=24, ge=1, le=720, description="Hours before old key expires"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """
    Rotate an API key: creates a new key and schedules the old one to expire.

    The old key remains active for the grace period (default 24h) to allow
    SDK config updates without downtime.
    """
    project = await get_project_by_slug(project_slug, db, user=current_user)
    await check_project_access(project, current_user, db)

    # Find old key
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.project_id == project.id,
            ApiKey.revoked_at.is_(None),
        )
    )
    old_key = result.scalar_one_or_none()
    if not old_key:
        raise HTTPException(status_code=404, detail="API key not found or already revoked")

    # Set expiration on old key
    old_key.expires_at = datetime.utcnow() + timedelta(hours=grace_hours)
    await db.flush()

    # Create new key
    full_key, key_prefix, key_hash = generate_api_key_values()
    new_key = ApiKey(
        project_id=project.id,
        name=f"{old_key.name} (rotated)",
        key_prefix=key_prefix,
        key_hash=key_hash,
        scopes=old_key.scopes,
        created_by=current_user.id,
        rotated_from=old_key.id,
    )
    db.add(new_key)
    await db.flush()
    await db.refresh(new_key)

    await log_action(
        db,
        org_id=project.organization_id,
        actor_id=current_user.id,
        action="api_key.rotate",
        target_type="api_key",
        target_id=new_key.id,
        metadata={
            "project": project.slug,
            "old_key_prefix": old_key.key_prefix,
            "new_key_prefix": new_key.key_prefix,
            "grace_hours": grace_hours,
        },
        ip_address=get_client_ip(request),
    )
    await db.commit()

    return ApiKeyCreatedResponse(
        id=new_key.id,
        name=new_key.name,
        key_prefix=new_key.key_prefix,
        key=full_key,
        scopes=new_key.scopes,
        created_at=new_key.created_at,
        last_used_at=new_key.last_used_at,
    )


# ========== Helper ==========

async def _get_project_org(project: Project, db: AsyncSession) -> Organization:
    """Get the organization for a project."""
    result = await db.execute(
        select(Organization).where(Organization.id == project.organization_id)
    )
    return result.scalar_one()
