# Contributing to SidMonitor

Thank you for your interest in contributing to SidMonitor!

## Development Setup

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

This starts PostgreSQL and ClickHouse via Docker Compose. ClickHouse init scripts in `clickhouse/init/` run automatically on first start.

### 3. Configure Backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your local settings. See `.env.example` for all available options.

### 4. Run Migrations

```bash
cd backend
alembic upgrade head
```

### 5. Start Dev Servers

```bash
# Terminal 1
make dev-backend    # http://localhost:8030

# Terminal 2
make dev-frontend   # http://localhost:3030
```

## Project Structure

| Directory | Description |
|-----------|-------------|
| `backend/` | FastAPI API server (Python) |
| `frontend/` | React SPA (TypeScript + Vite) |
| `clickhouse/init/` | ClickHouse table schemas and materialized views |
| `database/` | PostgreSQL seed data |
| `tests/` | Integration and e2e tests |

## Code Style

- **Frontend**: ESLint + TypeScript strict mode. Run `cd frontend && npm run lint`.
- **Backend**: Ruff linter. Run `cd backend && ruff check .`.

## Pull Requests

1. Fork the repo and create a feature branch from `main`
2. Make your changes with clear commit messages
3. Ensure linting passes (`make lint` or run linters manually)
4. Open a PR with a description of what changed and why

## Database Changes

- **PostgreSQL**: Add migrations via `cd backend && alembic revision --autogenerate -m "description"`
- **ClickHouse**: Add new `.sql` files in `clickhouse/init/` with incremental numbering

## Reporting Issues

Open an issue on GitHub with:
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, browser, Docker version)
