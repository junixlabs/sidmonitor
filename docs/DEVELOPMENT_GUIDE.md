# SidMonitor Development Guide

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Project Architecture](#project-architecture)
3. [Backend Development](#backend-development)
4. [Frontend Development](#frontend-development)
5. [Database Management](#database-management)
6. [Data Ingestion](#data-ingestion)
7. [Authentication & Multi-Tenancy](#authentication--multi-tenancy)
8. [Testing](#testing)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

---

## Development Environment Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Frontend build and dev server |
| Python | 3.11+ | Backend runtime |
| Docker | 20+ | Database containers |
| Docker Compose | v2+ | Container orchestration |

### Initial Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd monitoring

# 2. Install all dependencies
make install
# This runs: npm install (frontend) + pip install -r requirements.txt (backend)

# 3. Start database services
make clickhouse
# Starts PostgreSQL (5432) and ClickHouse (8123, 9000) via Docker

# 4. Configure backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with your settings (see Environment Variables below)

# 5. Run database migrations
cd backend && alembic upgrade head && cd ..

# 6. Start development servers
make dev-backend    # Terminal 1: Backend on http://localhost:8030
make dev-frontend   # Terminal 2: Frontend on http://localhost:3030
```

### Environment Variables

Create `backend/.env` from `backend/.env.example`:

```env
# Server
HOST=0.0.0.0
PORT=8030
DEBUG=true

# PostgreSQL (metadata: users, orgs, projects, API keys)
DATABASE_URL=postgresql+asyncpg://sidmonitor:password@localhost:5432/sidmonitor

# ClickHouse (analytics: logs, stats, materialized views)
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=sid_monitoring

# JWT Authentication
JWT_SECRET_KEY=your-secret-key-change-this-in-production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS
CORS_ORIGINS=http://localhost:3030

# Legacy basic auth (for backward compatibility)
AUTH_USERNAME=admin
AUTH_PASSWORD=changeme
```

### Service Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite dev) | 3030 | http://localhost:3030 |
| Backend (FastAPI) | 8030 | http://localhost:8030 |
| PostgreSQL | 5432 | localhost:5432 |
| ClickHouse HTTP | 8123 | http://localhost:8123 |
| ClickHouse TCP | 9000 | localhost:9000 |

---

## Project Architecture

### High-Level Overview

```
Client Apps (Laravel/Python SDKs)
        │
        │  POST /api/ingest (API Key auth)
        ▼
┌──────────────────────────────────┐
│         FastAPI Backend          │
│                                  │
│  ┌──────────┐  ┌──────────────┐ │
│  │  Ingest  │  │   Query API  │ │
│  │  Service  │  │  (JWT auth)  │ │
│  └────┬─────┘  └──────┬───────┘ │
│       │               │         │
│  ┌────▼─────┐  ┌──────▼───────┐ │
│  │ClickHouse│  │  PostgreSQL  │ │
│  │(Analytics)│  │  (Metadata)  │ │
│  └──────────┘  └──────────────┘ │
└──────────────┬───────────────────┘
               │
               │  REST API (JWT auth)
               ▼
┌──────────────────────────────────┐
│        React Frontend            │
│  Dashboard, Logs, Analytics      │
└──────────────────────────────────┘
```

### Two-Database Strategy

**PostgreSQL** stores relational metadata:
- User accounts and authentication
- Organizations and memberships
- Projects and API keys
- Invitations and RBAC

**ClickHouse** stores high-volume time-series analytics:
- Inbound request logs (HTTP requests received by your app)
- Outbound request logs (HTTP calls your app makes to external services)
- Job execution logs (queue workers, background jobs)
- Scheduled task logs (cron tasks)
- Materialized views for pre-aggregated hourly/daily statistics

### Request Flow

**Ingestion (SDK → ClickHouse):**
1. Client SDK sends log data to `POST /api/ingest` with `X-API-Key` header
2. Backend validates the API key against `api_keys` table in PostgreSQL
3. Backend maps the API key to a project_id
4. Backend inserts log data into the appropriate ClickHouse table

**Query (Frontend → Backend → ClickHouse):**
1. Frontend sends request with `Authorization: Bearer <jwt>` header
2. Backend verifies JWT, extracts user_id
3. Backend checks user's project access via PostgreSQL
4. Backend queries ClickHouse for the requested project's data
5. Returns paginated, filtered results to frontend

---

## Backend Development

### Directory Structure

```
backend/app/
├── api/                    # Route handlers (thin controllers)
│   ├── auth.py            # POST /auth/register, /auth/login, GET /auth/me
│   ├── ingest.py          # POST /ingest, /ingest/batch
│   ├── inbound.py         # GET /inbound, /inbound/stats, /inbound/modules
│   ├── outbound.py        # GET /outbound, /outbound/stats, /outbound/services
│   ├── jobs.py            # Job ingest + query endpoints
│   ├── jobs_query.py      # GET /jobs, /jobs/stats, /jobs/by-queue
│   ├── logs.py            # GET /logs (general)
│   ├── organizations.py   # CRUD + member management
│   ├── projects.py        # CRUD + API key management
│   ├── settings.py        # Project settings + DSN
│   ├── frontend_logs.py   # Frontend error collection
│   └── stats/             # Analytics sub-routes
│       ├── dashboard.py   # /stats/dashboard
│       ├── traffic.py     # /stats/traffic/*
│       ├── performance.py # /stats/performance/*
│       ├── errors.py      # /stats/errors/*
│       └── users.py       # /stats/users/*
├── models/                 # Data models
│   ├── database.py        # SQLAlchemy ORM (User, Organization, Project, ApiKey)
│   ├── auth.py            # Auth request/response schemas
│   ├── ingest.py          # Ingest payload schemas
│   ├── jobs.py            # Job log schemas
│   ├── organization.py    # Organization schemas
│   ├── project.py         # Project schemas
│   ├── outbound.py        # Outbound log schemas
│   └── stats.py           # Stats response schemas
├── services/               # Business logic
│   ├── clickhouse.py      # ClickHouse client, schema init, queries
│   ├── auth.py            # JWT creation/verification, password hashing
│   ├── ingest_service.py  # Log insertion into ClickHouse
│   ├── api_keys.py        # API key generation and validation
│   ├── database.py        # PostgreSQL CRUD operations
│   ├── organizations.py   # Organization business logic
│   └── projects.py        # Project business logic
├── config.py               # Pydantic Settings (env vars)
├── database.py             # SQLAlchemy async engine + session factory
├── main.py                 # FastAPI app init, CORS, router registration
├── constants.py            # Application constants
└── exceptions.py           # Custom exception classes
```

### Adding a New API Endpoint

1. **Define Pydantic schemas** in `models/`:

```python
# models/my_feature.py
from pydantic import BaseModel

class MyFeatureRequest(BaseModel):
    name: str
    value: int

class MyFeatureResponse(BaseModel):
    id: str
    name: str
    created_at: str
```

2. **Add service logic** in `services/`:

```python
# services/my_feature.py
from app.services.clickhouse import get_clickhouse_client

async def get_feature_data(project_id: str):
    client = get_clickhouse_client()
    result = client.query(
        "SELECT * FROM my_table WHERE project_id = {project_id:String}",
        parameters={"project_id": project_id}
    )
    return result.result_rows
```

3. **Create route handler** in `api/`:

```python
# api/my_feature.py
from fastapi import APIRouter, Depends
from app.services.auth import get_current_user
from app.models.my_feature import MyFeatureResponse

router = APIRouter(prefix="/my-feature", tags=["My Feature"])

@router.get("/", response_model=list[MyFeatureResponse])
async def list_features(current_user=Depends(get_current_user)):
    # Implementation
    pass
```

4. **Register the router** in `main.py`:

```python
from app.api.my_feature import router as my_feature_router
app.include_router(my_feature_router, prefix="/api")
```

### ClickHouse Query Patterns

```python
from app.services.clickhouse import get_clickhouse_client

client = get_clickhouse_client()

# Parameterized query (safe from injection)
result = client.query(
    """
    SELECT
        toStartOfHour(timestamp) as hour,
        count() as total,
        countIf(status_code >= 400) as errors
    FROM logs
    WHERE project_id = {project_id:String}
      AND timestamp >= {start:DateTime}
    GROUP BY hour
    ORDER BY hour
    """,
    parameters={
        "project_id": project_id,
        "start": start_time,
    }
)

rows = result.result_rows       # List of tuples
columns = result.column_names   # Column name list
```

### Running the Backend

```bash
cd backend

# Development (auto-reload)
python run.py
# or
uvicorn app.main:app --host 0.0.0.0 --port 8030 --reload

# API docs available at:
# http://localhost:8030/docs      (Swagger UI)
# http://localhost:8030/redoc     (ReDoc)
```

---

## Frontend Development

### Directory Structure

```
frontend/src/
├── pages/                     # Route-level components (lazy-loaded)
│   ├── GlobalDashboard.tsx   # Multi-project overview (/)
│   ├── Dashboard.tsx         # Per-project dashboard (/dashboard)
│   ├── Logs.tsx              # Log viewer (/logs)
│   ├── InboundAPIs.tsx       # Inbound monitoring (/inbound-apis)
│   ├── OutboundAPIs.tsx      # Outbound monitoring (/outbound-apis)
│   ├── Jobs.tsx              # Job monitoring (/jobs)
│   ├── ScheduledTasks.tsx    # Task monitoring (/scheduled-tasks)
│   ├── Settings.tsx          # Project settings (/settings)
│   ├── Organizations.tsx     # Org management (/organizations)
│   ├── Projects.tsx          # Project management (/projects)
│   ├── Login.tsx             # Authentication (/login)
│   └── Register.tsx          # Registration (/register)
├── components/
│   ├── ui/                   # Generic reusable components
│   │   ├── Card.tsx          # Card wrapper
│   │   ├── Table.tsx         # Data table with sorting
│   │   ├── Modal.tsx         # Headless UI Dialog wrapper
│   │   ├── DetailsModal.tsx  # Key-value detail modal
│   │   ├── Badge.tsx         # Status badges
│   │   ├── Pagination.tsx    # Page navigation
│   │   ├── FilterBar.tsx     # Filter controls
│   │   ├── EmptyState.tsx    # Empty data placeholder
│   │   ├── ErrorAlert.tsx    # Error notification banner
│   │   ├── Skeleton.tsx      # Loading skeletons
│   │   ├── ExportButton.tsx  # CSV/JSON export
│   │   ├── CopyButton.tsx    # Copy to clipboard
│   │   └── index.ts          # Barrel export
│   ├── dashboard/            # Dashboard-specific components
│   │   ├── StatsCard.tsx
│   │   ├── RequestsChart.tsx
│   │   ├── DashboardTabs.tsx
│   │   ├── ErrorAnalytics.tsx
│   │   ├── PerformanceMetrics.tsx
│   │   ├── TrafficPatterns.tsx
│   │   └── UserAnalytics.tsx
│   ├── inbound/              # Inbound monitoring
│   │   ├── InboundStatsCards.tsx
│   │   ├── InboundModuleHealth.tsx
│   │   └── ModuleEndpointDetails.tsx
│   ├── outbound/             # Outbound monitoring
│   │   ├── OutboundStatsCards.tsx
│   │   ├── OutboundServiceHealth.tsx
│   │   ├── OutboundHostHealth.tsx
│   │   └── ServiceEndpointDetails.tsx
│   ├── jobs/                 # Job monitoring
│   │   ├── JobsSummary.tsx
│   │   └── JobsDetail.tsx
│   └── layoutComponents/     # App layout
│       ├── Sidebar.tsx       # Navigation sidebar (collapsible)
│       ├── Header.tsx        # Top header (org/project, search, theme, user)
│       └── StatusBar.tsx     # Bottom status bar
├── contexts/
│   ├── AuthContext.tsx        # JWT auth, user, org/project selection
│   └── ThemeContext.tsx       # Dark/light mode, density
├── hooks/
│   ├── useLogs.ts            # Log queries + useGlobalStats
│   ├── useInboundLogs.ts     # Inbound log queries
│   ├── useOutboundLogs.ts    # Outbound log queries
│   └── useJobs.ts            # Job log queries
├── api/
│   └── client.ts             # Axios instance + all API methods
├── types/
│   └── index.ts              # All TypeScript interfaces
├── utils/
│   ├── format.ts             # formatNumber, formatResponseTime, formatDate, etc.
│   ├── styleHelpers.ts       # getStatusColor, getMethodColor, etc.
│   ├── constants.ts          # CACHE_CONFIG, PAGE_SIZE, etc.
│   ├── errorLogger.ts        # Frontend error logging utility
│   └── exportHelpers.ts      # CSV/JSON export helpers
├── lib/
│   └── utils.ts              # cn() - clsx + tailwind-merge
├── App.tsx                    # Routes, lazy loading, Suspense
├── index.css                  # CSS custom properties (theme variables)
└── main.tsx                   # React entry point
```

### Key Conventions

**Code splitting:** All page components are lazy-loaded via `React.lazy()` with a shared `PageLoader` fallback.

**Data fetching:** Use React Query hooks from `hooks/`. Each hook returns `{ data, isLoading, error }`.

```tsx
// Example: Using a data hook
import { useInboundStats } from '@/hooks/useInboundLogs'

function MyComponent() {
  const { data: stats, isLoading, error } = useInboundStats()
  if (isLoading) return <Skeleton />
  if (error) return <ErrorAlert message="Failed to load" />
  return <div>{stats.total_requests}</div>
}
```

**Cache configuration presets** in `utils/constants.ts`:

```typescript
CACHE_CONFIG = {
  standard:  { staleTime: 30s,  gcTime: 5min  },  // Normal data
  analytics: { staleTime: 2min, gcTime: 10min },   // Stats/charts
  stable:    { staleTime: 5min, gcTime: 30min },    // Rarely changing data
}
```

**Shared utilities:**
- `utils/format.ts` — `formatNumber()`, `formatResponseTime()`, `formatDate()`, `formatCount()`, `formatLatency()`, `formatBytes()`, `formatDuration()`, `formatPercentage()`
- `utils/styleHelpers.ts` — `getStatusColor()`, `getMethodColor()`, `getMethodBadgeColor()`, `getSuccessRateBadgeColor()`, `getHealthChartColor()`

**UI components:** Always use components from `components/ui/` for consistency:
- `<Modal>` for dialogs (wraps Headless UI Dialog)
- `<DetailsModal>` for key-value detail views
- `<EmptyState>` for empty data states
- `<ErrorAlert>` for error banners
- `<Pagination>`, `<FilterBar>`, `<ExportButton>`, etc.

### Theme System

CSS custom properties defined in `index.css` with light (`:root`) and dark (`.dark`) variants:

```css
:root {
  --bg-primary: #FFFFFF;
  --text-primary: #111827;
  --accent-primary: #4F46E5;
  --status-success: #10B981;
  /* ... */
}

.dark {
  --bg-primary: #0F172A;
  --text-primary: #F8FAFC;
  --accent-primary: #818CF8;
  --status-success: #34D399;
  /* ... */
}
```

Tailwind maps these to semantic classes in `tailwind.config.js`:

```
bg-surface        → var(--bg-primary)
text-text-primary → var(--text-primary)
bg-accent         → var(--accent-primary)
text-status-success → var(--status-success)
border-border-primary → var(--border-primary)
```

Toggle dark/light via `ThemeContext`:

```tsx
const { resolvedTheme, toggleTheme } = useTheme()
```

### Adding a New Page

1. Create page component in `pages/`:

```tsx
// pages/MyPage.tsx
export default function MyPage() {
  return <div><h1>My Page</h1></div>
}
```

2. Add lazy import in `App.tsx`:

```tsx
const MyPage = lazy(() => import('./pages/MyPage'))
```

3. Add route:

```tsx
<Route path="/my-page" element={
  <Suspense fallback={<PageLoader />}>
    <MyPage />
  </Suspense>
} />
```

4. Add sidebar link in `components/layoutComponents/Sidebar.tsx`.

### Running the Frontend

```bash
cd frontend

npm run dev      # Development server (port 3030)
npm run build    # Production build
npm run lint     # ESLint check
npm run preview  # Preview production build
```

Vite dev server proxies `/api` requests to `http://localhost:8030` (configured in `vite.config.ts`).

---

## Database Management

### PostgreSQL Migrations (Alembic)

```bash
cd backend

# Create a new migration
alembic revision --autogenerate -m "Add new_column to users"

# Apply all pending migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# Show current migration status
alembic current

# Show migration history
alembic history
```

Migration files are in `backend/alembic/versions/`.

### ClickHouse Schema

ClickHouse tables are initialized via SQL scripts in `clickhouse/init/`:

| Script | Tables |
|--------|--------|
| `01_create_database.sql` | `logs`, `stats_hourly` + materialized view |
| `02_create_job_tables.sql` | `job_logs`, `scheduled_task_logs` + stats views |
| `03_create_outbound_tables.sql` | `outbound_logs` + stats views |

These run automatically when ClickHouse container starts. For manual execution:

```bash
# Connect to ClickHouse
docker exec -it monitoring-clickhouse-1 clickhouse-client

# Run a script manually
cat clickhouse/init/01_create_database.sql | \
  docker exec -i monitoring-clickhouse-1 clickhouse-client --multiquery
```

### Key ClickHouse Design Decisions

- **Partitioning:** All tables partitioned by `toYYYYMM(timestamp)` for efficient time-range queries
- **TTL:** 90-day retention on all log tables (`TTL timestamp + INTERVAL 90 DAY`)
- **Materialized Views:** Pre-aggregate stats hourly/daily for dashboard performance
- **MergeTree Engine:** Default engine for all tables, efficient for time-series workloads

### Seed Data

```bash
cd database
python seed_data.py
```

Generates sample log data in ClickHouse for development/testing.

---

## Data Ingestion

### Ingest Endpoint

`POST /api/ingest` — Single log entry

```bash
curl -X POST http://localhost:8030/api/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "request_id": "req-123",
    "timestamp": "2024-01-15T10:30:00Z",
    "endpoint": "/api/users",
    "method": "GET",
    "status_code": 200,
    "response_time_ms": 45,
    "module": "users",
    "user_id": "user-456"
  }'
```

### Batch Ingest

`POST /api/ingest/batch` — Multiple log entries

```bash
curl -X POST http://localhost:8030/api/ingest/batch \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "logs": [
      { "endpoint": "/api/users", "method": "GET", "status_code": 200, ... },
      { "endpoint": "/api/orders", "method": "POST", "status_code": 201, ... }
    ]
  }'
```

### Job Ingest

`POST /api/v1/ingest/job` — Single job log

```bash
curl -X POST http://localhost:8030/api/v1/ingest/job \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "job_class": "App\\Jobs\\SendEmail",
    "queue_name": "default",
    "status": "completed",
    "started_at": "2024-01-15T10:30:00Z",
    "completed_at": "2024-01-15T10:30:02Z",
    "duration_ms": 2000,
    "attempt_number": 1
  }'
```

### Scheduled Task Ingest

`POST /api/v1/ingest/task` — Single scheduled task log

```bash
curl -X POST http://localhost:8030/api/v1/ingest/task \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "command": "emails:send-daily-digest",
    "expression": "0 8 * * *",
    "status": "completed",
    "scheduled_at": "2024-01-15T08:00:00Z",
    "started_at": "2024-01-15T08:00:01Z",
    "completed_at": "2024-01-15T08:00:05Z",
    "duration_ms": 4000,
    "exit_code": 0
  }'
```

### Authentication

Ingest endpoints use API key authentication via the `X-API-Key` header. API keys are created per-project in the Settings page or via:

```bash
curl -X POST http://localhost:8030/api/projects/{project_id}/api-keys \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Production Key"}'
```

---

## Authentication & Multi-Tenancy

### Auth Flow

1. **Register:** `POST /api/auth/register` — Creates user, returns JWT
2. **Login:** `POST /api/auth/login` — Validates credentials, returns JWT
3. **Authenticated requests:** Include `Authorization: Bearer <jwt>` header

### Multi-Tenancy Hierarchy

```
User
 └── Organization (owner / admin / member)
      └── Project (has API keys, DSN)
           └── Logs (scoped by project_id in ClickHouse)
```

- Users can belong to multiple organizations
- Organizations can have multiple projects
- Each project has its own API keys and DSN
- All log queries are scoped to the currently selected project

### Frontend Auth Context

```tsx
const { user, currentOrg, currentProject, projects, setCurrentProject, logout } = useAuth()
```

The `AuthContext` manages:
- JWT token storage (localStorage)
- Current user profile
- Organization and project selection
- Auto-redirect on 401 responses

---

## Testing

### Backend

```bash
cd backend

# Run tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test file
pytest tests/test_auth.py
```

### Frontend

```bash
cd frontend

# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Build (catches compile errors)
npm run build
```

### Manual API Testing

```bash
# Register
curl -X POST http://localhost:8030/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@test.com","password":"test1234","name":"Dev User"}'

# Login
curl -X POST http://localhost:8030/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@test.com","password":"test1234"}'
# Returns: {"access_token": "eyJ...", "token_type": "bearer"}

# Use the token for authenticated requests
export TOKEN="eyJ..."

# Get user profile
curl http://localhost:8030/api/auth/me -H "Authorization: Bearer $TOKEN"

# List organizations
curl http://localhost:8030/api/organizations -H "Authorization: Bearer $TOKEN"

# List projects
curl http://localhost:8030/api/projects -H "Authorization: Bearer $TOKEN"
```

---

## Deployment

### Docker Production Build

```bash
# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f

# Stop services
docker compose down
```

Production `docker-compose.yml` includes:
- `postgres` — PostgreSQL 15 (port 5432)
- `clickhouse` — ClickHouse 23.8 (ports 8123, 9000)
- `backend` — FastAPI (port 8000)
- `frontend` — React SPA served by Nginx (port 3000)

### CI/CD Pipeline

**ci.yml** (on push/PR):
1. Frontend: `npm install` → `npm run lint` → `tsc --noEmit` → `npm run build`
2. Backend: `pip install` → `ruff check` → `mypy`
3. Docker: Build images (no push, build cache only)

**deploy.yml** (on push to `main` or `v*` tags):
1. Build Docker images for frontend and backend
2. Push to `ghcr.io` with tags: branch name, semver, git SHA

### Production Environment Checklist

- [ ] Set a strong `JWT_SECRET_KEY` (random 64+ chars)
- [ ] Set `DEBUG=false`
- [ ] Configure `CORS_ORIGINS` to your frontend domain
- [ ] Use a proper `DATABASE_URL` with connection pooling
- [ ] Set up ClickHouse with adequate disk space (90-day retention)
- [ ] Configure HTTPS (TLS termination at reverse proxy)
- [ ] Set up database backups (PostgreSQL)
- [ ] Monitor ClickHouse disk usage and partition health

---

## Troubleshooting

### Common Issues

**Backend won't start — "Connection refused" to PostgreSQL/ClickHouse**
- Ensure databases are running: `docker compose -f docker-compose.dev.yml ps`
- Check ports: `lsof -i :5432` and `lsof -i :8123`

**Frontend shows "Loading..." indefinitely**
- Check browser console for errors
- Verify backend is running at http://localhost:8030/health
- Check Vite proxy config in `frontend/vite.config.ts`

**"401 Unauthorized" on all API calls**
- JWT token may be expired (default 30min). Re-login.
- Check `Authorization` header is being sent (browser DevTools → Network)

**ClickHouse queries return empty results**
- Verify data exists: `SELECT count() FROM logs WHERE project_id = 'your-project-id'`
- Check project_id matches between ingested data and frontend context
- Verify time range filter isn't excluding all data

**Alembic migration fails**
- Check `DATABASE_URL` in `backend/.env`
- Ensure PostgreSQL is running and accessible
- Run `alembic current` to see migration state
- For conflicts: `alembic stamp head` (use with caution)

**Theme toggle not working**
- Verify `ThemeProvider` wraps the app in `App.tsx`
- Check browser localStorage for `sidmonitor-theme-mode`
- Verify `index.css` has both `:root` (light) and `.dark` variable blocks

### Useful Commands

```bash
# Check ClickHouse data
docker exec -it monitoring-clickhouse-1 clickhouse-client \
  -q "SELECT count() FROM sid_monitoring.logs"

# Check PostgreSQL
docker exec -it monitoring-postgres-1 psql -U sidmonitor -d sidmonitor \
  -c "SELECT count(*) FROM users"

# Backend logs
cd backend && python run.py 2>&1 | tail -f

# Frontend build check
cd frontend && npm run build

# Full system health check
curl http://localhost:8030/health
```
