# SidMonitor

Application Performance Monitoring (APM) platform for Laravel and Python applications. Track inbound/outbound API requests, background jobs, scheduled tasks, and application health in real-time.

## Features

- **Inbound API Monitoring** — Track all incoming HTTP requests with response times, status codes, and error rates by module/endpoint
- **Outbound API Monitoring** — Monitor external API calls with latency, success rates, and service-level health breakdowns
- **Background Job Tracking** — Monitor queue jobs with execution times, failure rates, retry counts, and exception details
- **Scheduled Task Monitoring** — Track cron job executions with schedule adherence, duration, and failure detection
- **Multi-Tenant Architecture** — Organizations, projects, and role-based access control with API key authentication
- **Real-Time Dashboard** — Global overview across all projects, per-project dashboards with charts and analytics
- **Advanced Analytics** — Error breakdowns, performance percentiles (P50/P95/P99), traffic patterns, and user activity
- **Dark/Light Theme** — Full theme support with CSS custom properties and system preference detection
- **Data Export** — Export logs and analytics as CSV or JSON

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, Recharts, React Query |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| Analytics DB | ClickHouse 23.8 (logs, metrics, materialized views) |
| Metadata DB | PostgreSQL 15 (users, orgs, projects, API keys) |
| Auth | JWT (python-jose) + bcrypt password hashing |
| Client SDKs | Laravel (PHP), Python |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Laravel App    │────▶│  FastAPI Backend │────▶│  ClickHouse  │
│  (SDK)          │     │  :8030           │     │  (Analytics) │
└─────────────────┘     │                  │     └──────────────┘
                        │                  │
┌─────────────────┐     │                  │     ┌──────────────┐
│  Python App     │────▶│  /api/ingest     │────▶│  PostgreSQL  │
│  (SDK)          │     │  /api/ingest/job │     │  (Metadata)  │
└─────────────────┘     │  /api/ingest/task│     └──────────────┘
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │  React Frontend  │
                        │  :3030           │
                        └──────────────────┘
```

**Data Flow:**
1. Client SDKs send logs to the Ingest API (`/api/ingest`) with an API key
2. Backend validates the key and writes raw logs to ClickHouse
3. ClickHouse materialized views auto-aggregate hourly/daily statistics
4. Frontend queries stats and log endpoints, scoped to the current project

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker & Docker Compose (for ClickHouse and PostgreSQL)

### 1. Clone and Install

```bash
git clone <repository-url>
cd monitoring
make install
```

### 2. Start Databases

```bash
make clickhouse
```

Starts PostgreSQL and ClickHouse via Docker Compose. ClickHouse init scripts in `clickhouse/init/` run automatically.

### 3. Configure Environment

```bash
cp backend/.env.example backend/.env
```

Required settings in `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://sidmonitor:password@localhost:5432/sidmonitor
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=sid_monitoring
JWT_SECRET_KEY=your-secret-key-change-this-in-production
CORS_ORIGINS=http://localhost:3030
PORT=8030
```

### 4. Run Database Migrations

```bash
cd backend
alembic upgrade head
```

### 5. Start Development Servers

```bash
# Terminal 1 — Backend (http://localhost:8030)
make dev-backend

# Terminal 2 — Frontend (http://localhost:3030)
make dev-frontend
```

### 6. Create Account

1. Open http://localhost:3030/register
2. Create your account
3. Create an organization and project
4. Copy the API key from Settings
5. Install a client SDK in your application

## Client SDK Integration

### Laravel

```bash
composer require sid-stack/monitoring-laravel
php artisan vendor:publish --tag=sid-monitoring-config
```

Add to your `.env`:

```env
SID_MONITORING_ENABLED=true
SID_MONITORING_DSN=https://your-api-key@your-host/api/ingest
SID_MONITORING_TRANSPORT=queue
```

The package automatically monitors inbound HTTP requests. For outbound monitoring, add the Guzzle middleware to your HTTP clients.

### Python

```bash
pip install py-observatory
```

See `packages/python/` for configuration details.

## Project Structure

```
monitoring/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/               # Route handlers
│   │   │   ├── auth.py        # Authentication (register, login, profile)
│   │   │   ├── ingest.py      # Log ingestion from SDKs
│   │   │   ├── inbound.py     # Inbound API queries & stats
│   │   │   ├── outbound.py    # Outbound API queries & stats
│   │   │   ├── jobs.py        # Job monitoring endpoints
│   │   │   ├── logs.py        # General log queries
│   │   │   ├── organizations.py
│   │   │   ├── projects.py
│   │   │   ├── settings.py
│   │   │   └── stats/         # Dashboard, traffic, performance, errors, users
│   │   ├── models/            # Pydantic schemas & SQLAlchemy ORM
│   │   ├── services/          # Business logic (ClickHouse, auth, ingest)
│   │   ├── config.py          # Environment configuration
│   │   ├── database.py        # SQLAlchemy async engine
│   │   └── main.py            # FastAPI app & router setup
│   ├── alembic/               # PostgreSQL migrations
│   └── requirements.txt
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── pages/             # 12 route-level page components
│   │   ├── components/        # UI, dashboard, inbound, outbound, jobs
│   │   ├── contexts/          # AuthContext, ThemeContext
│   │   ├── hooks/             # useLogs, useJobs, useInboundLogs, useOutboundLogs
│   │   ├── api/client.ts      # Axios API client
│   │   ├── types/index.ts     # TypeScript interfaces
│   │   └── utils/             # Formatting, styling, export helpers
│   ├── tailwind.config.js
│   └── vite.config.ts
├── clickhouse/init/            # ClickHouse schema (3 init scripts)
├── packages/                   # Client SDKs
│   ├── laravel/               # Laravel monitoring package
│   └── python/                # Python monitoring package
├── docker-compose.yml          # Production setup
├── docker-compose.dev.yml      # Development databases
├── Makefile                    # Development commands
└── .github/workflows/          # CI/CD pipelines
```

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login (returns JWT) |
| GET | `/api/auth/me` | Get current user profile |
| PUT | `/api/auth/me` | Update profile |

### Data Ingestion (API Key via `X-API-Key` header)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ingest` | Single log entry (inbound/outbound) |
| POST | `/api/ingest/batch` | Batch log ingestion |
| POST | `/api/v1/ingest/job` | Single job log |
| POST | `/api/v1/ingest/jobs/batch` | Batch job logs |
| POST | `/api/v1/ingest/task` | Single scheduled task log |
| POST | `/api/v1/ingest/tasks/batch` | Batch task logs |

### Monitoring Queries (JWT via `Authorization: Bearer` header)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/logs` | General log query with filters |
| GET | `/api/inbound` | Inbound API logs |
| GET | `/api/inbound/stats` | Inbound stats |
| GET | `/api/inbound/modules` | Module health breakdown |
| GET | `/api/inbound/modules/{module}/endpoints` | Endpoints within a module |
| GET | `/api/outbound` | Outbound API logs |
| GET | `/api/outbound/stats` | Outbound stats |
| GET | `/api/outbound/services` | Service health breakdown |
| GET | `/api/outbound/services/{service}/endpoints` | Service endpoints |
| GET | `/api/v1/jobs` | Job logs |
| GET | `/api/v1/jobs/stats` | Job statistics |
| GET | `/api/v1/scheduled-tasks` | Scheduled task logs |
| GET | `/api/v1/scheduled-tasks/stats` | Task statistics |

### Analytics (JWT Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats/dashboard` | Overview stats |
| GET | `/api/stats/dashboard/requests-timeline` | Request time series |
| GET | `/api/stats/traffic/by-method` | Traffic by HTTP method |
| GET | `/api/stats/traffic/peak-hours` | Peak request hours |
| GET | `/api/stats/performance/percentiles` | P50/P95/P99 latencies |
| GET | `/api/stats/performance/slow-endpoints` | Slowest endpoints |
| GET | `/api/stats/errors/breakdown` | Error distribution (4xx/5xx) |
| GET | `/api/stats/errors/by-endpoint` | Errors per endpoint |
| GET | `/api/stats/users/top` | Most active users |

### Multi-Tenancy (JWT Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/organizations` | List/create organizations |
| GET/POST | `/api/{org_slug}/projects` | List/create projects |
| GET | `/api/projects/{id}/api-keys` | List API keys |
| POST | `/api/projects/{id}/api-keys` | Create API key |
| GET | `/api/projects/{id}/dsn` | Get DSN for SDK config |

## Database Schema

### PostgreSQL (Metadata)

| Table | Description |
|-------|-------------|
| `users` | id, email, password_hash, name, avatar_url |
| `organizations` | id, name, slug, owner_id, plan (free/pro/enterprise) |
| `organization_members` | organization_id, user_id, role (owner/admin/member) |
| `projects` | id, organization_id, name, slug, platform, environment, dsn_public_key |
| `api_keys` | id, project_id, name, key_prefix, key_hash, scopes, revoked_at |
| `invitations` | id, organization_id, email, role, token, expires_at |

### ClickHouse (Analytics)

| Table | Description |
|-------|-------------|
| `logs` | Inbound request logs (endpoint, method, status, response_time, module) |
| `outbound_logs` | Outbound API calls (service, host, latency, status, trace) |
| `job_logs` | Background jobs (class, queue, status, duration, exceptions) |
| `scheduled_task_logs` | Cron tasks (command, expression, status, duration) |
| `stats_hourly` | Materialized view: hourly aggregated request stats |
| `outbound_stats_hourly` | Materialized view: hourly outbound stats |
| `job_stats_hourly` | Materialized view: hourly job stats |
| `scheduled_task_stats_daily` | Materialized view: daily task stats |

All ClickHouse tables use monthly partitioning (`toYYYYMM()`) and 90-day TTL retention.

## Available Commands

```bash
make help             # Show all available commands
make install          # Install frontend + backend dependencies
make dev              # Start databases + show dev instructions
make dev-backend      # Start backend server (port 8030)
make dev-frontend     # Start frontend dev server (port 3030)
make clickhouse       # Start ClickHouse + PostgreSQL (Docker)
make build            # Build frontend for production
make docker-up        # Start all services (production)
make docker-down      # Stop all services
make clean            # Clean build artifacts
```

## Deployment

### Docker (Production)

```bash
docker compose up -d
```

Starts all services: PostgreSQL, ClickHouse, backend (port 8000), frontend (port 3000).

### CI/CD

GitHub Actions workflows in `.github/workflows/`:

- **ci.yml** — Runs on PR/push: lint, type-check, build for frontend and backend
- **deploy.yml** — Runs on push to `main` or version tags: builds and pushes Docker images to `ghcr.io`

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL async connection string | Required |
| `CLICKHOUSE_HOST` | ClickHouse hostname | `localhost` |
| `CLICKHOUSE_PORT` | ClickHouse HTTP port | `8123` |
| `CLICKHOUSE_DATABASE` | ClickHouse database name | `sid_monitoring` |
| `JWT_SECRET_KEY` | Secret for JWT token signing | Required |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | JWT token expiry | `30` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:5173` |
| `PORT` | Backend server port | `8000` |
| `DEBUG` | Enable debug mode | `false` |

## License

Proprietary. All rights reserved.
