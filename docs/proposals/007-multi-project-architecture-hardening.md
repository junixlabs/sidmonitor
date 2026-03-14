# 007 — Multi-Project Architecture Hardening

## Summary

Close critical security and data-integrity gaps in the multi-tenant architecture: enforce API key scopes, activate ProjectMember RBAC, scope React Query cache by project, add API key expiration, and implement audit logging.

## Motivation

SidMonitor's multi-tenant foundation (User → Org → Project → Logs) is solid, but several schemas and features are defined without enforcement:

- `ProjectMember` table exists with `admin/member/viewer` roles but no endpoint checks it
- `ApiKey.scopes` is stored but never validated — an ingest-only key can read dashboard data
- React Query cache keys don't include `projectSlug`, risking cross-project data bleed on switch
- API keys live forever with no expiration or rotation support
- No audit trail for who created/deleted what

These are security and data-integrity issues that must be resolved before scaling to multiple teams and organizations.

## Technical Design

### 1. API Key Scope Enforcement

**Current state:** `ApiKey.scopes` stores `["ingest"]` but `verify_api_key_and_get_project()` never checks it.

**Defined scopes:**

| Scope | Grants |
|-------|--------|
| `ingest:write` | POST to `/api/ingest/*` endpoints |
| `data:read` | GET from `/api/v1/*` query endpoints |
| `settings:read` | GET project settings, list API keys |
| `settings:write` | Create/revoke API keys, update project config |

**Implementation:**

```python
# backend/app/dependencies.py
def require_scope(required: str):
    def dependency(api_key: ApiKey = Depends(get_api_key)):
        if required not in api_key.scopes:
            raise AppException(status_code=403, detail=f"API key missing scope: {required}")
        return api_key
    return dependency

# Usage in endpoints:
@router.post("/ingest")
async def ingest(key=Depends(require_scope("ingest:write"))): ...

@router.get("/v1/inbound/stats")
async def stats(key=Depends(require_scope("data:read"))): ...
```

**Migration:** Existing keys default to `["ingest:write"]` (backward compatible — existing SDKs continue working).

### 2. ProjectMember RBAC Activation

**Current state:** `ProjectMember` table has roles (`admin`, `member`, `viewer`) but endpoints only check `OrganizationMember`.

**Access matrix:**

| Action | Org Owner | Org Admin | Project Admin | Project Member | Project Viewer |
|--------|-----------|-----------|---------------|----------------|----------------|
| View dashboard/logs | Yes | Yes | Yes | Yes | Yes |
| Export data | Yes | Yes | Yes | Yes | No |
| Manage API keys | Yes | Yes | Yes | No | No |
| Edit project settings | Yes | Yes | Yes | No | No |
| Delete project | Yes | Yes | No | No | No |
| Manage project members | Yes | Yes | Yes | No | No |

**Implementation:**

```python
# backend/app/dependencies.py
async def check_project_role(
    project_slug: str,
    user: User = Depends(get_current_user),
    min_role: str = "viewer"
) -> ProjectAccess:
    # 1. Check org membership (org owners/admins bypass project roles)
    org_member = await get_org_member(user.id, project.organization_id)
    if org_member and org_member.role in ("owner", "admin"):
        return ProjectAccess(role="admin", source="org")

    # 2. Check project membership
    project_member = await get_project_member(user.id, project.id)
    if not project_member:
        raise AppException(403, "No access to this project")

    role_hierarchy = {"viewer": 0, "member": 1, "admin": 2}
    if role_hierarchy[project_member.role] < role_hierarchy[min_role]:
        raise AppException(403, f"Requires {min_role} role")

    return ProjectAccess(role=project_member.role, source="project")
```

**New endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects/{slug}/members` | List project members with roles |
| `POST` | `/api/projects/{slug}/members` | Add member to project |
| `PATCH` | `/api/projects/{slug}/members/{user_id}` | Update member role |
| `DELETE` | `/api/projects/{slug}/members/{user_id}` | Remove member from project |

**Migration:** All existing org members auto-inherit `member` role on their org's projects (no access regression).

### 3. React Query Cache Scoping

**Current state:** Query keys like `["inboundStats", timeRange]` don't include project context. Switching projects can show stale data from the previous project.

**Fix:** Include `projectSlug` in all project-scoped query keys.

```typescript
// frontend/src/hooks/useInboundLogs.ts — BEFORE
useQuery({ queryKey: ['inboundStats', timeRange], ... })

// AFTER
const { projectSlug } = useWorkspaceStore()
useQuery({ queryKey: ['inboundStats', projectSlug, timeRange], ... })
```

**Cache invalidation on switch:** In `ProjectSwitcher`, call `queryClient.removeQueries()` for the old project scope when switching:

```typescript
// frontend/src/components/layoutComponents/ProjectSwitcher.tsx
const handleSwitch = (project: Project) => {
  queryClient.removeQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) && query.queryKey[1] === currentProject?.slug
  })
  navigate(`/${orgSlug}/${project.slug}/dashboard`)
}
```

**Affected hooks:** All project-scoped hooks must be updated:
- `useInboundLogs`, `useInboundStats`
- `useOutboundLogs`, `useOutboundStats`
- `useJobs`, `useJobStats`
- `useScheduledTasks`
- `useLogs`
- `useStats`, `useTimeSeries`

### 4. API Key Expiration & Rotation

**Schema change:**

```sql
ALTER TABLE api_keys
  ADD COLUMN expires_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN rotated_from UUID REFERENCES api_keys(id) DEFAULT NULL;
```

**Enforcement in `verify_api_key_and_get_project()`:**

```python
if api_key.expires_at and api_key.expires_at < datetime.utcnow():
    raise AppException(401, "API key expired")
if api_key.revoked_at:
    raise AppException(401, "API key revoked")
```

**Rotation flow:**
1. `POST /api/projects/{slug}/api-keys/{id}/rotate` → creates a new key, sets `rotated_from` = old key ID
2. Old key stays active for a grace period (configurable, default 24h), then auto-revokes
3. SDK can switch to new key during grace period without downtime

**`last_used_at` tracking** — update on every successful ingest:

```python
# In verify_api_key_and_get_project(), after successful validation:
await db.execute(
    update(ApiKey).where(ApiKey.id == api_key.id)
    .values(last_used_at=datetime.utcnow())
)
```

### 5. Audit Log

**PostgreSQL table:**

```sql
CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id    UUID REFERENCES users(id),
    actor_type  VARCHAR(20) NOT NULL DEFAULT 'user',  -- 'user', 'api_key', 'system'
    action      VARCHAR(100) NOT NULL,                  -- 'project.create', 'api_key.revoke', etc.
    target_type VARCHAR(50) DEFAULT NULL,               -- 'project', 'api_key', 'member'
    target_id   UUID DEFAULT NULL,
    metadata    JSONB DEFAULT '{}',                     -- { "project_name": "my-app", "old_role": "member", "new_role": "admin" }
    ip_address  INET DEFAULT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_org_time ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);
```

**Tracked actions:**

| Action | Trigger |
|--------|---------|
| `org.create` | New organization created |
| `org.update` | Organization settings changed |
| `org.member.invite` | Member invited |
| `org.member.remove` | Member removed |
| `org.member.role_change` | Member role changed |
| `project.create` | New project created |
| `project.delete` | Project deleted |
| `project.update` | Project settings changed |
| `project.member.add` | Member added to project |
| `project.member.remove` | Member removed from project |
| `api_key.create` | API key generated |
| `api_key.revoke` | API key revoked |
| `api_key.rotate` | API key rotated |

**Helper service:**

```python
# backend/app/services/audit_service.py
async def log_action(
    org_id: UUID, actor_id: UUID, action: str,
    target_type: str = None, target_id: UUID = None,
    metadata: dict = None, ip_address: str = None
):
    await db.execute(insert(AuditLog).values(...))
```

**API endpoint:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/organizations/{slug}/audit-log` | Paginated audit log (org admin+ only) |

## Files to Modify

| Layer | File | Change |
|-------|------|--------|
| DB Migration | `database/migrations/` | Add `expires_at`, `rotated_from` to api_keys; create `audit_logs` table |
| Backend Model | `backend/app/models/database.py` | Update ApiKey model; add AuditLog model |
| Backend Model | `backend/app/models/audit.py` | New — AuditLogEntry, AuditLogResponse schemas |
| Backend Dep | `backend/app/dependencies.py` | New — `require_scope()`, `check_project_role()` |
| Backend Service | `backend/app/services/audit_service.py` | New — `log_action()` helper |
| Backend API | `backend/app/api/ingest.py` | Add scope checks, `last_used_at` update |
| Backend API | `backend/app/api/projects.py` | Add project member CRUD endpoints, audit logging |
| Backend API | `backend/app/api/organizations.py` | Add audit log endpoint |
| Backend API | `backend/app/main.py` | Register updated routers |
| Frontend | `frontend/src/hooks/*.ts` | Add `projectSlug` to all query keys |
| Frontend | `frontend/src/components/layoutComponents/ProjectSwitcher.tsx` | Cache invalidation on switch |

## Implementation Steps

1. **API key scope enforcement** — `require_scope()` dependency, migrate existing keys to `["ingest:write"]`
2. **ProjectMember RBAC** — `check_project_role()` dependency, apply to all project-scoped endpoints
3. **Project member API** — CRUD endpoints for project member management
4. **React Query cache scoping** — add `projectSlug` to all hook query keys, invalidate on switch
5. **API key expiration** — schema migration, validation in auth flow, rotation endpoint
6. **`last_used_at` tracking** — update on every successful ingest
7. **Audit log** — table, service, endpoint, wire into all mutation endpoints
8. **Testing** — scope enforcement, role hierarchy, cache isolation, key expiration

## Effort Estimate

| Component | Estimate |
|-----------|----------|
| API key scope enforcement | 1 day |
| ProjectMember RBAC activation | 1.5–2 days |
| Project member API endpoints | 1 day |
| React Query cache scoping | 1 day |
| API key expiration + rotation | 1 day |
| Audit log (table + service + endpoint) | 1.5 days |
| Testing | 1.5 days |
| **Total** | **8–10 days** |
