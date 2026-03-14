# 010 — Organization Switcher & Navigation Enhancement

## Summary

Add an organization switcher to the sidebar header, enhance the ProjectSwitcher with org awareness, and add a global overview dashboard that aggregates metrics across all projects — following the Sentry/Vercel pattern of contextual navigation.

## Motivation

Current navigation gaps:

- **No org switcher** — users with multiple orgs must go to `/organizations` page to change org context
- **ProjectSwitcher only shows projects from current org** — no way to quickly jump to a project in another org
- **GlobalDashboard is basic** — shows org/project list but no aggregated metrics
- **Sidebar doesn't indicate which org is active** — only shows project name

Sentry solves this with an org dropdown in the sidebar header. Vercel's recent nav redesign (Feb 2026) uses a team switcher that also shows projects as filters. Both patterns keep the user oriented about their current context.

## Technical Design

### 1. Sidebar Header — Org/Project Context

Replace the current "SidMonitor" logo area with a context-aware header:

**When on project-scoped page:**
```
┌──────────────────────────────┐
│  [Logo]  SidMonitor          │
│                              │
│  ▾ Acme Corp                 │  ← org switcher dropdown
│  ▾ my-laravel-app            │  ← project switcher dropdown
└──────────────────────────────┘
```

**When on global page:**
```
┌──────────────────────────────┐
│  [Logo]  SidMonitor          │
│                              │
│  ▾ Acme Corp                 │  ← org switcher dropdown
└──────────────────────────────┘
```

**When sidebar collapsed:**
```
┌────┐
│ [A] │  ← org initial avatar, click to expand org switcher
└────┘
```

### 2. Org Switcher Dropdown

Component: `frontend/src/components/layoutComponents/OrgSwitcher.tsx`

```
┌────────────────────────────────┐
│  🔍 Search organizations...    │
├────────────────────────────────┤
│  ✓ Acme Corp          owner   │  ← current (highlighted)
│    Personal Workspace  owner   │
│    Client XYZ          member  │
├────────────────────────────────┤
│  + Create Organization         │
│  ⚙ Manage Organizations       │
└────────────────────────────────┘
```

**Behavior:**
- Shows all orgs the user belongs to with their role badge
- Search/filter for users with many orgs
- Selecting an org → navigate to `/:orgSlug/projects` (project list)
- If the org has exactly 1 project → navigate directly to that project's dashboard
- Keyboard: Ctrl+O to toggle (complement ProjectSwitcher's Ctrl+P)

### 3. Enhanced ProjectSwitcher

Update the existing `ProjectSwitcher.tsx` to be org-aware:

```
┌──────────────────────────────────┐
│  🔍 Search projects...           │
├──────────────────────────────────┤
│  ACME CORP                       │
│    ✓ my-laravel-app    Laravel  │  ← current
│      api-service       Python   │
│      admin-panel       Laravel  │
├──────────────────────────────────┤
│  PERSONAL WORKSPACE              │
│      side-project      Laravel  │
├──────────────────────────────────┤
│  + Create Project                │
└──────────────────────────────────┘
```

**Changes from current:**
- Group projects by organization
- Show all projects across all orgs (not just current org)
- Platform badge next to each project
- Cross-org switching in one click (navigate changes both org and project context)

### 4. Global Overview Dashboard Enhancement

Enhance `frontend/src/pages/GlobalDashboard.tsx` to show aggregated metrics:

**Current:** Just a list of orgs and projects.

**Enhanced layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Global Overview                                         │
├──────────────┬──────────────┬──────────────┬────────────┤
│  Total       │  Avg Error   │  Avg P95     │  Active    │
│  Requests    │  Rate        │  Latency     │  Projects  │
│  124.5k      │  2.3%        │  340ms       │  5/7       │
├──────────────┴──────────────┴──────────────┴────────────┤
│                                                          │
│  Project Health Overview                                 │
│  ┌─────────────────┬────────┬───────┬────────┬────────┐ │
│  │ Project         │ Status │ Req/h │ Errors │ P95    │ │
│  ├─────────────────┼────────┼───────┼────────┼────────┤ │
│  │ my-laravel-app  │ 🟢     │ 2.4k  │ 0.5%   │ 120ms  │ │
│  │ api-service     │ 🟡     │ 890   │ 4.2%   │ 450ms  │ │
│  │ admin-panel     │ 🔴     │ 45    │ 12%    │ 1.2s   │ │
│  └─────────────────┴────────┴───────┴────────┴────────┘ │
│                                                          │
│  Click any project to view details →                     │
└─────────────────────────────────────────────────────────┘
```

**New backend endpoint:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/overview/stats` | Aggregated stats across all user's projects |
| `GET` | `/api/v1/overview/project-health` | Per-project health summary (req/h, error rate, p95) |

### 5. Breadcrumb Context Indicator

Add a subtle breadcrumb in the main content area header:

```
Acme Corp > my-laravel-app > Dashboard
```

Component: `frontend/src/components/layoutComponents/Breadcrumb.tsx`

- Org name links to `/:orgSlug/settings`
- Project name links to `/:orgSlug/:projectSlug/dashboard`
- Current page name (non-clickable)
- Only shown on project-scoped pages

### 6. Keyboard Navigation

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Toggle org switcher |
| `Ctrl+P` | Toggle project switcher (existing) |
| `↑ / ↓` | Navigate items in dropdown |
| `Enter` | Select highlighted item |
| `Escape` | Close dropdown |
| `Ctrl+K` | Future: global command palette |

## Files to Modify

| Layer | File | Change |
|-------|------|--------|
| Frontend | `frontend/src/components/layoutComponents/OrgSwitcher.tsx` | New — org switcher dropdown |
| Frontend | `frontend/src/components/layoutComponents/ProjectSwitcher.tsx` | Group by org, show all orgs' projects |
| Frontend | `frontend/src/components/layoutComponents/Sidebar.tsx` | Add OrgSwitcher + ProjectSwitcher to header area |
| Frontend | `frontend/src/components/layoutComponents/Breadcrumb.tsx` | New — context breadcrumb |
| Frontend | `frontend/src/components/Layout.tsx` | Add Breadcrumb to main content header |
| Frontend | `frontend/src/pages/GlobalDashboard.tsx` | Add aggregated stats + project health table |
| Frontend | `frontend/src/hooks/useOverview.ts` | New — hooks for overview stats |
| Frontend | `frontend/src/api/client.ts` | Add overview API namespace |
| Backend API | `backend/app/api/overview.py` | New — aggregated stats endpoints |
| Backend Service | `backend/app/services/overview_service.py` | New — cross-project metric aggregation |
| Backend API | `backend/app/main.py` | Register overview router |

## Implementation Steps

1. **OrgSwitcher component** — dropdown with search, org list, role badges, keyboard shortcut
2. **Enhance ProjectSwitcher** — group by org, show cross-org projects, platform badges
3. **Sidebar header refactor** — replace logo area with OrgSwitcher + ProjectSwitcher (logo moves smaller)
4. **Backend overview endpoints** — aggregate metrics across user's projects from ClickHouse
5. **Global Dashboard enhancement** — overview cards + project health table
6. **Breadcrumb component** — org > project > page context indicator
7. **Keyboard navigation** — arrow keys + enter in both switcher dropdowns
8. **Cache management** — clear project-scoped cache on org switch
9. **Testing** — multi-org user flow, single-org user, no-project state

## Effort Estimate

| Component | Estimate |
|-----------|----------|
| OrgSwitcher component | 1.5 days |
| ProjectSwitcher enhancement | 1 day |
| Sidebar header refactor | 0.5 day |
| Backend overview endpoints | 1.5 days |
| Global Dashboard enhancement | 1.5 days |
| Breadcrumb component | 0.5 day |
| Keyboard navigation | 0.5 day |
| Testing | 1 day |
| **Total** | **7–9 days** |
