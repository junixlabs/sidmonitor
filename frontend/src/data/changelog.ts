export type ChangeType = 'added' | 'changed' | 'fixed' | 'removed' | 'breaking'

export interface Change {
  type: ChangeType
  text: string
}

export interface ChangelogEntry {
  version: string
  date: string
  title: string
  changes: Change[]
}

export const changelog: ChangelogEntry[] = [
  {
    version: '0.6.0',
    date: '2026-03-14',
    title: 'Settings Hierarchy & Code Quality',
    changes: [
      { type: 'added', text: 'Organization Settings page — manage org name, members, roles, and audit log' },
      { type: 'added', text: 'User Settings page — profile editing, theme (light/dark/system), and layout density' },
      { type: 'added', text: 'Help & Docs page — quick-start guide, SDK documentation sections, and support links' },
      { type: 'changed', text: 'Settings page refactored into 3 tabs: General (project info + danger zone), SDK Setup, and API Keys' },
      { type: 'added', text: 'Project deletion with confirmation modal in General settings tab' },
      { type: 'changed', text: 'Header user menu now links to User Settings and Org Settings separately' },
      { type: 'changed', text: 'Sidebar pinned bottom section with "What\'s New" and "Help & Docs" links' },
      { type: 'added', text: 'useCopyToClipboard hook — shared clipboard logic with per-field feedback' },
      { type: 'fixed', text: 'Notification read state now persists across route navigation (module-level Set)' },
      { type: 'fixed', text: 'Stale useState on initial mount synced via useEffect in all settings pages' },
      { type: 'fixed', text: 'Project deletion uses SPA navigation instead of full page reload' },
      { type: 'fixed', text: 'Member action dropdown closes on outside click' },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-03-13',
    title: 'Multi-Project Hardening & Audit Logging',
    changes: [
      { type: 'added', text: 'Organization audit log API — tracks project/member/key operations with actor, IP, and metadata' },
      { type: 'added', text: 'Project member CRUD endpoints — add, update role, and remove members with RBAC' },
      { type: 'added', text: 'API key rotation with configurable grace period (1–720 hours)' },
      { type: 'added', text: 'API key expiration and scope validation on ingest (ingest:write, data:read, settings:read/write)' },
      { type: 'added', text: 'Last-used-at debouncing for API keys — reduces DB writes under heavy traffic' },
      { type: 'changed', text: 'All project mutations (create, delete, key create/revoke/rotate) now emit audit log entries' },
      { type: 'changed', text: 'Project lookup scoped to user\'s organizations to prevent cross-org access' },
      { type: 'fixed', text: 'Legacy API key scope "ingest" accepted alongside new "ingest:write" format' },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-03-12',
    title: 'Laravel SDK — Scheduled Tasks, Circuit Breaker & Resilience',
    changes: [
      { type: 'added', text: 'ScheduledTaskCollector — monitors task start, finish, fail, and skip with timing and memory metrics' },
      { type: 'added', text: 'ScheduledTaskLogger — async logging with slow-threshold support for scheduled tasks' },
      { type: 'added', text: 'Circuit breaker in SidMonitorExporter — stops sending after N failures, auto-recovers after cooldown' },
      { type: 'added', text: 'Buffer trimming to prevent unbounded memory growth during backend outages' },
      { type: 'added', text: 'Fallback event-based outbound monitoring for Laravel < 10.14 (HTTP client events)' },
      { type: 'added', text: 'Outbound request fields: parent_request_id, request_size, response_size, error_code, error_message' },
      { type: 'added', text: 'Prometheus scheduled_tasks_total counter metric' },
      { type: 'changed', text: 'Inbound collector uses per-request timing via spl_object_id() for concurrent request safety' },
      { type: 'changed', text: 'Outbound collector caches config in constructor, adds early-return for excluded hosts' },
      { type: 'changed', text: 'SidMonitorExporter field mapping updated: endpoint→target_url, response_time_ms→latency_ms' },
      { type: 'changed', text: 'Service provider registers shutdown hook for post-response buffer flush' },
      { type: 'fixed', text: 'Exception handler wrapped in try-catch so logging failures never suppress application exceptions' },
      { type: 'added', text: 'Laravel integration test app with Observatory status/flush endpoints and Docker support' },
      { type: 'added', text: 'Integration checklist documentation for Laravel SDK setup' },
    ],
  },
  {
    version: '0.3.1',
    date: '2026-03-10',
    title: 'URL-Driven Navigation & Adaptive Sidebar',
    changes: [
      { type: 'changed', text: 'Project context now driven by URL params (/:orgSlug/:projectSlug) instead of global state' },
      { type: 'changed', text: 'Sidebar adapts between project navigation and global navigation based on current route' },
      { type: 'added', text: 'ProjectSwitcher invalidates project-scoped React Query cache on project switch' },
      { type: 'fixed', text: 'Consistent form input styling across Projects, Jobs, and Scheduled Tasks pages' },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-03-09',
    title: 'OpenAPI Documentation & Contract Tests',
    changes: [
      { type: 'added', text: 'Complete OpenAPI documentation for all 74 backend API endpoints' },
      { type: 'added', text: 'E2E API contract tests covering all endpoints' },
      { type: 'added', text: 'Field descriptions on all remaining OpenAPI schemas' },
      { type: 'fixed', text: 'Frontend types and API client aligned with backend contracts' },
      { type: 'fixed', text: 'Enum vs string role handling and nullable numeric fields in services' },
      { type: 'fixed', text: 'DateTime64 to DateTime cast in ClickHouse TTL expressions' },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-01-20',
    title: 'Laravel SDK Exporter & Laravel 9 Support',
    changes: [
      { type: 'added', text: 'SidMonitorExporter in Laravel SDK — pushes data to backend ingest API' },
      { type: 'added', text: 'Laravel 9 support (PHP 8.0+)' },
      { type: 'added', text: 'Comprehensive README, development guide, and onboarding docs' },
      { type: 'changed', text: 'Standardized Docker setup and ClickHouse schema' },
      { type: 'changed', text: 'Cleaned up GitHub Actions workflows' },
      { type: 'fixed', text: 'Nullable fields in job ingest (memory_usage_mb, duration_ms)' },
    ],
  },
  {
    version: '0.1.0',
    date: '2025-12-25',
    title: 'Initial Release',
    changes: [
      { type: 'added', text: 'Multi-tenant backend with PostgreSQL and ClickHouse' },
      { type: 'added', text: 'React frontend with dark/light theme and full monitoring UI' },
      { type: 'added', text: 'Inbound/outbound HTTP monitoring, background jobs, and scheduled tasks' },
      { type: 'added', text: 'Real-time dashboards with Recharts visualizations' },
      { type: 'added', text: 'JWT authentication for frontend, API key authentication for SDK ingestion' },
      { type: 'added', text: 'Materialized views for pre-aggregated statistics' },
      { type: 'added', text: 'Infrastructure setup with Docker Compose, CI/CD, and ClickHouse schema' },
    ],
  },
]
