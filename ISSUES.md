# SidMonitor - E2E Review & Issues Report

> Full end-to-end review of https://monitor.thejunix.com (deployed 2026-03-27)
> Covers: browser testing, backend code review, frontend code review

---

## CRITICAL BUGS (Fix Immediately)

### CB-01: `/api/settings/dsn` returns 500 - PermissionError
- **Source**: E2E test, backend logs
- **Error**: `PermissionError: [Errno 13] Permission denied: '/app/data'`
- **Impact**: SDK Setup tab shows blank DSN Format and Example DSN fields
- **Root cause**: Backend tries to create `/app/data` directory but Dockerfile runs as `appuser` who has no write permission to `/app`
- **File**: `backend/app/api/settings.py`
- **Fix**: Create `/app/data` in Dockerfile with correct permissions, or use `/tmp` for ephemeral data

### CB-02: `/api/v1/frontend-logs` returns 500 - PermissionError
- **Source**: E2E test, backend logs
- **Error**: Same `PermissionError` as CB-01 - tries to write to `/app/data`
- **Impact**: Frontend error logging silently fails; console shows 500 errors on every page
- **File**: `backend/app/api/frontend_logs.py`

### CB-03: Global Dashboard shows "No projects yet" despite existing projects
- **Source**: E2E test (screenshot: `23-overview-global.png`)
- **Impact**: Users see empty global dashboard even with active projects/orgs
- **File**: `frontend/src/pages/GlobalDashboard.tsx`

### CB-04: Mobile layout completely broken - sidebar overlaps content
- **Source**: E2E test (screenshot: `24-mobile-dashboard.png`)
- **Impact**: App unusable on mobile devices. Sidebar stays open and covers main content
- **File**: `frontend/src/components/Layout.tsx`
- **Fix**: Add responsive breakpoint to collapse sidebar on mobile, add hamburger menu

### CB-05: SQLAlchemy `metadata` reserved attribute (FIXED in deploy)
- **Source**: Backend startup crash
- **Status**: Fixed during deployment (`e717003`)
- **File**: `backend/app/models/database.py:210`

---

## HIGH PRIORITY BUGS

### HB-01: Race condition on email uniqueness during registration
- **File**: `backend/app/api/auth.py:110-117`
- **Impact**: Two simultaneous registrations with same email can create duplicate users
- **Fix**: Add unique constraint on `users.email` column in DB migration

### HB-02: Hardcoded default JWT secret key
- **File**: `backend/app/config.py:23`
- **Value**: `"your-secret-key-change-this-in-production"`
- **Impact**: If env var not set, tokens are signed with known secret - full auth bypass
- **Fix**: Raise error on startup if JWT_SECRET_KEY matches default in non-debug mode

### HB-03: Hardcoded default credentials for Basic Auth
- **File**: `backend/app/config.py:28-29`
- **Values**: `admin` / `changeme`
- **Impact**: Legacy basic auth allows access with known credentials
- **Fix**: Remove basic auth entirely or require env var override

### HB-04: No token blacklisting on logout
- **File**: `backend/app/api/auth.py:203-212`
- **Impact**: Logout is a no-op; old tokens remain valid until expiry
- **Fix**: Implement Redis/DB-based token blacklist, or short-lived tokens + refresh

### HB-05: Exception details exposed to clients in ingest/outbound endpoints
- **Files**: `backend/app/api/ingest.py:99-206`, `backend/app/api/outbound.py:102-176`
- **Impact**: Internal error messages leak DB schema, paths, and stack traces to callers
- **Fix**: Return generic error message; log details server-side only

### HB-06: No timeout on ClickHouse client
- **File**: `backend/app/services/clickhouse.py:8-18`
- **Impact**: If ClickHouse hangs, all requests hang indefinitely. Cascading failure risk
- **Fix**: Add `connect_timeout=10, send_receive_timeout=30` to client config

### HB-07: No global error boundary in React
- **Source**: Frontend code review
- **Impact**: Any unhandled JS error crashes the entire app with white screen
- **Fix**: Add `ErrorBoundary` wrapper around `<App />` with fallback UI

### HB-08: Auth 401 redirect clears token mid-flight
- **File**: `frontend/src/api/client.ts:98-102`
- **Impact**: If token expires during multiple parallel requests, all fail and app redirects without waiting for in-flight responses
- **Fix**: Queue 401 responses, attempt refresh once, retry failed requests

---

## CONTENT & DATA BUGS

### DB-01: Docs page has wrong GitHub URLs
- **File**: `frontend/src/pages/Docs.tsx`
- **URLs**: Points to `https://github.com/nicepkg/sidmonitor` instead of `https://github.com/junixlabs/sidmonitor`
- **Impact**: "GitHub Repository" and "Report an Issue" links lead to wrong repo

### DB-02: Docs page has hardcoded endpoint URL
- **File**: `frontend/src/pages/Docs.tsx`
- **Value**: `SIDMONITOR_ENDPOINT=https://api.sidmonitor.com`
- **Impact**: Users copy wrong endpoint URL during setup
- **Fix**: Should show dynamic value based on current deployment or generic placeholder

### DB-03: SDK Setup page shows `http://your-sidmonitor-host:8000` as endpoint
- **File**: `frontend/src/pages/Settings.tsx` (SDK Setup tab)
- **Impact**: Should dynamically show actual backend URL for the deployment

### DB-04: Audit log IP shows Docker internal IP `172.26.0.5`
- **Source**: E2E test (screenshot: `22-audit-log.png`)
- **Impact**: Shows container network IP instead of actual client IP
- **Fix**: Backend needs to read `X-Forwarded-For` / `X-Real-IP` header from nginx proxy

---

## SECURITY ISSUES

### SEC-01: Overly permissive CORS (`allow_methods=["*"]`, `allow_headers=["*"]`)
- **File**: `backend/app/main.py:52-58`
- **Fix**: Explicitly list allowed methods `["GET", "POST", "PUT", "PATCH", "DELETE"]`

### SEC-02: Three incompatible auth systems mixed in one function
- **File**: `backend/app/api/auth.py:30-80`
- **Systems**: JWT Bearer + HTTP Basic + X-API-Key all tried in sequence
- **Fix**: Deprecate Basic auth, separate API key auth to ingest-only dependency

### SEC-03: Legacy SQLite API key storage alongside PostgreSQL
- **File**: `backend/app/services/api_keys.py` (entire file ~253 lines)
- **Impact**: Dual key storage creates confusion and potential security gaps
- **Fix**: Migrate to PostgreSQL-only, remove SQLite system

### SEC-04: Weak password requirements (8 chars minimum, no complexity)
- **File**: `backend/app/models/auth.py:14`
- **Fix**: Add uppercase, number, special char requirements

### SEC-05: `datetime.utcnow()` deprecated (11 occurrences)
- **Files**: `auth.py:62,64`, `ingest.py:46`, `projects.py:339`, `frontend_logs.py:29`, `database.py` (6 instances)
- **Impact**: Will break on Python 3.12+; timezone-aware comparisons may be incorrect
- **Fix**: Replace with `datetime.now(timezone.utc)`

### SEC-06: Thread-unsafe API key debouncing cache
- **File**: `backend/app/services/projects.py:22-24`
- **Impact**: Global dict without locking; race condition under concurrent requests
- **Fix**: Use `asyncio.Lock` or `cachetools.TTLCache`

### SEC-07: Open registration - anyone can create account
- **Source**: E2E test - register page has no restrictions
- **Impact**: Public instance allows unlimited account creation
- **Fix**: Add invite-only mode, email domain restriction, or rate limiting

---

## UX / UI ISSUES

### UX-01: No mobile responsive layout
- **Source**: E2E test (screenshot: `24-mobile-dashboard.png`)
- **Impact**: Sidebar never collapses, overlaps content on mobile
- **Priority**: High - app unusable on phones/tablets

### UX-02: Password field shows as plain text input
- **Source**: E2E test - login/register pages use `textbox` not `password` type
- **Impact**: Password visible while typing
- **Fix**: Use `type="password"` on password inputs

### UX-03: No loading skeleton for lazy-loaded pages
- **Source**: E2E test - shows "Loading..." text
- **Impact**: Generic loading text looks unpolished
- **Fix**: Add page-level skeleton components

### UX-04: Filter inputs trigger API on every keystroke
- **File**: `frontend/src/pages/InboundAPIs.tsx:99-101`
- **Impact**: Rapid API calls on typing in endpoint/request ID filter
- **Fix**: Add debounce (300ms) on text input filters

### UX-05: Export button disabled with no explanation
- **Source**: E2E test - Inbound Logs tab
- **Impact**: User doesn't know why export is disabled (no data? missing permission?)
- **Fix**: Add tooltip explaining why disabled

### UX-06: Dashboard error alert not persistent across refresh
- **File**: `frontend/src/pages/Dashboard.tsx:94-117`
- **Impact**: Dismissed alerts reappear on page refresh

### UX-07: No breadcrumb navigation for nested routes
- **Impact**: Users can't easily track location in org > project > settings hierarchy

### UX-08: No scroll-to-top on page navigation
- **Impact**: Navigating to new page keeps scroll position from previous page

### UX-09: Outbound APIs filter grid misaligned
- **File**: `frontend/src/pages/OutboundAPIs.tsx:304`
- **Impact**: Reset button `lg:col-span-2` in 7-column grid creates uneven spacing

### UX-10: Empty state doesn't distinguish "no data" from "no results"
- **File**: `frontend/src/pages/GlobalDashboard.tsx:358-360`
- **Impact**: Same message for "no projects created" and "search found nothing"

---

## PERFORMANCE ISSUES

### PERF-01: N+1 queries in member update endpoints
- **Files**: `backend/app/api/projects.py:690-692`, `backend/app/api/organizations.py:320-324`
- **Fix**: Use eager loading / joined query

### PERF-02: O(n^2) scheduled tasks summary computation
- **File**: `frontend/src/pages/ScheduledTasks.tsx:88-106`
- **Impact**: `find()` on tasks array for each command. Slow with 100+ tasks
- **Fix**: Build index map `{command -> task}`

### PERF-03: Query key cache misses due to unstable object references
- **Files**: `frontend/src/hooks/useLogs.ts:14`, `useInboundLogs.ts:14`, `useOutboundLogs.ts:14`
- **Impact**: Query cache never hits because params object reference changes on every render
- **Fix**: Serialize params to stable key or use query key factory

### PERF-04: No request debouncing on filter text inputs
- **File**: `frontend/src/pages/InboundAPIs.tsx:99-101`
- **Impact**: API call on every keystroke in filter fields

### PERF-05: Cron parsing not memoized
- **File**: `frontend/src/pages/ScheduledTasks.tsx:50-70`
- **Impact**: `cronstrue.toString()` and `cronParser.parseExpression()` called on every render for every row

---

## ACCESSIBILITY ISSUES

### A11Y-01: Form inputs use placeholder-only labels (no `<label>` elements)
- **Impact**: Fails WCAG 1.3.1 - screen readers can't identify form fields
- **Affected**: Login, Register, filter panels, settings pages

### A11Y-02: Status badges use color-only indication
- **Files**: `ScheduledTasks.tsx:266`, `LogTable.tsx:172`, `InboundAPIs.tsx:394`
- **Impact**: Colorblind users can't distinguish status. Fails WCAG 1.4.1
- **Fix**: Add text label, icon, or pattern alongside color

### A11Y-03: No skip-to-content link
- **File**: `frontend/src/components/Layout.tsx`
- **Impact**: Screen reader users must tab through entire sidebar to reach main content

### A11Y-04: Table headers missing `scope="col"`
- **File**: `frontend/src/components/logs/LogTable.tsx:134-155`
- **Impact**: Screen readers can't correlate cells to column headers

### A11Y-05: Modal dialog not semantically linked to title
- **File**: `frontend/src/components/ui/Modal.tsx:35-46`
- **Fix**: Add `aria-labelledby` pointing to dialog title element

### A11Y-06: Pagination buttons missing aria-labels
- **File**: `frontend/src/components/ui/Pagination.tsx:59-75`
- **Impact**: Screen readers announce as generic buttons

---

## CODE QUALITY / TECH DEBT

### CQ-01: Duplicate API key response models
- **Files**: `backend/app/api/settings.py:33-54` vs `backend/app/models/project.py:59-89`
- **Impact**: Inconsistent types (`str` vs `UUID`); maintenance burden

### CQ-02: Duplicate utility functions across frontend
- **Functions**: `formatResponseTime()`, `getStatusColor()`, `getMethodColor()` defined in multiple files
- **Fix**: Centralize in `utils/format.ts` and `utils/styleHelpers.ts`

### CQ-03: Magic strings for API scopes
- **File**: `backend/app/api/ingest.py:76-78`
- **Fix**: Define scopes as Python `Enum`

### CQ-04: Overly broad exception handling throughout backend
- **Files**: `api/logs.py:111`, `api/inbound.py:73`, multiple others
- **Impact**: Masks real bugs; makes debugging harder

### CQ-05: Query endpoints don't enforce API key scopes
- **Files**: `api/logs.py:29`, `api/inbound.py:38`, `api/outbound.py:197`
- **Impact**: Scope system (`data:read`, `settings:read`) is defined but not enforced on read endpoints

### CQ-06: Email verification field exists but never used
- **File**: `backend/app/models/database.py:27`
- **Field**: `email_verified` always `False`

### CQ-07: Inconsistent error handling in frontend
- **Files**: `Login.tsx`, `Register.tsx`, `Settings.tsx`
- **Impact**: Different error formats for same error types

### CQ-08: Inline CSS variables instead of Tailwind classes
- **File**: `frontend/src/components/layoutComponents/ProjectSwitcher.tsx:93-129`
- **Impact**: Not validated at build time; hard to theme

---

## ENHANCEMENT IDEAS

### ENH-01: Real-time updates via WebSocket
- Push log entries and stats updates instead of polling
- Reduce API load and improve dashboard responsiveness

### ENH-02: Token refresh flow
- Implement refresh tokens to avoid forcing re-login on JWT expiry
- Better UX for long sessions

### ENH-03: Invite-only registration mode
- Admin toggle to disable public registration
- Email invitation system for team onboarding

### ENH-04: Data export improvements
- Streaming CSV/JSON export for large datasets
- Date range selection for export
- Background export jobs for very large datasets

### ENH-05: Request/response body viewer in log detail
- Show full request/response payloads in expandable panels
- Syntax highlighting for JSON bodies

### ENH-06: Alert rules & notifications
- Configurable thresholds (error rate > 5%, p95 > 2s)
- Email/Slack/webhook notifications
- Alert history and acknowledgment

### ENH-07: Multi-language (i18n) support
- Framework for internationalization
- Start with English + Vietnamese

### ENH-08: API key management improvements
- Copy full key on creation (only shown once)
- Key usage analytics (requests per day)
- Key-level rate limiting

### ENH-09: Log search with full-text query
- ClickHouse full-text index on request/response bodies
- Search across all log fields with query syntax

### ENH-10: Dashboard customization
- Configurable widgets / metric cards
- Custom time ranges beyond presets
- Saved dashboard layouts per user

### ENH-11: Deployment health monitoring
- Track deploy events from CI/CD
- Correlate error spikes with deployments
- Before/after deploy comparison

### ENH-12: Python SDK support
- Complete Python SDK for Django/FastAPI/Flask
- Feature parity with Laravel Observatory

### ENH-13: Print stylesheet
- Hide sidebar/header/footer when printing
- Optimize tables and charts for paper

### ENH-14: Offline detection
- Show banner when network is unavailable
- Queue actions for retry when connection returns

### ENH-15: Session timeout warning
- Warn user 5 minutes before JWT expiry
- Option to extend session

---

## SUMMARY

| Category | Count | Critical | High | Medium | Low |
|----------|-------|----------|------|--------|-----|
| **Critical Bugs** | 5 | 5 | - | - | - |
| **High Priority Bugs** | 8 | - | 8 | - | - |
| **Content/Data Bugs** | 4 | - | 2 | 2 | - |
| **Security Issues** | 7 | 2 | 3 | 2 | - |
| **UX/UI Issues** | 10 | 1 | 2 | 5 | 2 |
| **Performance Issues** | 5 | - | 1 | 3 | 1 |
| **Accessibility Issues** | 6 | - | 2 | 4 | - |
| **Code Quality** | 8 | - | - | 5 | 3 |
| **Enhancement Ideas** | 15 | - | - | - | - |
| **TOTAL** | **68** | **8** | **18** | **21** | **6** |

### Top 5 Priorities
1. **CB-01/02**: Fix `/app/data` PermissionError (DSN + frontend-logs endpoints broken)
2. **CB-04**: Mobile responsive layout (app unusable on mobile)
3. **HB-02/03**: Remove hardcoded credentials and JWT secret defaults
4. **CB-03**: Fix Global Dashboard not showing existing projects
5. **DB-01/02**: Fix wrong GitHub URLs and hardcoded endpoints in Docs page
