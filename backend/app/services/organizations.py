"""
Organization service for managing organizations and memberships.
"""
import re
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Organization, OrganizationMember, User
from app.models.organization import MemberRole, OrganizationCreate


def generate_slug(name: str) -> str:
    """
    Generate URL-safe slug from organization name.

    Converts to lowercase, replaces spaces with hyphens, removes special characters.

    Args:
        name: Organization name

    Returns:
        URL-safe slug string
    """
    # Convert to lowercase
    slug = name.lower()

    # Replace spaces with hyphens
    slug = slug.replace(" ", "-")

    # Remove all non-alphanumeric characters except hyphens
    slug = re.sub(r'[^a-z0-9-]', '', slug)

    # Remove consecutive hyphens
    slug = re.sub(r'-+', '-', slug)

    # Remove leading/trailing hyphens
    slug = slug.strip("-")

    return slug


async def ensure_unique_slug(db: AsyncSession, slug: str) -> str:
    """
    Ensure slug is unique by appending a number if necessary.

    Args:
        db: Database session
        slug: Proposed slug

    Returns:
        Unique slug
    """
    original_slug = slug
    counter = 1

    while True:
        result = await db.execute(
            select(Organization).where(Organization.slug == slug)
        )
        existing = result.scalar_one_or_none()

        if not existing:
            return slug

        slug = f"{original_slug}-{counter}"
        counter += 1


async def get_user_organizations(db: AsyncSession, user_id: uuid.UUID) -> List[Organization]:
    """
    Get all organizations the user is a member of.

    Args:
        db: Database session
        user_id: User ID

    Returns:
        List of organizations
    """
    result = await db.execute(
        select(Organization)
        .join(OrganizationMember, Organization.id == OrganizationMember.organization_id)
        .where(OrganizationMember.user_id == user_id)
        .order_by(Organization.created_at.desc())
    )

    return list(result.scalars().all())


async def create_organization(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: OrganizationCreate
) -> Organization:
    """
    Create a new organization and add creator as owner.

    Args:
        db: Database session
        user_id: User ID (will become owner)
        data: Organization creation data

    Returns:
        Created organization
    """
    # Generate slug
    slug = generate_slug(data.name)
    slug = await ensure_unique_slug(db, slug)

    # Create organization
    organization = Organization(
        name=data.name,
        slug=slug,
        owner_id=user_id,
        plan="free",
    )

    db.add(organization)
    await db.flush()  # Get organization ID before creating membership

    # Add creator as owner
    membership = OrganizationMember(
        organization_id=organization.id,
        user_id=user_id,
        role=MemberRole.owner.value,
        joined_at=datetime.utcnow(),
    )

    db.add(membership)
    await db.commit()
    await db.refresh(organization)

    return organization


async def get_organization_by_slug(db: AsyncSession, slug: str) -> Optional[Organization]:
    """
    Get organization by slug.

    Args:
        db: Database session
        slug: Organization slug

    Returns:
        Organization or None if not found
    """
    result = await db.execute(
        select(Organization).where(Organization.slug == slug)
    )

    return result.scalar_one_or_none()


async def get_user_membership(
    db: AsyncSession,
    user_id: uuid.UUID,
    organization_id: uuid.UUID
) -> Optional[OrganizationMember]:
    """
    Get user's membership in an organization.

    Args:
        db: Database session
        user_id: User ID
        organization_id: Organization ID

    Returns:
        OrganizationMember or None if not a member
    """
    result = await db.execute(
        select(OrganizationMember).where(
            and_(
                OrganizationMember.user_id == user_id,
                OrganizationMember.organization_id == organization_id,
            )
        )
    )

    return result.scalar_one_or_none()


async def check_organization_permission(
    db: AsyncSession,
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    required_role: MemberRole
) -> bool:
    """
    Check if user has required permission level in organization.

    Permission hierarchy: owner > admin > member

    Args:
        db: Database session
        user_id: User ID
        organization_id: Organization ID
        required_role: Minimum required role

    Returns:
        True if user has sufficient permissions, False otherwise
    """
    membership = await get_user_membership(db, user_id, organization_id)

    if not membership:
        return False

    # Define role hierarchy
    role_hierarchy = {
        MemberRole.owner.value: 3,
        MemberRole.admin.value: 2,
        MemberRole.member.value: 1,
    }

    user_role_level = role_hierarchy.get(membership.role, 0)
    required_role_level = role_hierarchy.get(required_role.value if hasattr(required_role, 'value') else required_role, 0)

    return user_role_level >= required_role_level


async def get_organization_members(
    db: AsyncSession,
    organization_id: uuid.UUID
) -> List[OrganizationMember]:
    """
    Get all members of an organization with user information.

    Args:
        db: Database session
        organization_id: Organization ID

    Returns:
        List of organization members with user details
    """
    result = await db.execute(
        select(OrganizationMember, User)
        .join(User, OrganizationMember.user_id == User.id)
        .where(OrganizationMember.organization_id == organization_id)
        .order_by(OrganizationMember.joined_at.desc())
    )

    members = []
    for membership, user in result.all():
        # Create a combined object for response
        membership.user_email = user.email
        membership.user_name = user.name
        members.append(membership)

    return members


async def add_member(
    db: AsyncSession,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    role: MemberRole
) -> OrganizationMember:
    """
    Add a member to organization.

    Args:
        db: Database session
        organization_id: Organization ID
        user_id: User ID to add
        role: Role to assign

    Returns:
        Created organization member

    Raises:
        HTTPException: If user is already a member
    """
    # Check if already a member
    existing = await get_user_membership(db, user_id, organization_id)

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this organization",
        )

    # Create membership
    membership = OrganizationMember(
        organization_id=organization_id,
        user_id=user_id,
        role=role.value if hasattr(role, 'value') else role,
        joined_at=datetime.utcnow(),
    )

    db.add(membership)
    await db.commit()
    await db.refresh(membership)

    return membership


async def update_member_role(
    db: AsyncSession,
    organization_id: uuid.UUID,
    member_id: uuid.UUID,
    new_role: MemberRole,
    current_user_role: str
) -> OrganizationMember:
    """
    Update a member's role.

    Args:
        db: Database session
        organization_id: Organization ID
        member_id: Member ID to update
        new_role: New role to assign
        current_user_role: Role of the user making the change

    Returns:
        Updated organization member

    Raises:
        HTTPException: If member not found or permission denied
    """
    result = await db.execute(
        select(OrganizationMember).where(
            and_(
                OrganizationMember.id == member_id,
                OrganizationMember.organization_id == organization_id,
            )
        )
    )

    membership = result.scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    # Cannot change owner's role
    if membership.role == MemberRole.owner.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot change owner's role",
        )

    # Admin cannot change another admin's role or promote to owner
    if current_user_role == MemberRole.admin.value:
        if membership.role == MemberRole.admin.value or new_role == MemberRole.owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to perform this action",
            )

    membership.role = new_role.value if hasattr(new_role, 'value') else new_role

    await db.commit()
    await db.refresh(membership)

    return membership


async def remove_member(
    db: AsyncSession,
    organization_id: uuid.UUID,
    member_id: uuid.UUID
) -> bool:
    """
    Remove a member from organization.

    Args:
        db: Database session
        organization_id: Organization ID
        member_id: Member ID to remove

    Returns:
        True if removed successfully

    Raises:
        HTTPException: If member not found or trying to remove owner
    """
    result = await db.execute(
        select(OrganizationMember).where(
            and_(
                OrganizationMember.id == member_id,
                OrganizationMember.organization_id == organization_id,
            )
        )
    )

    membership = result.scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    # Cannot remove owner
    if membership.role == MemberRole.owner.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot remove organization owner",
        )

    await db.delete(membership)
    await db.commit()

    return True
