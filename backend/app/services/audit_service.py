"""
Audit logging service for tracking mutations across the platform.
"""
import uuid
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import AuditLog, User


async def log_action(
    db: AsyncSession,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[uuid.UUID] = None,
    metadata: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    actor_type: str = "user",
) -> AuditLog:
    """
    Record an audit log entry.

    Args:
        db: Database session
        org_id: Organization ID
        actor_id: User or API key that performed the action
        action: Action identifier (e.g. 'project.create', 'api_key.revoke')
        target_type: Type of the target resource (e.g. 'project', 'api_key')
        target_id: ID of the target resource
        metadata: Additional context as JSON
        ip_address: IP address of the actor
        actor_type: Type of actor ('user', 'api_key', 'system')

    Returns:
        Created AuditLog entry
    """
    entry = AuditLog(
        org_id=org_id,
        actor_id=actor_id,
        actor_type=actor_type,
        action=action,
        target_type=target_type,
        target_id=target_id,
        extra_data=metadata or {},
        ip_address=ip_address,
    )
    db.add(entry)
    await db.flush()
    return entry


async def get_audit_logs(
    db: AsyncSession,
    org_id: uuid.UUID,
    page: int = 1,
    per_page: int = 50,
) -> tuple[list[AuditLog], int]:
    """
    Get paginated audit logs for an organization.

    Returns:
        Tuple of (audit_log_entries, total_count)
    """
    # Count total
    count_result = await db.execute(
        select(func.count()).select_from(AuditLog).where(AuditLog.org_id == org_id)
    )
    total = count_result.scalar() or 0

    # Fetch page
    offset = (page - 1) * per_page
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.org_id == org_id)
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    entries = result.scalars().all()

    return list(entries), total


async def enrich_audit_logs(
    db: AsyncSession,
    entries: list[AuditLog],
) -> list[dict]:
    """Enrich audit log entries with actor names/emails."""
    actor_ids = {e.actor_id for e in entries if e.actor_id}
    actors = {}
    if actor_ids:
        result = await db.execute(
            select(User).where(User.id.in_(actor_ids))
        )
        for user in result.scalars().all():
            actors[user.id] = user

    enriched = []
    for entry in entries:
        actor = actors.get(entry.actor_id) if entry.actor_id else None
        enriched.append({
            "id": entry.id,
            "actor_id": entry.actor_id,
            "actor_type": entry.actor_type,
            "actor_name": actor.name if actor else None,
            "actor_email": actor.email if actor else None,
            "action": entry.action,
            "target_type": entry.target_type,
            "target_id": entry.target_id,
            "metadata": entry.extra_data,
            "ip_address": entry.ip_address,
            "created_at": entry.created_at,
        })

    return enriched
