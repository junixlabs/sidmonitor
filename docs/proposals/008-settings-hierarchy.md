# 008 — Settings Hierarchy (Org → Project → User)

## Summary

Split the current single Settings page into three tiers — Organization Settings, Project Settings, and User Settings — following the standard SaaS pattern used by Sentry, Vercel, and PostHog.

## Motivation

SidMonitor currently has one Settings page that mixes project config with API key management. As the platform grows, settings need clear scoping:

- **Org-level**: member management, billing, security policies, default retention — these apply to all projects
- **Project-level**: SDK setup, API keys, alert rules, data filters — scoped to one project
- **User-level**: theme, notifications, timezone, personal API tokens — personal preferences

Mixing these causes confusion about what affects the whole org vs a single project. Every major SaaS platform (Sentry, Vercel, PostHog, Datadog) separates settings into at least 2–3 tiers with clear inheritance.

## Technical Design

### 1. Settings Architecture

```
/settings/account                         → User Settings (personal)
/:orgSlug/settings                        → Organization Settings
/:orgSlug/:projectSlug/settings           → Project Settings (current, enhanced)
```

**Inheritance model:** Org settings define defaults. Project settings can override where applicable. User settings are personal and independent.

### 2. Organization Settings Page

Route: `/:orgSlug/settings`

**Tabs:**

| Tab | Content |
|-----|---------|
| **General** | Org name, slug (read-only), created date, plan badge |
| **Members** | Member list with roles (owner/admin/member), invite flow, role change, remove |
| **Billing** | Current plan, usage stats, upgrade CTA (placeholder for future) |
| **Security** | Password policies, session timeout, future SSO config |
| **Audit Log** | Paginated audit trail (from proposal 007) |

**Members tab detail:**
- Table: avatar, name, email, role badge, joined_at, actions dropdown
- Invite modal: email input, role selector (admin/member), send invitation
- Pending invites section: email, role, invited_at, resend/revoke actions
- Role change: dropdown on each member row (owner can change anyone, admin can change member↔admin)

**API endpoints needed:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/organizations/{slug}` | Org details (exists) |
| `PATCH` | `/api/organizations/{slug}` | Update org name |
| `GET` | `/api/organizations/{slug}/members` | List members (exists) |
| `POST` | `/api/organizations/{slug}/invitations` | Send invitation (exists) |
| `PATCH` | `/api/organizations/{slug}/members/{id}` | Change member role |
| `DELETE` | `/api/organizations/{slug}/members/{id}` | Remove member |
| `GET` | `/api/organizations/{slug}/audit-log` | Audit log (from proposal 007) |

### 3. Enhanced Project Settings Page

Route: `/:orgSlug/:projectSlug/settings` (existing, enhanced)

**Tabs:**

| Tab | Content |
|-----|---------|
| **General** | Project name (editable), slug (read-only), platform, environment, created date, danger zone (delete) |
| **SDK Setup** | DSN display, installation guide (Laravel/Python), copy-to-clipboard |
| **API Keys** | Key list, create/revoke, scopes management (from proposal 007) |
| **Alerts** | Alert rules management (from proposal 003) |
| **Data** | Retention period display, data filters, excluded paths |

**General tab — Danger Zone:**
- "Delete Project" button with confirmation modal
- Type project name to confirm
- Warning about irreversible data loss
- Requires org admin+ role

**New endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `PATCH` | `/api/projects/{slug}` | Update project name, environment |
| `DELETE` | `/api/projects/{slug}` | Delete project (admin+) |

### 4. User Settings Page

Route: `/settings/account`

**Sections:**

| Section | Content |
|---------|---------|
| **Profile** | Name, email (read-only), avatar URL |
| **Appearance** | Theme (light/dark/system), density (comfortable/compact) — currently in ThemeContext |
| **Notifications** | Email notification preferences (future: alert emails, weekly digest) |
| **Personal Tokens** | User-scoped API tokens for programmatic dashboard access (separate from project API keys) |
| **Sessions** | Active sessions, logout all devices |

**Profile API:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/auth/me` | Current user profile (exists) |
| `PATCH` | `/api/auth/me` | Update name, avatar |
| `POST` | `/api/auth/me/tokens` | Create personal API token |
| `GET` | `/api/auth/me/tokens` | List personal tokens |
| `DELETE` | `/api/auth/me/tokens/{id}` | Revoke personal token |

### 5. Navigation Changes

**Sidebar — Project-scoped:**
```
Settings group:
  └── Settings          → /:orgSlug/:projectSlug/settings
```

**Header — User menu dropdown:**
```
User Avatar ▼
  ├── User Settings     → /settings/account
  ├── Org Settings      → /:orgSlug/settings
  └── Logout
```

**Org Settings accessible from:**
- Header user dropdown (always visible)
- Organizations page → gear icon per org
- Project Settings → "Organization Settings" link at top

### 6. Frontend Components

```
frontend/src/pages/
  ├── Settings.tsx                    (existing — becomes Project Settings)
  ├── OrgSettings.tsx                 (new)
  └── UserSettings.tsx                (new)

frontend/src/components/settings/
  ├── OrgGeneralTab.tsx
  ├── OrgMembersTab.tsx
  ├── OrgBillingTab.tsx
  ├── OrgAuditLogTab.tsx
  ├── ProjectGeneralTab.tsx
  ├── ProjectSdkSetupTab.tsx
  ├── ProjectApiKeysTab.tsx
  ├── UserProfileSection.tsx
  ├── UserAppearanceSection.tsx
  └── UserTokensSection.tsx
```

## Files to Modify

| Layer | File | Change |
|-------|------|--------|
| Frontend | `frontend/src/pages/OrgSettings.tsx` | New — org settings with tabs |
| Frontend | `frontend/src/pages/UserSettings.tsx` | New — user settings |
| Frontend | `frontend/src/pages/Settings.tsx` | Refactor into tabbed project settings |
| Frontend | `frontend/src/components/settings/` | New — tab components (see list above) |
| Frontend | `frontend/src/components/layoutComponents/Header.tsx` | Add settings links to user dropdown |
| Frontend | `frontend/src/App.tsx` | Add routes for `/settings/account`, `/:orgSlug/settings` |
| Frontend | `frontend/src/hooks/useOrgSettings.ts` | New — org members, invitations hooks |
| Frontend | `frontend/src/hooks/useUserSettings.ts` | New — profile, tokens hooks |
| Frontend | `frontend/src/api/client.ts` | Add org settings, user profile API namespaces |
| Backend API | `backend/app/api/organizations.py` | Add member role change, member remove endpoints |
| Backend API | `backend/app/api/projects.py` | Add project update, project delete endpoints |
| Backend API | `backend/app/api/auth.py` | Add profile update, personal tokens endpoints |
| Backend Model | `backend/app/models/database.py` | Add PersonalToken model |

## Implementation Steps

1. **Route structure** — add `/settings/account` and `/:orgSlug/settings` routes in App.tsx
2. **Org Settings page** — General + Members tabs (leverage existing member API endpoints)
3. **User Settings page** — Profile + Appearance sections (move theme from ThemeContext toggle)
4. **Refactor Project Settings** — split into tabs (General, SDK, API Keys)
5. **Header navigation** — add settings links to user dropdown menu
6. **Backend: org member management** — role change + remove endpoints
7. **Backend: project CRUD** — update name + delete project endpoints
8. **Backend: personal tokens** — CRUD endpoints for user-scoped API tokens
9. **Danger zone** — delete project with confirmation flow
10. **Testing** — verify role-based visibility of settings tabs

## Effort Estimate

| Component | Estimate |
|-----------|----------|
| Route structure + navigation | 0.5 day |
| Org Settings page (General + Members) | 2 days |
| User Settings page | 1.5 days |
| Refactor Project Settings into tabs | 1 day |
| Backend member management endpoints | 1 day |
| Backend project update/delete | 0.5 day |
| Backend personal tokens | 1 day |
| Testing | 1 day |
| **Total** | **8–10 days** |
