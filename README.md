# SidMonitor

Open-source Application Performance Monitoring (APM) platform for Laravel and Python applications. Track inbound/outbound HTTP requests, background jobs, scheduled tasks, and application health in real-time.

## Features

- **Inbound API Monitoring** — Track incoming HTTP requests with response times, status codes, and error rates by module/endpoint
- **Outbound API Monitoring** — Monitor external API calls with latency, success rates, and service-level health breakdowns
- **Background Job Tracking** — Monitor queue jobs with execution times, failure rates, retry counts, and exception details
- **Scheduled Task Monitoring** — Track cron job executions with schedule adherence, duration, and failure detection
- **Multi-Tenant Architecture** — Organizations, projects, and role-based access control with API key authentication
- **Real-Time Dashboard** — Global overview across all projects, per-project dashboards with charts and analytics
- **Advanced Analytics** — Error breakdowns, performance percentiles (P50/P95/P99), traffic patterns, and user activity
- **Dark/Light Theme** — Full theme support with system preference detection

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, Recharts, React Query |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| Analytics DB | ClickHouse (logs, metrics, materialized views) |
| Metadata DB | PostgreSQL 15 (users, orgs, projects, API keys) |
| Auth | JWT + bcrypt password hashing |
| Client SDKs | [Laravel Observatory](https://github.com/junixlabs/laravel-observatory) |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Laravel App    │────>│  FastAPI Backend │────>│  ClickHouse  │
│  (SDK)          │     │  :8030           │     │  (Analytics) │
└─────────────────┘     │                  │     └──────────────┘
                        │  /api/ingest     │     ┌──────────────┐
                        │  /api/ingest/job │────>│  PostgreSQL  │
                        │  /api/ingest/task│     │  (Metadata)  │
                        │                  │     └──────────────┘
                        └────────┬─────────┘
                                 │
                        ┌────────v─────────┐
                        │  React Frontend  │
                        │  :3030           │
                        └──────────────────┘
```

1. Client SDKs send telemetry to the Ingest API with an API key (`X-API-Key`)
2. Backend validates the key and writes raw logs to ClickHouse
3. ClickHouse materialized views auto-aggregate hourly/daily statistics
4. Frontend queries stats and log endpoints, scoped to the current project

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker & Docker Compose

### 1. Clone and Install

```bash
git clone https://github.com/junixlabs/sidmonitor.git
cd sidmonitor
make install
```

### 2. Start Databases

```bash
make dev-db
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

### 4. Run Migrations

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
2. Create your account, organization, and project
3. Copy the API key from Settings
4. Install the [Laravel Observatory SDK](https://github.com/junixlabs/laravel-observatory) in your application

## Client SDK

### Laravel

```bash
composer require junixlabs/laravel-observatory
php artisan vendor:publish --tag=observatory-config
```

Add to your `.env`:

```env
OBSERVATORY_ENABLED=true
OBSERVATORY_EXPORTER=sidmonitor
SIDMONITOR_API_KEY=your-api-key
SIDMONITOR_ENDPOINT=http://localhost:8030
```

The SDK automatically monitors inbound HTTP requests, outbound API calls, queue jobs, and scheduled tasks. See the [Laravel Observatory documentation](https://github.com/junixlabs/laravel-observatory) for full configuration options.

## Project Structure

```
sidmonitor/
├── backend/                    # FastAPI API server
│   ├── app/
│   │   ├── api/               # Route handlers (auth, ingest, stats, ...)
│   │   ├── models/            # Pydantic schemas & SQLAlchemy models
│   │   ├── services/          # Business logic (ClickHouse, auth, ingest)
│   │   └── main.py            # App entry point & router setup
│   ├── alembic/               # PostgreSQL migrations
│   └── requirements.txt
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── pages/             # Route-level page components
│   │   ├── components/        # UI primitives & domain components
│   │   ├── hooks/             # React Query data hooks
│   │   ├── api/client.ts      # Axios API client
│   │   └── contexts/          # Auth & Theme providers
│   └── package.json
├── clickhouse/init/            # ClickHouse schemas & materialized views
├── docker-compose.yml          # Production stack
├── docker-compose.dev.yml      # Development databases
└── Makefile                    # Development commands
```

## Available Commands

```bash
make help             # Show all commands
make install          # Install frontend + backend dependencies
make dev-db           # Start PostgreSQL + ClickHouse (Docker)
make dev-backend      # Start backend (port 8030)
make dev-frontend     # Start frontend (port 3030)
make dev              # Start databases + show instructions
make build            # Build frontend for production
make up               # Start full Docker stack (production)
make down             # Stop all Docker services
make logs             # Tail Docker service logs
make clean            # Remove build artifacts
```

## Deployment

### Docker

```bash
docker compose up -d
```

Starts all services: PostgreSQL, ClickHouse, backend (port 8000), frontend (port 3000).

### CI/CD

GitHub Actions workflows in `.github/workflows/`:

- **ci.yml** — Lint, type-check, and build on PR/push
- **deploy.yml** — Build and push Docker images to `ghcr.io` on version tags

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL async connection string | Required |
| `CLICKHOUSE_HOST` | ClickHouse hostname | `localhost` |
| `CLICKHOUSE_PORT` | ClickHouse HTTP port | `8123` |
| `CLICKHOUSE_DATABASE` | ClickHouse database name | `sid_monitoring` |
| `JWT_SECRET_KEY` | Secret for JWT token signing | Required |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | JWT token expiry | `30` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:5173` |
| `PORT` | Backend server port | `8000` |
| `DEBUG` | Enable debug mode | `false` |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)
