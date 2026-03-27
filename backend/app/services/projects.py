"""
Project service for project management and API key generation.
"""
import asyncio
import hashlib
import re
import secrets
import time
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.database import ApiKey, OrganizationMember, Project, User
from app.models.project import ApiKeyCreate, ProjectCreate, ProjectUpdate

settings = get_settings()

# Debounce last_used_at updates: key_hash -> last update timestamp
_last_used_at_cache: dict[str, float] = {}
_LAST_USED_AT_INTERVAL = 60  # seconds
_cache_lock = asyncio.Lock()


def generate_project_slug(name: str) -> str:
    """
    Generate a URL-friendly slug from project name.

    Args:
        name: Project name

    Returns:
        Slugified project name (lowercase, alphanumeric + hyphens)
    """
    # Convert to lowercase and replace spaces with hyphens
    slug = name.lower().strip()
    # Replace non-alphanumeric characters (except hyphens) with hyphens
    slug = re.sub(r'[^a-z0-9-]+', '-', slug)
    # Remove multiple consecutive hyphens
    slug = re.sub(r'-+', '-', slug)
    # Remove leading/trailing hyphens
    slug = slug.strip('-')

    return slug


def generate_dsn_key() -> str:
    """
    Generate unique DSN public key (32 character hex string).

    Returns:
        32-character hex string
    """
    return secrets.token_hex(16)  # 16 bytes = 32 hex characters


def generate_api_key() -> Tuple[str, str, str]:
    """
    Generate API key with prefix and hash.

    Returns:
        Tuple of (full_key, key_prefix, key_hash)
        - full_key: Complete API key to return to user (smk_<32-char-hex>)
        - key_prefix: First 8 chars after prefix for display (smk_abc123...)
        - key_hash: SHA256 hash for storage
    """
    # Generate random 32-character hex string
    random_part = secrets.token_hex(16)

    # Build full key with prefix
    full_key = f"smk_{random_part}"

    # Extract prefix (first 8 chars of random part)
    key_prefix = f"smk_{random_part[:8]}"

    # Hash the full key for storage
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()

    return full_key, key_prefix, key_hash


def hash_api_key(key: str) -> str:
    """
    Hash an API key using SHA256.

    Args:
        key: Full API key string

    Returns:
        SHA256 hash of the key
    """
    return hashlib.sha256(key.encode()).hexdigest()


async def create_project(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    data: ProjectCreate,
    db: AsyncSession
) -> Project:
    """
    Create a new project in an organization.

    Args:
        org_id: Organization ID
        user_id: User ID (creator)
        data: Project creation data
        db: Database session

    Returns:
        Created project

    Raises:
        HTTPException: If slug already exists in organization
    """
    # Generate slug from name
    slug = generate_project_slug(data.name)

    # Check if slug already exists in organization
    result = await db.execute(
        select(Project).where(
            Project.organization_id == org_id,
            Project.slug == slug
        )
    )
    existing_project = result.scalar_one_or_none()

    if existing_project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project with slug '{slug}' already exists in this organization"
        )

    # Generate unique DSN key
    dsn_key = generate_dsn_key()

    # Check DSN key uniqueness (global)
    result = await db.execute(
        select(Project).where(Project.dsn_public_key == dsn_key)
    )
    while result.scalar_one_or_none() is not None:
        dsn_key = generate_dsn_key()
        result = await db.execute(
            select(Project).where(Project.dsn_public_key == dsn_key)
        )

    # Create project
    project = Project(
        organization_id=org_id,
        name=data.name,
        slug=slug,
        platform=data.platform or "laravel",
        environment=data.environment,
        dsn_public_key=dsn_key,
        created_by=user_id
    )

    db.add(project)
    await db.flush()  # Flush to get the ID
    await db.refresh(project)

    return project


async def get_project_by_slug(slug: str, db: AsyncSession, user: Optional[User] = None) -> Project:
    """
    Get project by slug, scoped to user's organizations.

    Args:
        slug: Project slug
        db: Database session
        user: Current user (used to scope by organization membership)

    Returns:
        Project

    Raises:
        HTTPException: If project not found
    """
    query = select(Project).where(Project.slug == slug)

    if user is not None:
        query = query.join(
            OrganizationMember,
            (OrganizationMember.organization_id == Project.organization_id)
            & (OrganizationMember.user_id == user.id)
        )

    result = await db.execute(query)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{slug}' not found"
        )

    return project


async def update_project(
    project: Project,
    data: ProjectUpdate,
    db: AsyncSession
) -> Project:
    """
    Update project information.

    Args:
        project: Project to update
        data: Update data
        db: Database session

    Returns:
        Updated project
    """
    # Update only provided fields
    if data.name is not None:
        # Generate new slug if name changed
        new_slug = generate_project_slug(data.name)
        if new_slug != project.slug:
            # Check if new slug already exists in organization
            result = await db.execute(
                select(Project).where(
                    Project.organization_id == project.organization_id,
                    Project.slug == new_slug,
                    Project.id != project.id
                )
            )
            existing_project = result.scalar_one_or_none()

            if existing_project:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Project with slug '{new_slug}' already exists in this organization"
                )

            project.slug = new_slug

        project.name = data.name

    if data.platform is not None:
        project.platform = data.platform

    if data.environment is not None:
        project.environment = data.environment

    await db.flush()
    await db.refresh(project)

    return project


async def create_api_key(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    data: ApiKeyCreate,
    db: AsyncSession
) -> Tuple[ApiKey, str]:
    """
    Create API key for project.

    Args:
        project_id: Project ID
        user_id: User ID (creator)
        data: API key creation data
        db: Database session

    Returns:
        Tuple of (ApiKey model, full_key string)
        Full key is only returned once and should be shown to user immediately
    """
    # Generate API key
    full_key, key_prefix, key_hash = generate_api_key()

    # Create API key
    api_key = ApiKey(
        project_id=project_id,
        name=data.name,
        key_prefix=key_prefix,
        key_hash=key_hash,
        scopes=data.scopes,
        created_by=user_id
    )

    db.add(api_key)
    await db.flush()
    await db.refresh(api_key)

    return api_key, full_key


async def verify_api_key(key: str, db: AsyncSession) -> Optional[Project]:
    """
    Verify API key and return associated project.

    Args:
        key: Full API key string
        db: Database session

    Returns:
        Project if key is valid and not revoked, None otherwise
    """
    project, _ = await verify_api_key_full(key, db)
    return project


async def verify_api_key_full(key: str, db: AsyncSession) -> Tuple[Optional[Project], Optional[ApiKey]]:
    """
    Verify API key and return both the project and API key record.

    Args:
        key: Full API key string
        db: Database session

    Returns:
        Tuple of (Project, ApiKey) if key is valid and not revoked, (None, None) otherwise
    """
    # Hash the provided key
    key_hash = hash_api_key(key)

    # Find API key
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.key_hash == key_hash,
            ApiKey.revoked_at.is_(None)  # Not revoked
        )
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        return None, None

    # Debounce last_used_at — only flush to DB once per interval
    async with _cache_lock:
        now = time.monotonic()
        if now - _last_used_at_cache.get(key_hash, 0) >= _LAST_USED_AT_INTERVAL:
            api_key.last_used_at = datetime.now(timezone.utc)
            await db.flush()
            _last_used_at_cache[key_hash] = now

    # Get and return project
    result = await db.execute(
        select(Project).where(Project.id == api_key.project_id)
    )
    project = result.scalar_one_or_none()

    return project, api_key


async def revoke_api_key(api_key: ApiKey, db: AsyncSession) -> None:
    """
    Revoke an API key.

    Args:
        api_key: API key to revoke
        db: Database session
    """
    api_key.revoked_at = datetime.now(timezone.utc)
    await db.flush()


def build_dsn(project: Project, host: Optional[str] = None) -> str:
    """
    Build DSN string for project.

    Args:
        project: Project
        host: Host URL (defaults to localhost:8000 if not provided)

    Returns:
        DSN string in format: https://<dsn_public_key>@<host>/api/ingest
    """
    if host is None:
        host = f"{settings.host}:{settings.port}"

    # Remove http:// or https:// prefix if present
    host = host.replace("https://", "").replace("http://", "")

    return f"https://{project.dsn_public_key}@{host}/api/ingest"
