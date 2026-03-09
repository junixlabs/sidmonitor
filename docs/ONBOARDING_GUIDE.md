# Project Onboarding Guide

Hướng dẫn từng bước để onboard một project mới vào SidMonitor, từ setup platform đến tích hợp SDK.

## Table of Contents

1. [Tổng quan quy trình](#1-tổng-quan-quy-trình)
2. [Bước 1: Setup SidMonitor Platform](#2-bước-1-setup-sidmonitor-platform)
3. [Bước 2: Tạo Organization & Project](#3-bước-2-tạo-organization--project)
4. [Bước 3: Lấy API Key](#4-bước-3-lấy-api-key)
5. [Bước 4: Tích hợp Laravel SDK](#5-bước-4-tích-hợp-laravel-sdk)
6. [Bước 5: Tích hợp trực tiếp qua API (Non-Laravel)](#6-bước-5-tích-hợp-trực-tiếp-qua-api-non-laravel)
7. [Bước 6: Xác nhận dữ liệu đã vào](#7-bước-6-xác-nhận-dữ-liệu-đã-vào)
8. [Cấu hình nâng cao](#8-cấu-hình-nâng-cao)
9. [Payload Reference](#9-payload-reference)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Tổng quan quy trình

```
┌──────────────────────────────────────────────────────────────┐
│                    ONBOARDING FLOW                           │
│                                                              │
│  1. Setup Platform     2. Create Org/Project   3. Get Key   │
│  ┌─────────────┐      ┌─────────────────┐    ┌──────────┐  │
│  │ Docker +    │─────▶│ Register User   │───▶│ API Key  │  │
│  │ Backend +   │      │ Create Org      │    │ or DSN   │  │
│  │ Frontend    │      │ Create Project  │    │          │  │
│  └─────────────┘      └─────────────────┘    └────┬─────┘  │
│                                                    │        │
│  4. Integrate SDK      5. Verify Data              │        │
│  ┌─────────────┐      ┌─────────────────┐         │        │
│  │ Install SDK │◀─────│ Check Dashboard │◀────────┘        │
│  │ Config .env │      │ View Logs       │                   │
│  │ Deploy      │─────▶│ Check Stats     │                   │
│  └─────────────┘      └─────────────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

**Thời gian ước tính:** 15-30 phút (lần đầu setup platform) / 5-10 phút (onboard project tiếp theo)

---

## 2. Bước 1: Setup SidMonitor Platform

> Nếu platform đã chạy sẵn, bỏ qua bước này.

### Option A: Local Development

```bash
# Clone project
git clone <repository-url>
cd monitoring

# Install dependencies
make install

# Start databases (PostgreSQL + ClickHouse)
make clickhouse

# Configure backend
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
HOST=0.0.0.0
PORT=8030
DEBUG=true
DATABASE_URL=postgresql+asyncpg://sidmonitor:password@localhost:5432/sidmonitor
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=sid_monitoring
JWT_SECRET_KEY=your-random-secret-key-at-least-32-chars
CORS_ORIGINS=http://localhost:3030
```

```bash
# Run migrations
cd backend && alembic upgrade head && cd ..

# Start servers
make dev-backend    # Terminal 1: http://localhost:8030
make dev-frontend   # Terminal 2: http://localhost:3030
```

### Option B: Docker Production

```bash
# Clone và start tất cả
git clone <repository-url>
cd monitoring
docker compose up -d

# Services:
# - Frontend: http://localhost:3000
# - Backend:  http://localhost:8000
# - PostgreSQL: localhost:5432
# - ClickHouse: localhost:8123
```

### Kiểm tra platform đã chạy

```bash
# Health check
curl http://localhost:8030/health
# Expected: {"status": "ok"}
```

---

## 3. Bước 2: Tạo Organization & Project

### Qua UI (Recommended)

1. Mở http://localhost:3030/register
2. Điền email, password, name → Register
3. Tạo Organization (tên công ty/team)
4. Tạo Project (tên application cần monitor)
   - **Name:** Tên project (VD: `My Laravel App`)
   - **Platform:** `laravel` / `python` / `node`
   - **Environment:** `production` / `staging` / `development`

### Qua API (Automation)

```bash
# 1. Register user
curl -s -X POST http://localhost:8030/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "password": "secure-password",
    "name": "Admin User"
  }' | jq .

# Lưu lại access_token
export TOKEN="eyJ..."

# 2. Create organization
curl -s -X POST http://localhost:8030/api/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Company",
    "slug": "my-company"
  }' | jq .

# 3. Create project
curl -s -X POST http://localhost:8030/api/my-company/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Laravel App",
    "slug": "laravel-app",
    "platform": "laravel",
    "environment": "production"
  }' | jq .

# Lưu lại project id từ response
```

---

## 4. Bước 3: Lấy API Key

### Qua UI

1. Vào **Settings** (sidebar → Settings icon)
2. Scroll đến section **API Keys**
3. Click **+ Create New Key**
4. Đặt tên (VD: `Production Key`)
5. **Copy API key ngay** — key chỉ hiển thị 1 lần

API key format: `sk_live_<64-hex-chars>`

### Qua API

```bash
# Create API key
curl -s -X POST http://localhost:8030/api/projects/{project_id}/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Production Key"}' | jq .

# Response chứa full key (chỉ trả 1 lần):
# {
#   "id": "uuid",
#   "name": "Production Key",
#   "key": "sk_live_a1b2c3d4...",     ← Copy key này
#   "key_prefix": "sk_live_a1b2c3d4..."
# }
```

### DSN (Alternative)

DSN format: `https://<dsn_public_key>@<host>/api/ingest`

Xem DSN trong Settings page → DSN Configuration section.

---

## 5. Bước 4: Tích hợp Laravel SDK

### 5.1 Install Package

```bash
composer require junixlabs/laravel-observatory
```

### 5.2 Publish Config

```bash
php artisan vendor:publish --tag=observatory-config
```

Tạo file `config/observatory.php` với full configuration.

### 5.3 Configure .env

Thêm vào `.env` của Laravel app:

```env
# === SidMonitor Observatory ===

# Enable monitoring
OBSERVATORY_ENABLED=true

# Application name (hiển thị trong dashboard)
OBSERVATORY_APP_NAME=my-laravel-app

# Exporter: 'prometheus' hoặc 'sidmonitor'
OBSERVATORY_EXPORTER=sidmonitor

# SidMonitor API endpoint
OBSERVATORY_SIDMONITOR_ENDPOINT=http://localhost:8030
OBSERVATORY_SIDMONITOR_API_KEY=sk_live_your-api-key-here
OBSERVATORY_SIDMONITOR_PROJECT_ID=your-project-uuid

# Feature toggles
OBSERVATORY_INBOUND_ENABLED=true      # Monitor incoming HTTP requests
OBSERVATORY_OUTBOUND_ENABLED=true     # Monitor outgoing HTTP calls
OBSERVATORY_JOBS_ENABLED=true         # Monitor queue jobs
OBSERVATORY_EXCEPTIONS_ENABLED=true   # Track exceptions
```

### 5.4 SDK Auto-Captures

Sau khi install, SDK tự động capture:

| Feature | Mechanism | Auto? | Dữ liệu capture |
|---------|-----------|-------|------------------|
| **Inbound Requests** | Middleware `ObserveRequests` | Yes | method, uri, status, duration, memory |
| **Outbound Requests** | Guzzle middleware (global) | Yes | method, host, path, status, duration |
| **Queue Jobs** | Laravel events (JobProcessed/JobFailed) | Yes | class, queue, status, duration, exceptions |
| **Exceptions** | Exception handler | Yes | class, message, file, line |

### 5.5 Cấu hình chi tiết

**Exclude paths** (không monitor các path này):

```php
// config/observatory.php
'inbound' => [
    'exclude_paths' => [
        'telescope*',       // Laravel Telescope
        'horizon*',         // Laravel Horizon
        '_debugbar*',       // Debug Bar
        'health',           // Health check
        'metrics',          // Prometheus metrics
    ],
],
```

**Exclude outbound hosts:**

```php
'outbound' => [
    'exclude_hosts' => [
        'localhost',
        '127.0.0.1',
    ],
],
```

**Record request/response bodies** (default: off):

```env
OBSERVATORY_INBOUND_RECORD_BODY=true
OBSERVATORY_INBOUND_MAX_BODY_SIZE=64000

OBSERVATORY_OUTBOUND_RECORD_BODY=true
OBSERVATORY_OUTBOUND_MAX_BODY_SIZE=64000

OBSERVATORY_JOBS_RECORD_PAYLOAD=true
OBSERVATORY_JOBS_MAX_PAYLOAD_SIZE=64000
```

**Sensitive headers tự động excluded:**
- `authorization`, `cookie`, `x-api-key`, `x-auth-token`

### 5.6 Outbound Monitoring Setup

SDK tự động register global Guzzle middleware. Nếu dùng custom HTTP client:

```php
use Illuminate\Support\Facades\Http;

// Automatic — all Http::get/post/etc calls are monitored
$response = Http::get('https://api.stripe.com/v1/charges');

// Explicit — if needed
$response = Http::withObservatory()->get('https://api.example.com/data');
```

### 5.7 Prometheus Exporter (Alternative)

Nếu dùng Prometheus thay vì SidMonitor direct:

```env
OBSERVATORY_EXPORTER=prometheus
OBSERVATORY_PROMETHEUS_ENDPOINT=/metrics
OBSERVATORY_PROMETHEUS_STORAGE=redis          # redis cho multi-worker
OBSERVATORY_REDIS_HOST=127.0.0.1
OBSERVATORY_REDIS_PORT=6379
```

Metrics available:
- `{app}_http_requests_total` (counter) — labels: method, route, status_code
- `{app}_http_request_duration_seconds` (histogram) — labels: method, route, status_code
- `{app}_http_outbound_requests_total` (counter) — labels: method, host, status_code
- `{app}_http_outbound_duration_seconds` (histogram)
- `{app}_jobs_processed_total` (counter) — labels: job_name, queue, status
- `{app}_jobs_duration_seconds` (histogram)
- `{app}_exceptions_total` (counter) — labels: exception_class, file

---

## 6. Bước 5: Tích hợp trực tiếp qua API (Non-Laravel)

Cho các project Python, Node.js, Go, hoặc bất kỳ language nào, gửi trực tiếp đến Ingest API.

### 6.1 Inbound Request Log

```bash
curl -X POST http://localhost:8030/api/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_live_your-api-key" \
  -d '{
    "request_id": "req-001",
    "timestamp": "2024-01-15T10:30:00Z",
    "endpoint": "/api/users",
    "method": "GET",
    "status_code": 200,
    "response_time_ms": 45.2,
    "module": "users",
    "user_id": "user-123",
    "tags": ["api", "v2"]
  }'
```

### 6.2 Outbound Request Log

```bash
curl -X POST http://localhost:8030/api/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_live_your-api-key" \
  -d '{
    "request_id": "req-002",
    "timestamp": "2024-01-15T10:30:00Z",
    "endpoint": "https://api.stripe.com/v1/charges",
    "method": "POST",
    "status_code": 200,
    "response_time_ms": 342.5,
    "third_party_service": "stripe",
    "module": "payments"
  }'
```

### 6.3 Batch Ingest (Recommended cho production)

```bash
curl -X POST http://localhost:8030/api/ingest/batch \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_live_your-api-key" \
  -d '{
    "inbound_logs": [
      {
        "request_id": "req-001",
        "endpoint": "/api/users",
        "method": "GET",
        "status_code": 200,
        "response_time_ms": 45
      },
      {
        "request_id": "req-002",
        "endpoint": "/api/orders",
        "method": "POST",
        "status_code": 201,
        "response_time_ms": 120
      }
    ],
    "outbound_logs": [
      {
        "request_id": "out-001",
        "endpoint": "https://api.sendgrid.com/v3/mail/send",
        "method": "POST",
        "status_code": 202,
        "response_time_ms": 890,
        "third_party_service": "sendgrid"
      }
    ]
  }'
```

### 6.4 Job Log

```bash
curl -X POST http://localhost:8030/api/v1/ingest/job \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_live_your-api-key" \
  -d '{
    "job_id": "job-001",
    "job_class": "App\\Jobs\\ProcessPayment",
    "job_name": "ProcessPayment",
    "queue_name": "payments",
    "connection": "redis",
    "status": "success",
    "started_at": "2024-01-15T10:30:00Z",
    "completed_at": "2024-01-15T10:30:02Z",
    "duration_ms": 2000,
    "attempt_number": 1,
    "max_attempts": 3,
    "memory_usage_mb": 24.5
  }'
```

### 6.5 Failed Job (with exception)

```bash
curl -X POST http://localhost:8030/api/v1/ingest/job \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_live_your-api-key" \
  -d '{
    "job_id": "job-002",
    "job_class": "App\\Jobs\\SendEmail",
    "job_name": "SendEmail",
    "queue_name": "emails",
    "connection": "redis",
    "status": "failed",
    "started_at": "2024-01-15T10:31:00Z",
    "completed_at": "2024-01-15T10:31:05Z",
    "duration_ms": 5000,
    "attempt_number": 3,
    "max_attempts": 3,
    "exception_class": "Illuminate\\Mail\\MailException",
    "exception_message": "SMTP connection timeout",
    "exception_trace": "..."
  }'
```

### 6.6 Scheduled Task Log

```bash
curl -X POST http://localhost:8030/api/v1/ingest/task \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_live_your-api-key" \
  -d '{
    "task_id": "task-001",
    "command": "emails:send-daily-digest",
    "description": "Send daily email digest to all users",
    "expression": "0 8 * * *",
    "timezone": "Asia/Ho_Chi_Minh",
    "status": "completed",
    "scheduled_at": "2024-01-15T08:00:00Z",
    "started_at": "2024-01-15T08:00:01Z",
    "completed_at": "2024-01-15T08:00:05Z",
    "duration_ms": 4000,
    "exit_code": 0
  }'
```

### 6.7 Python Integration Example

```python
import httpx
import time
from datetime import datetime, timezone

SIDMONITOR_URL = "http://localhost:8030"
API_KEY = "sk_live_your-api-key"

headers = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
}

# Middleware-style decorator for Flask/FastAPI
def monitor_request(func):
    def wrapper(*args, **kwargs):
        start = time.time()
        try:
            result = func(*args, **kwargs)
            status_code = getattr(result, 'status_code', 200)
        except Exception as e:
            status_code = 500
            raise
        finally:
            duration_ms = (time.time() - start) * 1000
            httpx.post(
                f"{SIDMONITOR_URL}/api/ingest",
                headers=headers,
                json={
                    "request_id": str(uuid4()),
                    "endpoint": request.path,
                    "method": request.method,
                    "status_code": status_code,
                    "response_time_ms": duration_ms,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
        return result
    return wrapper
```

### 6.8 Node.js Integration Example

```javascript
const axios = require('axios');

const SIDMONITOR_URL = 'http://localhost:8030';
const API_KEY = 'sk_live_your-api-key';

// Express middleware
function sidmonitorMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    axios.post(`${SIDMONITOR_URL}/api/ingest`, {
      request_id: req.headers['x-request-id'] || crypto.randomUUID(),
      endpoint: req.originalUrl,
      method: req.method,
      status_code: res.statusCode,
      response_time_ms: duration,
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'X-API-Key': API_KEY }
    }).catch(() => {}); // Fire-and-forget
  });

  next();
}

app.use(sidmonitorMiddleware);
```

---

## 7. Bước 6: Xác nhận dữ liệu đã vào

### Qua Dashboard UI

1. Mở http://localhost:3030
2. Chọn đúng Organization & Project (header dropdown)
3. Kiểm tra:
   - **Dashboard** → Stats cards hiển thị số requests > 0
   - **Inbound APIs** → Tab Dashboard → Module Health có data
   - **Outbound APIs** → Tab Dashboard → Service Health có data
   - **Jobs** → Job summary table có records
   - **Scheduled Tasks** → Task table có records

### Qua API

```bash
# Check inbound stats
curl -s http://localhost:8030/api/inbound/stats \
  -H "Authorization: Bearer $TOKEN" | jq .

# Check outbound stats
curl -s http://localhost:8030/api/outbound/stats \
  -H "Authorization: Bearer $TOKEN" | jq .

# Check job stats
curl -s http://localhost:8030/api/v1/jobs/stats \
  -H "Authorization: Bearer $TOKEN" | jq .

# Check recent logs
curl -s "http://localhost:8030/api/logs?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Qua ClickHouse trực tiếp

```bash
docker exec -it monitoring-clickhouse-1 clickhouse-client \
  -q "SELECT count() FROM sid_monitoring.logs WHERE project_id = 'your-project-id'"

docker exec -it monitoring-clickhouse-1 clickhouse-client \
  -q "SELECT count() FROM sid_monitoring.outbound_logs WHERE project_id = 'your-project-id'"

docker exec -it monitoring-clickhouse-1 clickhouse-client \
  -q "SELECT count() FROM sid_monitoring.job_logs WHERE project_id = 'your-project-id'"
```

---

## 8. Cấu hình nâng cao

### Batch Ingestion (Performance)

Cho production, nên batch logs thay vì gửi từng entry:

```env
# Laravel SDK
OBSERVATORY_SIDMONITOR_BATCH_SIZE=100     # Gửi mỗi 100 entries
OBSERVATORY_SIDMONITOR_BATCH_INTERVAL=10  # Hoặc mỗi 10 giây
```

### Queue Transport (Laravel)

Dùng queue để không block request:

```env
SID_MONITORING_TRANSPORT=queue
```

### Body Recording

Mặc định, request/response body KHÔNG được record (privacy + storage). Enable khi cần debug:

```env
# Inbound
OBSERVATORY_INBOUND_RECORD_BODY=true
OBSERVATORY_INBOUND_MAX_BODY_SIZE=64000    # 64KB max

# Outbound
OBSERVATORY_OUTBOUND_RECORD_BODY=true

# Jobs
OBSERVATORY_JOBS_RECORD_PAYLOAD=true
```

### Custom Labels

Thêm metadata vào mọi log entry:

```php
// config/observatory.php
'labels' => [
    'environment' => env('APP_ENV', 'production'),
    'version' => env('APP_VERSION', '1.0.0'),
    'region' => env('APP_REGION', 'ap-southeast-1'),
],
```

### Multiple Environments

Tạo project riêng cho mỗi environment:

| Environment | Project | API Key |
|------------|---------|---------|
| Production | `my-app-prod` | `sk_live_prod_...` |
| Staging | `my-app-staging` | `sk_live_stag_...` |
| Development | `my-app-dev` | `sk_live_dev_...` |

---

## 9. Payload Reference

### Inbound Log Entry

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `request_id` | string | Yes | Unique request identifier |
| `timestamp` | datetime | No | Default: UTC now |
| `endpoint` | string | Yes | Request path (e.g., `/api/users`) |
| `method` | string | Yes | HTTP method (`GET`, `POST`, etc.) |
| `status_code` | int | Yes | HTTP status code (100-599) |
| `response_time_ms` | float | Yes | Response time in milliseconds |
| `user_id` | string | No | Authenticated user ID |
| `user_name` | string | No | User display name |
| `module` | string | No | Module/controller name |
| `tags` | string[] | No | Custom tags |
| `request_body` | string | No | Truncated request body |
| `response_body` | string | No | Truncated response body |

### Outbound Log Entry

Tất cả field của Inbound, cộng thêm:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `third_party_service` | string | Yes | Service name (`stripe`, `sendgrid`, etc.) |

### Job Log Entry

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | string | Yes | Job identifier |
| `job_uuid` | string | No | UUID if available |
| `job_class` | string | Yes | Full class name |
| `job_name` | string | Yes | Short name |
| `queue_name` | string | Yes | Queue name (default: `default`) |
| `connection` | string | Yes | Connection name (default: `sync`) |
| `status` | string | Yes | `pending`, `running`, `success`, `failed` |
| `started_at` | datetime | Yes | When job started |
| `completed_at` | datetime | No | When job finished |
| `duration_ms` | int | No | Duration in milliseconds |
| `attempt_number` | int | No | Current attempt (default: 1) |
| `max_attempts` | int | No | Max allowed attempts (default: 1) |
| `exception_class` | string | No | Exception class (if failed) |
| `exception_message` | string | No | Error message |
| `exception_trace` | string | No | Stack trace |
| `user_id` | string | No | User who dispatched job |
| `memory_usage_mb` | float | No | Memory used |
| `metadata` | object | No | Custom metadata |

### Scheduled Task Log Entry

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `task_id` | string | Yes | Task identifier |
| `command` | string | Yes | Artisan command name |
| `description` | string | No | Human description |
| `expression` | string | Yes | Cron expression (`0 8 * * *`) |
| `timezone` | string | No | Default: `UTC` |
| `status` | string | Yes | `scheduled`, `running`, `completed`, `failed`, `skipped`, `missed` |
| `scheduled_at` | datetime | Yes | When task was scheduled |
| `started_at` | datetime | No | Actual start time |
| `completed_at` | datetime | No | Completion time |
| `duration_ms` | int | No | Duration in milliseconds |
| `exit_code` | int | No | Process exit code |
| `output` | string | No | Command output |
| `error_message` | string | No | Error message (if failed) |
| `error_trace` | string | No | Stack trace |
| `without_overlapping` | bool | No | Has overlap prevention |
| `expected_run_time` | datetime | No | Expected execution time |
| `delay_ms` | int | No | Delay from scheduled time |
| `metadata` | object | No | Custom metadata |

---

## 10. Troubleshooting

### "401 Unauthorized" khi ingest

```bash
# Kiểm tra API key có đúng không
curl -v -X POST http://localhost:8030/api/ingest \
  -H "X-API-Key: sk_live_your-key" \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"/test","method":"GET","status_code":200,"response_time_ms":1}'
```

- Đảm bảo header là `X-API-Key` (không phải `Authorization`)
- Kiểm tra key chưa bị revoke trong Settings
- Copy lại key chính xác, không có space/newline

### Dữ liệu không hiển thị trên Dashboard

1. Kiểm tra đang chọn đúng **Project** trên header dropdown
2. Kiểm tra **time range** filter (default 24h - data cũ hơn sẽ không hiển thị)
3. Verify data đã vào ClickHouse:
   ```bash
   docker exec -it monitoring-clickhouse-1 clickhouse-client \
     -q "SELECT count(), max(timestamp) FROM sid_monitoring.logs"
   ```

### Laravel SDK không gửi data

1. Kiểm tra `OBSERVATORY_ENABLED=true`
2. Kiểm tra exporter config đúng:
   ```bash
   php artisan tinker
   >>> config('observatory.enabled')    // true
   >>> config('observatory.exporter')   // 'sidmonitor'
   >>> config('observatory.sidmonitor.api_key')  // sk_live_...
   ```
3. Kiểm tra endpoint accessible từ Laravel app:
   ```bash
   curl http://localhost:8030/health
   ```
4. Check Laravel log: `storage/logs/laravel.log`

### Jobs/Tasks không được track

- Kiểm tra `OBSERVATORY_JOBS_ENABLED=true`
- Jobs phải chạy qua Laravel queue system (dispatch, not call directly)
- Scheduled tasks phải define trong `app/Console/Kernel.php`

### Outbound requests không hiển thị

- Phải dùng Laravel `Http` facade hoặc Guzzle client
- `file_get_contents()` / `curl_exec()` trực tiếp KHÔNG được capture
- Check exclude hosts: `localhost` và `127.0.0.1` mặc định bị exclude

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────┐
│                 QUICK SETUP                          │
│                                                      │
│  1. composer require junixlabs/laravel-observatory   │
│  2. php artisan vendor:publish --tag=observatory-config │
│  3. Add to .env:                                     │
│     OBSERVATORY_ENABLED=true                         │
│     OBSERVATORY_EXPORTER=sidmonitor                  │
│     OBSERVATORY_SIDMONITOR_ENDPOINT=http://host:8030 │
│     OBSERVATORY_SIDMONITOR_API_KEY=sk_live_xxx       │
│     OBSERVATORY_SIDMONITOR_PROJECT_ID=uuid           │
│  4. Deploy — monitoring starts automatically         │
│                                                      │
│  Ingest API: POST /api/ingest                        │
│  Auth Header: X-API-Key: sk_live_xxx                 │
│  Dashboard: http://host:3030                         │
└─────────────────────────────────────────────────────┘
```
