# 009 — Onboarding Wizard

## Summary

Guided onboarding flow that takes new users from registration to seeing their first data in the dashboard. Follows the Sentry model: create org → create project (select platform) → show DSN + code snippets → wait for first event → celebrate → redirect to dashboard.

## Motivation

Current flow after registration:

1. Land on empty GlobalDashboard
2. Manually navigate to /organizations
3. Create organization
4. Navigate to /:orgSlug/projects
5. Create project
6. Navigate to Settings
7. Find API key and DSN
8. Figure out SDK installation from docs
9. Wait and hope data arrives
10. Manually refresh dashboard

This is 10 manual steps with no guidance. Industry standard (Sentry, PostHog, Vercel) reduces this to a single guided wizard that achieves "time to first value" in under 5 minutes. Users who don't see value quickly churn.

## Technical Design

### 1. Onboarding Flow (4 Steps)

```
Step 1: Create Organization
  → Name input, auto-generate slug
  → Skip if user already has an org

Step 2: Create Project
  → Name input
  → Platform selector: Laravel | Python | Node.js | Other
  → Environment: production | staging | development

Step 3: Install SDK
  → Platform-specific instructions (composer require, pip install, npm install)
  → Auto-generated .env snippet with real DSN and API key
  → Copy-to-clipboard for each code block
  → "I've installed the SDK" button

Step 4: Waiting for First Event
  → Live polling: GET /api/v1/inbound/recent?limit=1 every 3 seconds
  → Animated waiting indicator
  → When first event arrives:
    → Celebration animation (confetti / checkmark)
    → "View Dashboard" button → redirect to /:orgSlug/:projectSlug/dashboard
  → "Skip for now" link (goes to dashboard with empty state)
```

### 2. Onboarding State Tracking

**PostgreSQL — add to User model:**

```sql
ALTER TABLE users
  ADD COLUMN onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;
```

**Logic:**
- After registration, `onboarding_completed_at` is NULL
- If NULL and user navigates to `/`, redirect to `/onboarding`
- After completing wizard (or clicking "Skip"), set `onboarding_completed_at = NOW()`
- Never redirect to onboarding again after completion

### 3. Platform-Specific SDK Instructions

**Laravel:**
```bash
# Step 1: Install
composer require sidmonitor/laravel-observatory

# Step 2: Publish config
php artisan vendor:publish --tag=observatory-config

# Step 3: Add to .env
OBSERVATORY_ENABLED=true
OBSERVATORY_EXPORTER=sidmonitor
SIDMONITOR_API_KEY={{generated_api_key}}
SIDMONITOR_ENDPOINT={{ingest_endpoint}}
```

**Python:**
```bash
# Step 1: Install
pip install sidmonitor

# Step 2: Initialize
import sidmonitor
sidmonitor.init(
    api_key="{{generated_api_key}}",
    endpoint="{{ingest_endpoint}}"
)
```

**Node.js:**
```bash
# Step 1: Install
npm install @sidmonitor/node

# Step 2: Initialize
const sidmonitor = require('@sidmonitor/node');
sidmonitor.init({
    apiKey: '{{generated_api_key}}',
    endpoint: '{{ingest_endpoint}}'
});
```

Template variables (`{{generated_api_key}}`, `{{ingest_endpoint}}`) are replaced with real values from the project created in Step 2.

### 4. First Event Polling

```typescript
// frontend/src/hooks/useFirstEvent.ts
export function useFirstEvent(projectSlug: string, enabled: boolean) {
  return useQuery({
    queryKey: ['firstEvent', projectSlug],
    queryFn: () => inboundApi.getRecent(projectSlug, { limit: 1 }),
    enabled,
    refetchInterval: 3000,     // poll every 3s
    refetchIntervalInBackground: false,
    select: (data) => data.length > 0,
  })
}
```

**Backend:** No new endpoint needed — reuse existing `GET /api/v1/inbound/recent` or `GET /api/v1/inbound/stats` (check if total_requests > 0).

### 5. Empty State Enhancement

For users who skip onboarding or haven't sent data yet, enhance empty states across pages:

**Dashboard empty state:**
```
┌─────────────────────────────────────────┐
│  📊  No data yet                        │
│                                         │
│  SidMonitor is waiting for your first   │
│  request. Follow the setup guide to     │
│  start monitoring.                      │
│                                         │
│  [Open Setup Guide]  [View Docs]        │
└─────────────────────────────────────────┘
```

**Pattern:** Each page checks if data count is 0 and shows an action-oriented empty state instead of a blank page.

### 6. Frontend Components

```
frontend/src/pages/Onboarding.tsx           — Main wizard container
frontend/src/components/onboarding/
  ├── StepIndicator.tsx                     — Progress bar (Step 1/4)
  ├── CreateOrgStep.tsx                     — Org name input
  ├── CreateProjectStep.tsx                 — Project name + platform selector
  ├── InstallSdkStep.tsx                    — Platform-specific code blocks
  ├── WaitingForEventStep.tsx               — Polling + celebration
  └── PlatformInstructions.tsx              — Code templates per platform
```

### 7. Auto-Create API Key During Onboarding

When the project is created in Step 2, automatically:
1. Create the project via `POST /api/projects`
2. Create a default API key via `POST /api/projects/{slug}/api-keys` with name "Default (auto-generated)"
3. Store the full key in wizard state (shown once in Step 3)
4. Build DSN from key + endpoint

This means users never need to visit Settings to get their API key during onboarding.

## Files to Modify

| Layer | File | Change |
|-------|------|--------|
| DB Migration | `database/migrations/` | Add `onboarding_completed_at` to users |
| Backend Model | `backend/app/models/database.py` | Add column to User model |
| Backend API | `backend/app/api/auth.py` | Add `PATCH /auth/me/onboarding-complete` endpoint |
| Frontend | `frontend/src/pages/Onboarding.tsx` | New — wizard container |
| Frontend | `frontend/src/components/onboarding/` | New — all step components |
| Frontend | `frontend/src/hooks/useFirstEvent.ts` | New — polling hook |
| Frontend | `frontend/src/App.tsx` | Add `/onboarding` route, redirect logic |
| Frontend | `frontend/src/contexts/AuthContext.tsx` | Include `onboarding_completed_at` in user state |
| Frontend | `frontend/src/pages/Dashboard.tsx` | Add empty state with setup CTA |
| Frontend | `frontend/src/pages/InboundAPIs.tsx` | Add empty state |
| Frontend | `frontend/src/pages/OutboundAPIs.tsx` | Add empty state |
| Frontend | `frontend/src/pages/Jobs.tsx` | Add empty state |

## Implementation Steps

1. **Schema migration** — add `onboarding_completed_at` to users table
2. **Onboarding page** — wizard container with step navigation (back/next/skip)
3. **Step 1: CreateOrgStep** — org name input, slug preview, create on next
4. **Step 2: CreateProjectStep** — platform grid selector, name input, auto-create API key
5. **Step 3: InstallSdkStep** — dynamic code blocks with real DSN, copy-to-clipboard
6. **Step 4: WaitingForEventStep** — polling with `useFirstEvent`, celebration on success
7. **Redirect logic** — if `onboarding_completed_at` is NULL, redirect `/` to `/onboarding`
8. **Onboarding complete endpoint** — `PATCH /auth/me/onboarding-complete`
9. **Empty states** — enhance Dashboard and monitoring pages with setup CTAs
10. **Testing** — full flow test, skip flow, returning user (no re-onboard)

## Effort Estimate

| Component | Estimate |
|-----------|----------|
| Schema + backend endpoint | 0.5 day |
| Wizard container + step navigation | 1 day |
| CreateOrg + CreateProject steps | 1 day |
| InstallSdk step (3 platform templates) | 1 day |
| WaitingForEvent step + polling | 1 day |
| Redirect logic + auth integration | 0.5 day |
| Empty states (4 pages) | 1 day |
| Testing | 1 day |
| **Total** | **6–8 days** |
