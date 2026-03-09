# Laravel Observatory Demo with Grafana

Demo stack to visualize Laravel Observatory metrics in Grafana.

## Quick Start

```bash
# Start the stack
docker compose up -d

# Wait for services to start (about 30 seconds)
```

## Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Laravel App | http://localhost:8080 | - |
| Prometheus | http://localhost:9090 | - |
| Grafana | http://localhost:3000 | admin/admin |

## Generate Sample Traffic

```bash
# Basic requests
curl http://localhost:8080/
curl http://localhost:8080/api/users

# Slow endpoint (500ms)
curl http://localhost:8080/api/slow

# Outbound HTTP call
curl http://localhost:8080/api/external

# Error endpoint
curl http://localhost:8080/api/error

# View raw metrics
curl http://localhost:8080/metrics
```

## Grafana Dashboard

1. Open http://localhost:3000
2. Login with admin/admin
3. Go to Dashboards -> Laravel Observatory
4. See real-time metrics:
   - HTTP Request Rate
   - Request Latency (p50, p95, p99)
   - Outbound HTTP Calls
   - Exception Count

## Stack Components

- **Laravel App**: Demo app with laravel-observatory package
- **Prometheus**: Scrapes `/metrics` every 5 seconds
- **Grafana**: Pre-configured dashboard for visualization

## Stop the Stack

```bash
docker compose down
```
