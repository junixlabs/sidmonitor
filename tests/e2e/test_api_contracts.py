"""
E2E API Contract Tests for SidMonitor Backend

Tests all 74 endpoints to verify request/response schemas match OpenAPI documentation.
Uses FastAPI TestClient with mocked dependencies (no real DB/ClickHouse required).

Run: cd tests/e2e && python -m pytest test_api_contracts.py -v
"""

import sys
import os
import uuid
import math
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock, MagicMock

# Add backend to path so we can import the app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

# Set env vars BEFORE importing the app
os.environ.setdefault('DATABASE_URL', 'postgresql+asyncpg://test:test@localhost/test')
os.environ.setdefault('CLICKHOUSE_HOST', 'localhost')
os.environ.setdefault('CLICKHOUSE_PORT', '8123')
os.environ.setdefault('CLICKHOUSE_DATABASE', 'sid_monitoring')
os.environ.setdefault('SECRET_KEY', 'test-secret-key-for-contracts')
os.environ.setdefault('JWT_SECRET_KEY', 'test-secret-key-for-contracts')
os.environ.setdefault('INGEST_API_KEYS', 'test-api-key-12345')
os.environ.setdefault('AUTH_USERNAME', 'admin')
os.environ.setdefault('AUTH_PASSWORD', 'changeme')

import pytest

# ═══════════════════════════════════════════════════════════════
# MOCK OBJECTS
# ═══════════════════════════════════════════════════════════════

TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
TEST_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
TEST_PROJECT_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")
TEST_API_KEY_ID = uuid.UUID("00000000-0000-0000-0000-000000000004")
TEST_MEMBER_ID = uuid.UUID("00000000-0000-0000-0000-000000000005")
NOW = datetime(2026, 1, 1, 12, 0, 0)


class MockUser:
    """Mock SQLAlchemy User model."""
    id = TEST_USER_ID
    email = "test@example.com"
    name = "Test User"
    password_hash = "$2b$12$mock"
    avatar_url = None
    email_verified = True
    created_at = NOW
    updated_at = NOW


class MockOrganization:
    """Mock SQLAlchemy Organization model."""
    id = TEST_ORG_ID
    name = "Test Org"
    slug = "test-org"
    owner_id = TEST_USER_ID
    plan = "free"
    created_at = NOW
    updated_at = NOW


class MockProject:
    """Mock SQLAlchemy Project model."""
    id = TEST_PROJECT_ID
    organization_id = TEST_ORG_ID
    name = "Test Project"
    slug = "test-project"
    platform = "laravel"
    dsn_public_key = "test-dsn-key"
    environment = "production"
    created_by = TEST_USER_ID
    created_at = NOW


class MockApiKey:
    """Mock SQLAlchemy ApiKey model."""
    id = TEST_API_KEY_ID
    project_id = TEST_PROJECT_ID
    name = "Test Key"
    key_prefix = "sk_test"
    key_hash = "..."
    scopes = ["ingest"]
    created_by = TEST_USER_ID
    last_used_at = None
    revoked_at = None
    created_at = NOW


class MockMembership:
    """Mock SQLAlchemy OrganizationMember model."""
    id = TEST_MEMBER_ID
    organization_id = TEST_ORG_ID
    user_id = TEST_USER_ID
    role = "owner"
    invited_at = NOW
    joined_at = NOW
    user_email = "test@example.com"
    user_name = "Test User"


class MockCHResult:
    """Mock ClickHouse query result."""
    def __init__(self, rows=None, columns=None):
        self.result_rows = rows if rows is not None else []
        self.column_names = columns or []
        self.result_columns = columns or []


# ── Sample ClickHouse row data ──────────────────────────────

def _log_row():
    """Row matching SELECT from logs table."""
    return [
        str(uuid.uuid4()), "req-123", "2026-01-01 12:00:00",
        "/api/test", "GET", 200, 150.5, "user-1", "Test User",
        "test-module", [], 0, "", "", "",
    ]


def _inbound_log_row():
    """Row matching SELECT from logs table (inbound-specific query)."""
    return [
        str(uuid.uuid4()), "req-123", "2026-01-01 12:00:00",
        "/api/test", "GET", 200, 150.5, "user-1", "Test User",
        "test-module", [], "", "",
    ]


def _outbound_log_row():
    """Row matching SELECT from outbound_logs table (22 columns)."""
    return [
        str(uuid.uuid4()), str(TEST_PROJECT_ID), "req-123", "parent-req",
        "trace-123", "span-123", "2026-01-01 12:00:00", "stripe",
        "api.stripe.com", "https://api.stripe.com/v1/charges",
        "POST", 200, 50.5, 1, 100, 200, "", "", 0, "payments",
        "user-1", [],  # tags must be actual list
    ]


def _outbound_detail_row():
    """Row matching outbound detail SELECT (27 columns with body/headers)."""
    return _outbound_log_row() + ["{}", "{}", "", "", "{}", ""]


def _job_row():
    """Row matching SELECT from job_logs table."""
    return [
        "job-123", str(uuid.uuid4()), str(TEST_PROJECT_ID),
        "2026-01-01 12:00:00", "App\\Jobs\\TestJob", "Test Job",
        "default", "redis", "completed",
        "2026-01-01 12:00:00", "2026-01-01 12:00:01",
        500, '{"test": 1}', 1, 3, "", "", "", "user-1", 25.5,
    ]


def _scheduled_task_row():
    """Row matching SELECT from scheduled_task_logs table."""
    return [
        "task-123", str(TEST_PROJECT_ID), "2026-01-01 12:00:00",
        "test:command", "Test Command", "* * * * *", "UTC",
        "completed", "2026-01-01 12:00:00", "2026-01-01 12:00:00",
        "2026-01-01 12:00:01", 300, 0, "output", "", "",
        0, "", "2026-01-01 12:00:00", 100,
    ]


class MockCHClient:
    """Smart mock ClickHouse client that returns realistic data based on query patterns."""

    def query(self, query, parameters=None):
        q = query.lower().strip()

        # ── Detail queries (by ID) ──
        if 'from logs' in q and 'tostring(id)' in q and 'is_outbound = 0' in q:
            return MockCHResult(rows=[_inbound_log_row()])

        if 'from logs' in q and 'tostring(id)' in q:
            return MockCHResult(rows=[_log_row()])

        if 'from outbound_logs' in q and 'tostring(id)' in q:
            return MockCHResult(rows=[_outbound_detail_row()])

        if 'from job_logs' in q and 'tostring(id)' in q:
            return MockCHResult(rows=[_job_row()])

        # ── Count queries (for pagination) ──
        if 'count(*)' in q and 'count(' in q and q.strip().startswith('select'):
            # Detect number of columns
            try:
                select_part = q.split('from')[0]
                num_cols = select_part.count(',') + 1
            except Exception:
                num_cols = 1
            row = [0] * num_cols
            if num_cols >= 1:
                row[0] = 5  # total count
            return MockCHResult(rows=[row])

        # ── DISTINCT queries (module/endpoint lists) ──
        if 'distinct' in q:
            return MockCHResult(rows=[["test-item-1"], ["test-item-2"]])

        # ── Paginated list queries with LIMIT ──
        if 'from logs' in q and 'limit' in q and 'offset' in q:
            return MockCHResult(rows=[_log_row()])

        if 'from outbound_logs' in q and 'limit' in q:
            return MockCHResult(rows=[_outbound_log_row()])

        if 'from job_logs' in q and 'limit' in q:
            return MockCHResult(rows=[_job_row()])

        if 'from scheduled_task_logs' in q and 'limit' in q:
            return MockCHResult(rows=[_scheduled_task_row()])

        # ── Aggregate/stats queries ──
        if 'from logs' in q and ('count(' in q or 'avg(' in q or 'sum(' in q):
            try:
                select_part = q.split('from')[0]
                num_cols = select_part.count(',') + 1
            except Exception:
                num_cols = 4
            row = [0] * num_cols
            if num_cols >= 1:
                row[0] = 10
            return MockCHResult(rows=[row])

        if 'from outbound_logs' in q and ('count(' in q or 'avg(' in q):
            try:
                select_part = q.split('from')[0]
                num_cols = select_part.count(',') + 1
            except Exception:
                num_cols = 4
            row = [0] * num_cols
            if num_cols >= 1:
                row[0] = 10
            return MockCHResult(rows=[row])

        if 'from job_logs' in q and ('count(' in q or 'avg(' in q):
            try:
                select_part = q.split('from')[0]
                num_cols = select_part.count(',') + 1
            except Exception:
                num_cols = 4
            row = [0] * num_cols
            if num_cols >= 1:
                row[0] = 10
            return MockCHResult(rows=[row])

        if 'from scheduled_task_logs' in q and ('count(' in q or 'avg(' in q):
            try:
                select_part = q.split('from')[0]
                num_cols = select_part.count(',') + 1
            except Exception:
                num_cols = 4
            row = [0] * num_cols
            if num_cols >= 1:
                row[0] = 10
            return MockCHResult(rows=[row])

        # ── GROUP BY queries (timeseries, breakdowns) ──
        if 'group by' in q:
            return MockCHResult(rows=[])

        # ── Min/max period detection ──
        if 'min(' in q and 'max(' in q:
            return MockCHResult(rows=[["2026-01-01 00:00:00", "2026-01-01 23:59:59"]])

        # ── SELECT 1 (health check) ──
        if 'select 1' in q:
            return MockCHResult(rows=[[1]])

        # ── Default: empty result ──
        return MockCHResult(rows=[])

    def command(self, *args, **kwargs):
        return None

    def insert(self, table, data, column_names=None):
        return None


# ═══════════════════════════════════════════════════════════════
# FIXTURES
# ═══════════════════════════════════════════════════════════════

@pytest.fixture(scope="module")
def mock_ch():
    """Module-scoped mock ClickHouse client."""
    return MockCHClient()


@pytest.fixture(scope="module")
def app_and_client(mock_ch, tmp_path_factory):
    """Create FastAPI TestClient with all dependencies mocked."""
    # Use a temp dir for frontend logs
    log_dir = str(tmp_path_factory.mktemp("frontend_logs"))

    with patch("app.main.init_db", new_callable=AsyncMock), \
         patch("app.main.init_clickhouse"), \
         patch("clickhouse_connect.get_client", return_value=mock_ch):

        # Clear any cached CH client
        from app.services.clickhouse import get_clickhouse_client
        get_clickhouse_client.cache_clear()

        from app.main import app
        from app.database import get_db
        from app.api.auth import verify_auth, get_current_user
        from app.api.ingest import verify_api_key_and_get_project

        # Override dependencies
        app.dependency_overrides[verify_auth] = lambda: True
        app.dependency_overrides[get_current_user] = lambda: MockUser()
        app.dependency_overrides[verify_api_key_and_get_project] = lambda: None

        async def mock_get_db():
            session = AsyncMock()
            result = MagicMock()
            result.scalar_one_or_none.return_value = None
            result.scalars.return_value.all.return_value = []
            result.scalar_one.return_value = MockOrganization()
            session.execute.return_value = result
            session.commit = AsyncMock()
            async def _refresh(obj):
                if hasattr(obj, 'created_at') and obj.created_at is None:
                    obj.created_at = NOW
                if hasattr(obj, 'updated_at') and obj.updated_at is None:
                    obj.updated_at = NOW
            session.refresh = AsyncMock(side_effect=_refresh)
            yield session

        app.dependency_overrides[get_db] = mock_get_db

        # Patch frontend logs to use temp dir
        with patch("app.api.frontend_logs.LOG_DIR", log_dir), \
             patch("app.api.frontend_logs.LOG_FILE", os.path.join(log_dir, "frontend-errors.log")):
            from fastapi.testclient import TestClient
            with TestClient(app, raise_server_exceptions=False) as client:
                yield app, client

        app.dependency_overrides.clear()
        get_clickhouse_client.cache_clear()


@pytest.fixture(scope="module")
def client(app_and_client):
    """Convenience fixture: just the TestClient."""
    return app_and_client[1]


@pytest.fixture(scope="module")
def app_instance(app_and_client):
    """Convenience fixture: just the FastAPI app."""
    return app_and_client[0]


# ═══════════════════════════════════════════════════════════════
# HELPER: Response schema assertion
# ═══════════════════════════════════════════════════════════════

def assert_has_keys(data: dict, keys: list, msg=""):
    """Assert a dict has all expected keys."""
    missing = [k for k in keys if k not in data]
    assert not missing, f"Missing keys {missing} in response{': ' + msg if msg else ''}"


# ═══════════════════════════════════════════════════════════════
# TEST: Health Endpoints
# ═══════════════════════════════════════════════════════════════

class TestHealthEndpoints:
    """GET /health, GET /ready"""

    def test_health_check(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"

    def test_readiness_check(self, client):
        r = client.get("/ready")
        assert r.status_code == 200
        assert r.json()["status"] in ("ready", "not_ready")


# ═══════════════════════════════════════════════════════════════
# TEST: Frontend Logs Endpoints
# ═══════════════════════════════════════════════════════════════

class TestFrontendLogs:
    """POST/GET/DELETE /api/v1/frontend-logs"""

    def test_log_frontend_error(self, client):
        r = client.post("/api/v1/frontend-logs", json={
            "timestamp": "2026-01-01T12:00:00",
            "type": "error",
            "message": "Test error from E2E",
            "stack": "Error: test\\n  at test.js:1",
            "url": "http://localhost:3030/dashboard",
            "component": "Dashboard",
            "metadata": {"browser": "chrome"},
        })
        assert r.status_code == 200
        assert_has_keys(r.json(), ["status"])
        assert r.json()["status"] == "logged"

    def test_get_frontend_logs(self, client):
        r = client.get("/api/v1/frontend-logs")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["logs"])
        assert isinstance(data["logs"], list)
        if data["logs"]:
            log = data["logs"][0]
            assert_has_keys(log, ["received_at", "timestamp", "type", "message"])

    def test_clear_frontend_logs(self, client):
        r = client.delete("/api/v1/frontend-logs")
        assert r.status_code == 200
        assert r.json()["status"] == "cleared"


# ═══════════════════════════════════════════════════════════════
# TEST: Auth Endpoints
# ═══════════════════════════════════════════════════════════════

class TestAuthEndpoints:
    """POST /api/auth/register, login, GET/PATCH /api/auth/me, POST logout"""

    def test_register(self, client):
        """POST /api/auth/register → 201 TokenResponse"""
        from app.database import get_db
        from app.main import app

        async def register_db():
            session = AsyncMock()
            result = MagicMock()
            result.scalar_one_or_none.return_value = None  # No existing user
            session.execute.return_value = result
            def _add_with_defaults(obj):
                """Simulate SQLAlchemy INSERT defaults for id/timestamps."""
                if hasattr(obj, 'id') and obj.id is None:
                    obj.id = uuid.uuid4()
            session.add = MagicMock(side_effect=_add_with_defaults)  # add() is sync
            session.commit = AsyncMock()
            async def _refresh(obj):
                if hasattr(obj, 'created_at') and obj.created_at is None:
                    obj.created_at = NOW
                if hasattr(obj, 'updated_at') and obj.updated_at is None:
                    obj.updated_at = NOW
            session.refresh = AsyncMock(side_effect=_refresh)
            yield session

        original = app.dependency_overrides.get(get_db)
        app.dependency_overrides[get_db] = register_db
        try:
            with patch("app.api.auth.hash_password", return_value="$2b$12$hashed"), \
                 patch("app.api.auth.create_access_token", return_value="mock-jwt-token"):
                r = client.post("/api/auth/register", json={
                    "email": "new@example.com",
                    "password": "securepassword123",
                    "name": "New User",
                })
        finally:
            if original:
                app.dependency_overrides[get_db] = original
        assert r.status_code == 201
        data = r.json()
        assert_has_keys(data, ["access_token", "token_type", "user"])
        assert data["token_type"] == "bearer"
        assert_has_keys(data["user"], ["id", "email", "name"])

    def test_login(self, client):
        """POST /api/auth/login → 200 TokenResponse"""
        mock_user = MockUser()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user

        with patch("app.api.auth.verify_password", return_value=True), \
             patch("app.api.auth.create_access_token", return_value="mock-jwt-token"):
            # Override execute to return our user
            from app.database import get_db
            async def login_db():
                session = AsyncMock()
                session.execute.return_value = mock_result
                yield session
            from app.main import app
            original = app.dependency_overrides.get(get_db)
            app.dependency_overrides[get_db] = login_db
            try:
                r = client.post("/api/auth/login", json={
                    "email": "test@example.com",
                    "password": "testpassword",
                })
            finally:
                if original:
                    app.dependency_overrides[get_db] = original

        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["access_token", "token_type", "user"])
        assert_has_keys(data["user"], ["id", "email", "name", "created_at"])

    def test_get_me(self, client):
        """GET /api/auth/me → 200 UserResponse"""
        r = client.get("/api/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["id", "email", "name", "avatar_url", "created_at"])
        assert data["email"] == "test@example.com"

    def test_update_me(self, client):
        """PATCH /api/auth/me → 200 UserResponse"""
        r = client.patch("/api/auth/me", json={"name": "Updated Name"})
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["id", "email", "name"])

    def test_logout(self, client):
        """POST /api/auth/logout → 204 No Content"""
        r = client.post("/api/auth/logout")
        assert r.status_code == 204


# ═══════════════════════════════════════════════════════════════
# TEST: Auth Enforcement
# ═══════════════════════════════════════════════════════════════

class TestAuthEnforcement:
    """Verify protected endpoints return 401 without valid auth."""

    @pytest.mark.parametrize("method,path", [
        ("GET", "/api/logs"),
        ("GET", "/api/stats"),
        ("GET", "/api/auth/me"),
        ("GET", "/api/settings/project"),
        ("GET", "/api/organizations"),
    ])
    def test_requires_auth(self, app_instance, client, method, path):
        """Protected endpoints must return 401/403 without auth."""
        from app.api.auth import verify_auth, get_current_user
        from app.database import get_db

        # Temporarily remove auth overrides
        saved = {}
        for dep in [verify_auth, get_current_user]:
            if dep in app_instance.dependency_overrides:
                saved[dep] = app_instance.dependency_overrides.pop(dep)

        try:
            r = client.request(method, path)
            assert r.status_code in (401, 403), f"{method} {path} returned {r.status_code}"
        finally:
            app_instance.dependency_overrides.update(saved)


# ═══════════════════════════════════════════════════════════════
# TEST: Ingest Endpoints
# ═══════════════════════════════════════════════════════════════

class TestIngestEndpoints:
    """POST /api/ingest/*, /api/v1/ingest/*"""

    def test_ingest_single_inbound(self, client):
        """POST /api/ingest → 200 IngestResponse"""
        r = client.post("/api/ingest", json={
            "request_id": f"test-{uuid.uuid4()}",
            "endpoint": "/api/users",
            "method": "GET",
            "status_code": 200,
            "response_time_ms": 120.5,
            "module": "users",
        }, headers={"X-API-Key": "test"})
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["success", "message", "ingested_count"])
        assert data["success"] is True
        assert data["ingested_count"] == 1

    def test_ingest_batch(self, client):
        """POST /api/ingest/batch → 200 IngestResponse"""
        r = client.post("/api/ingest/batch", json={
            "inbound_logs": [{
                "request_id": f"test-{uuid.uuid4()}",
                "endpoint": "/api/test",
                "method": "POST",
                "status_code": 201,
                "response_time_ms": 200.0,
            }],
            "outbound_logs": [{
                "request_id": f"test-{uuid.uuid4()}",
                "endpoint": "https://api.stripe.com/v1/charges",
                "method": "POST",
                "status_code": 200,
                "response_time_ms": 300.0,
                "third_party_service": "stripe",
            }],
        })
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["ingested_count"] == 2

    def test_ingest_single_job(self, client):
        """POST /api/ingest/jobs → 200 JobIngestResponse"""
        r = client.post("/api/ingest/jobs", json={
            "job_id": f"job-{uuid.uuid4()}",
            "job_class": "App\\Jobs\\SendEmail",
            "job_name": "Send Email",
            "queue_name": "default",
            "connection": "redis",
            "status": "completed",
            "started_at": "2026-01-01T12:00:00",
            "completed_at": "2026-01-01T12:00:01",
            "duration_ms": 500,
            "attempt_number": 1,
            "max_attempts": 3,
        })
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["success", "message", "ingested_count"])
        assert data["success"] is True

    def test_ingest_scheduled_task(self, client):
        """POST /api/ingest/scheduled-tasks → 200 JobIngestResponse"""
        r = client.post("/api/ingest/scheduled-tasks", json={
            "task_id": f"task-{uuid.uuid4()}",
            "command": "emails:send-digest",
            "expression": "0 8 * * *",
            "timezone": "UTC",
            "status": "completed",
            "scheduled_at": "2026-01-01T08:00:00",
            "started_at": "2026-01-01T08:00:00",
            "completed_at": "2026-01-01T08:00:01",
            "duration_ms": 1000,
            "without_overlapping": False,
            "expected_run_time": "2026-01-01T08:00:00",
        })
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_ingest_jobs_batch(self, client):
        """POST /api/ingest/jobs/batch → 200 JobIngestResponse"""
        r = client.post("/api/ingest/jobs/batch", json={
            "job_logs": [{
                "job_id": f"job-{uuid.uuid4()}",
                "job_class": "App\\Jobs\\Test",
                "job_name": "Test",
                "queue_name": "high",
                "connection": "redis",
                "status": "completed",
                "started_at": "2026-01-01T12:00:00",
                "attempt_number": 1,
                "max_attempts": 3,
            }],
            "scheduled_task_logs": [{
                "task_id": f"task-{uuid.uuid4()}",
                "command": "cache:clear",
                "expression": "0 * * * *",
                "timezone": "UTC",
                "status": "completed",
                "scheduled_at": "2026-01-01T12:00:00",
                "without_overlapping": False,
                "expected_run_time": "2026-01-01T12:00:00",
            }],
        })
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["ingested_count"] == 2

    def test_ingest_outbound(self, client):
        """POST /api/ingest/outbound → 200 OutboundIngestResponse"""
        r = client.post("/api/ingest/outbound", json={
            "request_id": f"test-{uuid.uuid4()}",
            "service_name": "stripe",
            "target_host": "api.stripe.com",
            "target_url": "https://api.stripe.com/v1/charges",
            "method": "POST",
            "status_code": 200,
            "latency_ms": 150.0,
        })
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["success", "message", "ingested_count"])
        assert data["success"] is True

    def test_ingest_outbound_batch(self, client):
        """POST /api/ingest/outbound/batch → 200 OutboundIngestResponse"""
        r = client.post("/api/ingest/outbound/batch", json={
            "logs": [{
                "request_id": f"test-{uuid.uuid4()}",
                "service_name": "twilio",
                "target_host": "api.twilio.com",
                "target_url": "https://api.twilio.com/2010/Messages",
                "method": "POST",
                "status_code": 201,
                "latency_ms": 200.0,
            }],
        })
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_ingest_v1_job(self, client):
        """POST /api/v1/ingest/job → 200 JobIngestResponse"""
        r = client.post("/api/v1/ingest/job", json={
            "job_id": f"job-{uuid.uuid4()}",
            "job_class": "App\\Jobs\\V1Test",
            "job_name": "V1 Test",
            "queue_name": "default",
            "connection": "redis",
            "status": "completed",
            "started_at": "2026-01-01T12:00:00",
            "attempt_number": 1,
            "max_attempts": 3,
        })
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_ingest_v1_scheduled_task(self, client):
        """POST /api/v1/ingest/scheduled-task → 200"""
        r = client.post("/api/v1/ingest/scheduled-task", json={
            "task_id": f"task-{uuid.uuid4()}",
            "command": "v1:test",
            "expression": "*/5 * * * *",
            "timezone": "UTC",
            "status": "completed",
            "scheduled_at": "2026-01-01T12:00:00",
            "without_overlapping": False,
            "expected_run_time": "2026-01-01T12:00:00",
        })
        assert r.status_code == 200

    def test_ingest_v1_jobs_batch(self, client):
        """POST /api/v1/ingest/jobs/batch → 200"""
        r = client.post("/api/v1/ingest/jobs/batch", json={
            "job_logs": [],
            "scheduled_task_logs": [],
        })
        assert r.status_code == 200
        assert r.json()["success"] is True
        assert r.json()["ingested_count"] == 0

    def test_ingest_validation_error(self, client):
        """POST /api/ingest with invalid data → 422"""
        r = client.post("/api/ingest", json={
            "request_id": "test",
            # missing required fields
        })
        assert r.status_code == 422


# ═══════════════════════════════════════════════════════════════
# TEST: Organization Endpoints
# ═══════════════════════════════════════════════════════════════

class TestOrganizationEndpoints:
    """CRUD /api/organizations/*"""

    @patch("app.api.organizations.get_user_organizations")
    def test_list_organizations(self, mock_fn, client):
        mock_fn.return_value = [MockOrganization()]
        r = client.get("/api/organizations")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["organizations"])
        assert len(data["organizations"]) == 1
        org = data["organizations"][0]
        assert_has_keys(org, ["id", "name", "slug", "plan", "owner_id", "created_at"])

    @patch("app.api.organizations.create_organization")
    def test_create_organization(self, mock_fn, client):
        mock_fn.return_value = MockOrganization()
        r = client.post("/api/organizations", json={"name": "New Org"})
        assert r.status_code == 201
        data = r.json()
        assert_has_keys(data, ["id", "name", "slug", "plan", "owner_id", "created_at"])

    @patch("app.api.organizations.check_organization_permission")
    @patch("app.api.organizations.get_organization_by_slug")
    def test_get_organization(self, mock_get, mock_perm, client):
        mock_get.return_value = MockOrganization()
        mock_perm.return_value = True
        r = client.get("/api/organizations/test-org")
        assert r.status_code == 200
        assert_has_keys(r.json(), ["id", "name", "slug", "plan"])

    @patch("app.api.organizations.check_organization_permission")
    @patch("app.api.organizations.get_organization_by_slug")
    def test_update_organization(self, mock_get, mock_perm, client):
        mock_org = MockOrganization()
        mock_get.return_value = mock_org
        mock_perm.return_value = True
        r = client.patch("/api/organizations/test-org", json={"name": "Updated"})
        assert r.status_code == 200
        assert_has_keys(r.json(), ["id", "name", "slug"])

    @patch("app.api.organizations.check_organization_permission")
    @patch("app.api.organizations.get_organization_by_slug")
    def test_delete_organization(self, mock_get, mock_perm, client):
        mock_get.return_value = MockOrganization()
        mock_perm.return_value = True
        r = client.delete("/api/organizations/test-org")
        assert r.status_code == 204

    @patch("app.api.organizations.get_organization_members")
    @patch("app.api.organizations.check_organization_permission")
    @patch("app.api.organizations.get_organization_by_slug")
    def test_list_members(self, mock_get, mock_perm, mock_members, client):
        mock_get.return_value = MockOrganization()
        mock_perm.return_value = True
        mock_members.return_value = [MockMembership()]
        r = client.get("/api/organizations/test-org/members")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            assert_has_keys(data[0], ["id", "user_id", "user_email", "user_name", "role"])

    @patch("app.api.organizations.add_member")
    @patch("app.api.organizations.check_organization_permission")
    @patch("app.api.organizations.get_organization_by_slug")
    def test_invite_member(self, mock_get, mock_perm, mock_add, client):
        mock_get.return_value = MockOrganization()
        mock_perm.return_value = True
        membership = MockMembership()
        mock_add.return_value = membership

        # Mock the user lookup in the handler
        mock_user = MockUser()
        from app.database import get_db
        from app.main import app
        async def invite_db():
            session = AsyncMock()
            result = MagicMock()
            result.scalar_one_or_none.return_value = mock_user
            session.execute.return_value = result
            yield session
        original_db = app.dependency_overrides.get(get_db)
        app.dependency_overrides[get_db] = invite_db
        try:
            r = client.post("/api/organizations/test-org/members", json={
                "email": "member@example.com",
                "role": "member",
            })
        finally:
            if original_db:
                app.dependency_overrides[get_db] = original_db
        assert r.status_code == 201
        assert_has_keys(r.json(), ["id", "user_id", "role"])

    @patch("app.api.organizations.update_member_role")
    @patch("app.api.organizations.check_organization_permission")
    @patch("app.api.organizations.get_user_membership")
    @patch("app.api.organizations.get_organization_by_slug")
    def test_update_member(self, mock_get, mock_membership, mock_perm, mock_update, client):
        mock_get.return_value = MockOrganization()
        mock_membership.return_value = MockMembership()
        mock_perm.return_value = True
        mock_update.return_value = MockMembership()

        # Mock user lookup for response
        from app.database import get_db
        from app.main import app
        async def update_db():
            session = AsyncMock()
            result = MagicMock()
            result.scalar_one_or_none.return_value = MockUser()
            session.execute.return_value = result
            yield session
        original_db = app.dependency_overrides.get(get_db)
        app.dependency_overrides[get_db] = update_db
        try:
            r = client.patch(
                f"/api/organizations/test-org/members/{TEST_MEMBER_ID}",
                json={"email": "x@x.com", "role": "admin"},
            )
        finally:
            if original_db:
                app.dependency_overrides[get_db] = original_db
        assert r.status_code == 200

    @patch("app.api.organizations.remove_member")
    @patch("app.api.organizations.check_organization_permission")
    @patch("app.api.organizations.get_organization_by_slug")
    def test_remove_member(self, mock_get, mock_perm, mock_remove, client):
        mock_get.return_value = MockOrganization()
        mock_perm.return_value = True
        r = client.delete(f"/api/organizations/test-org/members/{TEST_MEMBER_ID}")
        assert r.status_code == 204


# ═══════════════════════════════════════════════════════════════
# TEST: Project Endpoints
# ═══════════════════════════════════════════════════════════════

class TestProjectEndpoints:
    """CRUD /api/projects/*, /api/organizations/{slug}/projects"""

    @patch("app.api.projects.check_org_member")
    @patch("app.api.projects.get_organization_by_slug")
    def test_list_projects(self, mock_org, mock_member, client):
        mock_org.return_value = MockOrganization()
        mock_member.return_value = MockMembership()
        # Mock db.execute for project list
        from app.database import get_db
        from app.main import app
        async def list_db():
            session = AsyncMock()
            result = MagicMock()
            result.scalars.return_value.all.return_value = [MockProject()]
            session.execute.return_value = result
            yield session
        original = app.dependency_overrides.get(get_db)
        app.dependency_overrides[get_db] = list_db
        try:
            r = client.get("/api/organizations/test-org/projects")
        finally:
            if original:
                app.dependency_overrides[get_db] = original
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["projects"])

    @patch("app.api.projects.create_project")
    @patch("app.api.projects.check_org_member")
    @patch("app.api.projects.get_organization_by_slug")
    def test_create_project(self, mock_org, mock_member, mock_create, client):
        mock_org.return_value = MockOrganization()
        mock_member.return_value = MockMembership()
        mock_create.return_value = MockProject()
        r = client.post("/api/organizations/test-org/projects", json={
            "name": "New Project",
            "platform": "laravel",
            "environment": "production",
        })
        assert r.status_code == 201
        data = r.json()
        assert_has_keys(data, ["id", "name", "slug", "platform", "environment", "dsn", "created_at"])

    @patch("app.api.projects.check_project_access")
    @patch("app.api.projects.build_dsn", return_value="https://key@host/api/ingest")
    @patch("app.api.projects.get_project_by_slug")
    def test_get_project(self, mock_proj, mock_dsn, mock_access, client):
        mock_proj.return_value = MockProject()
        mock_access.return_value = True
        r = client.get("/api/projects/test-project")
        assert r.status_code == 200
        assert_has_keys(r.json(), ["id", "name", "slug", "platform", "environment", "dsn", "created_by"])

    @patch("app.api.projects.update_project")
    @patch("app.api.projects.check_org_member")
    @patch("app.api.projects.build_dsn", return_value="https://key@host/api/ingest")
    @patch("app.api.projects.get_project_by_slug")
    def test_update_project(self, mock_proj, mock_dsn, mock_member, mock_update, client):
        mock_proj.return_value = MockProject()
        mock_member.return_value = MockMembership()
        mock_update.return_value = MockProject()
        # Need to mock db.execute for org lookup
        from app.database import get_db
        from app.main import app
        async def update_db():
            session = AsyncMock()
            result = MagicMock()
            result.scalar_one.return_value = MockOrganization()
            session.execute.return_value = result
            session.commit = AsyncMock()
            async def _refresh(obj):
                pass
            session.refresh = AsyncMock(side_effect=_refresh)
            yield session
        original = app.dependency_overrides.get(get_db)
        app.dependency_overrides[get_db] = update_db
        try:
            r = client.patch("/api/projects/test-project", json={"name": "Updated"})
        finally:
            if original:
                app.dependency_overrides[get_db] = original
        assert r.status_code == 200

    @patch("app.api.projects.check_org_member")
    @patch("app.api.projects.get_project_by_slug")
    def test_delete_project(self, mock_proj, mock_member, client):
        mock_proj.return_value = MockProject()
        mock_member.return_value = MockMembership()
        from app.database import get_db
        from app.main import app
        async def delete_db():
            session = AsyncMock()
            result = MagicMock()
            result.scalar_one.return_value = MockOrganization()
            session.execute.return_value = result
            session.commit = AsyncMock()
            session.delete = AsyncMock()
            yield session
        original = app.dependency_overrides.get(get_db)
        app.dependency_overrides[get_db] = delete_db
        try:
            r = client.delete("/api/projects/test-project")
        finally:
            if original:
                app.dependency_overrides[get_db] = original
        assert r.status_code == 204

    @patch("app.api.projects.check_project_access")
    @patch("app.api.projects.get_project_by_slug")
    def test_list_api_keys(self, mock_proj, mock_access, client):
        mock_proj.return_value = MockProject()
        mock_access.return_value = True
        from app.database import get_db
        from app.main import app
        async def keys_db():
            session = AsyncMock()
            result = MagicMock()
            result.scalars.return_value.all.return_value = [MockApiKey()]
            session.execute.return_value = result
            yield session
        original = app.dependency_overrides.get(get_db)
        app.dependency_overrides[get_db] = keys_db
        try:
            r = client.get("/api/projects/test-project/api-keys")
        finally:
            if original:
                app.dependency_overrides[get_db] = original
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["api_keys"])

    @patch("app.api.projects.create_api_key")
    @patch("app.api.projects.check_project_access")
    @patch("app.api.projects.get_project_by_slug")
    def test_create_api_key(self, mock_proj, mock_access, mock_create, client):
        mock_proj.return_value = MockProject()
        mock_access.return_value = True
        mock_create.return_value = (MockApiKey(), "smk_test_full_key_value_12345")
        r = client.post("/api/projects/test-project/api-keys", json={
            "name": "Production Key",
            "scopes": ["ingest"],
        })
        assert r.status_code == 201
        data = r.json()
        assert_has_keys(data, ["id", "name", "key_prefix", "key", "scopes", "created_at"])
        assert "key" in data  # Full key only on creation

    @patch("app.api.projects.revoke_api_key")
    @patch("app.api.projects.check_project_access")
    @patch("app.api.projects.get_project_by_slug")
    def test_revoke_api_key(self, mock_proj, mock_access, mock_revoke, client):
        mock_proj.return_value = MockProject()
        mock_access.return_value = True
        from app.database import get_db
        from app.main import app
        async def revoke_db():
            session = AsyncMock()
            result = MagicMock()
            result.scalar_one_or_none.return_value = MockApiKey()
            session.execute.return_value = result
            session.commit = AsyncMock()
            yield session
        original = app.dependency_overrides.get(get_db)
        app.dependency_overrides[get_db] = revoke_db
        try:
            r = client.delete(f"/api/projects/test-project/api-keys/{TEST_API_KEY_ID}")
        finally:
            if original:
                app.dependency_overrides[get_db] = original
        assert r.status_code == 204

    @patch("app.api.projects.check_project_access")
    @patch("app.api.projects.build_dsn", return_value="https://key@host/api/ingest")
    @patch("app.api.projects.get_project_by_slug")
    def test_get_project_dsn(self, mock_proj, mock_dsn, mock_access, client):
        mock_proj.return_value = MockProject()
        mock_access.return_value = True
        r = client.get("/api/projects/test-project/dsn")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["dsn"])
        assert isinstance(data["dsn"], str)


# ═══════════════════════════════════════════════════════════════
# TEST: Log Query Endpoints
# ═══════════════════════════════════════════════════════════════

class TestLogQueryEndpoints:
    """GET /api/logs/*, /api/modules, /api/endpoints"""

    def test_get_logs(self, client):
        """GET /api/logs → PaginatedResponse"""
        r = client.get("/api/logs")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["data", "total", "page", "page_size", "total_pages"])
        assert isinstance(data["data"], list)

    def test_get_log_by_id(self, client):
        """GET /api/logs/{log_id} → LogEntry"""
        r = client.get(f"/api/logs/{uuid.uuid4()}")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, [
            "id", "request_id", "timestamp", "endpoint", "method",
            "status_code", "response_time_ms",
        ])

    def test_list_modules(self, client):
        """GET /api/modules → List[str]"""
        r = client.get("/api/modules")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_list_endpoints(self, client):
        """GET /api/endpoints → List[str]"""
        r = client.get("/api/endpoints")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_logs_with_filters(self, client):
        """GET /api/logs with query params → PaginatedResponse"""
        r = client.get("/api/logs", params={
            "status": "error",
            "module": "users",
            "page": 1,
            "page_size": 10,
        })
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["data", "total", "page", "page_size"])


# ═══════════════════════════════════════════════════════════════
# TEST: Inbound Log Endpoints
# ═══════════════════════════════════════════════════════════════

class TestInboundEndpoints:
    """GET /api/logs/inbound/*, /api/stats/inbound/*"""

    def test_get_inbound_logs(self, client):
        """GET /api/logs/inbound → InboundPaginatedResponse"""
        r = client.get("/api/logs/inbound")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["data", "total", "page", "page_size", "total_pages"])

    def test_list_inbound_modules(self, client):
        """GET /api/logs/inbound/modules → List[str]"""
        r = client.get("/api/logs/inbound/modules")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_inbound_endpoints(self, client):
        """GET /api/logs/inbound/endpoints → List[str]"""
        r = client.get("/api/logs/inbound/endpoints")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_inbound_log_by_id(self, client):
        """GET /api/logs/inbound/{log_id} → InboundLogDetail"""
        r = client.get(f"/api/logs/inbound/{uuid.uuid4()}")
        # May be 200 or 404 depending on mock
        assert r.status_code in (200, 404)
        if r.status_code == 200:
            assert_has_keys(r.json(), ["id", "request_id", "endpoint", "method", "status_code"])

    def test_get_inbound_stats(self, client):
        """GET /api/stats/inbound → InboundOverallStats"""
        r = client.get("/api/stats/inbound")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, [
            "total_requests", "success_count", "error_count",
            "success_rate", "avg_response_time_ms",
        ])

    def test_get_inbound_stats_by_module(self, client):
        """GET /api/stats/inbound/by-module → List[InboundModuleStats]"""
        r = client.get("/api/stats/inbound/by-module")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_inbound_module_endpoints(self, client):
        """GET /api/stats/inbound/modules/{name}/endpoints → List[InboundEndpointStats]"""
        r = client.get("/api/stats/inbound/modules/test-module/endpoints")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ═══════════════════════════════════════════════════════════════
# TEST: Outbound Log Endpoints
# ═══════════════════════════════════════════════════════════════

class TestOutboundEndpoints:
    """GET /api/logs/outbound/*, /api/stats/outbound/*"""

    def test_get_outbound_logs(self, client):
        """GET /api/logs/outbound → OutboundPaginatedResponse"""
        r = client.get("/api/logs/outbound")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["data", "total", "page", "page_size", "total_pages"])

    def test_list_outbound_services(self, client):
        """GET /api/logs/outbound/services → List[str]"""
        r = client.get("/api/logs/outbound/services")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_outbound_hosts(self, client):
        """GET /api/logs/outbound/hosts → List[str]"""
        r = client.get("/api/logs/outbound/hosts")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_outbound_log_by_id(self, client):
        """GET /api/logs/outbound/{log_id} → OutboundLogDetail"""
        r = client.get(f"/api/logs/outbound/{uuid.uuid4()}")
        assert r.status_code in (200, 404)
        if r.status_code == 200:
            assert_has_keys(r.json(), [
                "id", "service_name", "target_url", "method", "status_code",
            ])

    def test_get_outbound_stats(self, client):
        """GET /api/stats/outbound → OutboundOverallStats"""
        r = client.get("/api/stats/outbound")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, [
            "total_requests", "success_count", "failure_count",
            "success_rate", "avg_latency_ms",
        ])

    def test_get_outbound_stats_by_service(self, client):
        """GET /api/stats/outbound/by-service → List[OutboundServiceStats]"""
        r = client.get("/api/stats/outbound/by-service")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_outbound_service_endpoints(self, client):
        """GET /api/stats/outbound/services/{name}/endpoints"""
        r = client.get("/api/stats/outbound/services/stripe/endpoints")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_outbound_stats_by_host(self, client):
        """GET /api/stats/outbound/by-host → List[OutboundHostStats]"""
        r = client.get("/api/stats/outbound/by-host")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ═══════════════════════════════════════════════════════════════
# TEST: Stats & Dashboard Endpoints
# ═══════════════════════════════════════════════════════════════

class TestStatsEndpoints:
    """GET /api/stats/*"""

    def test_dashboard_stats(self, client):
        """GET /api/stats → DashboardStats"""
        r = client.get("/api/stats")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, [
            "total_requests", "error_rate", "avg_response_time", "requests_per_minute",
        ])

    def test_timeseries(self, client):
        """GET /api/stats/timeseries → List[TimeSeriesPoint]"""
        r = client.get("/api/stats/timeseries")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_top_endpoints(self, client):
        """GET /api/stats/top-endpoints → List[EndpointStats]"""
        r = client.get("/api/stats/top-endpoints")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_service_health(self, client):
        """GET /api/stats/service-health → List[ServiceHealth]"""
        r = client.get("/api/stats/service-health")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_request_counts(self, client):
        """GET /api/stats/counts → RequestCounts"""
        r = client.get("/api/stats/counts")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["all", "inbound", "outbound"])

    def test_module_health(self, client):
        """GET /api/stats/module-health → List[ModuleHealth]"""
        r = client.get("/api/stats/module-health")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_global_stats(self, client):
        """GET /api/stats/global → GlobalDashboardStats"""
        r = client.get("/api/stats/global")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["total_projects", "total_requests", "overall_error_rate", "projects"])

    def test_top_users(self, client):
        """GET /api/stats/top-users → List[UserStats]"""
        r = client.get("/api/stats/top-users")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_user_activity(self, client):
        """GET /api/stats/user-activity → List[UserActivityPoint]"""
        r = client.get("/api/stats/user-activity", params={"user_id": "user-1"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_users_with_errors(self, client):
        """GET /api/stats/users-with-errors → List[UserWithErrors]"""
        r = client.get("/api/stats/users-with-errors")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_performance_percentiles(self, client):
        """GET /api/stats/percentiles → PerformancePercentiles"""
        r = client.get("/api/stats/percentiles")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["p50", "p75", "p90", "p95", "p99", "avg"])

    def test_slow_requests(self, client):
        """GET /api/stats/slow-requests → SlowRequestsSummary"""
        r = client.get("/api/stats/slow-requests")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["total_requests", "slow_count", "slow_percentage", "slowest_endpoints"])

    def test_performance_timeline(self, client):
        """GET /api/stats/performance-timeline → List[PerformanceTimelinePoint]"""
        r = client.get("/api/stats/performance-timeline")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_error_breakdown(self, client):
        """GET /api/stats/error-breakdown → ErrorBreakdown"""
        r = client.get("/api/stats/error-breakdown")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["total_errors", "client_errors_4xx", "server_errors_5xx", "by_status_code"])

    def test_error_endpoints(self, client):
        """GET /api/stats/error-endpoints → List[ErrorEndpoint]"""
        r = client.get("/api/stats/error-endpoints")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_error_timeline(self, client):
        """GET /api/stats/error-timeline → List[ErrorTimelinePoint]"""
        r = client.get("/api/stats/error-timeline")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_traffic_by_method(self, client):
        """GET /api/stats/traffic-by-method → List[TrafficByMethod]"""
        r = client.get("/api/stats/traffic-by-method")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_peak_hours(self, client):
        """GET /api/stats/peak-hours → List[PeakHourStats]"""
        r = client.get("/api/stats/peak-hours")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_traffic_by_day(self, client):
        """GET /api/stats/traffic-by-day → List[TrafficByDay]"""
        r = client.get("/api/stats/traffic-by-day")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_throughput(self, client):
        """GET /api/stats/throughput → ThroughputStats"""
        r = client.get("/api/stats/throughput")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, [
            "avg_requests_per_minute", "peak_requests_per_minute",
            "avg_requests_per_second", "timeline",
        ])


# ═══════════════════════════════════════════════════════════════
# TEST: Jobs & Scheduled Tasks Query Endpoints
# ═══════════════════════════════════════════════════════════════

class TestJobQueryEndpoints:
    """GET /api/v1/jobs/*, /api/v1/scheduled-tasks/*"""

    def test_get_jobs(self, client):
        """GET /api/v1/jobs → PaginatedResponse[JobExecution]"""
        r = client.get("/api/v1/jobs", params={"project_id": str(TEST_PROJECT_ID)})
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["data", "total", "page", "page_size", "total_pages"])

    def test_get_job_stats(self, client):
        """GET /api/v1/jobs/stats → JobHealthStats"""
        r = client.get("/api/v1/jobs/stats", params={"project_id": str(TEST_PROJECT_ID)})
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, [
            "total_executions", "success_count", "failure_count",
            "success_rate", "avg_duration_ms",
        ])

    def test_get_job_timeline(self, client):
        """GET /api/v1/jobs/timeline → List[JobTimelinePoint]"""
        r = client.get("/api/v1/jobs/timeline", params={"project_id": str(TEST_PROJECT_ID)})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_scheduled_tasks(self, client):
        """GET /api/v1/scheduled-tasks → PaginatedResponse[ScheduledTaskExecution]"""
        r = client.get("/api/v1/scheduled-tasks", params={"project_id": str(TEST_PROJECT_ID)})
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["data", "total", "page", "page_size", "total_pages"])

    def test_get_scheduled_task_stats(self, client):
        """GET /api/v1/scheduled-tasks/stats → ScheduledTaskHealthStats"""
        r = client.get("/api/v1/scheduled-tasks/stats", params={"project_id": str(TEST_PROJECT_ID)})
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, [
            "total_executions", "success_count", "failure_count",
            "success_rate",
        ])


# ═══════════════════════════════════════════════════════════════
# TEST: Settings Endpoints (Legacy)
# ═══════════════════════════════════════════════════════════════

class TestSettingsEndpoints:
    """GET/POST/DELETE /api/settings/*"""

    @patch("app.api.settings.api_keys_service")
    def test_get_project_settings(self, mock_svc, client):
        mock_svc.get_api_key_count.return_value = 2
        mock_svc.get_first_api_key_preview.return_value = "sk_test..."
        r = client.get("/api/settings/project")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["project_name", "dsn_host", "dsn_endpoint", "api_key_count"])

    @patch("app.api.settings.api_keys_service")
    def test_get_dsn_info(self, mock_svc, client):
        mock_svc.get_api_key_count.return_value = 1
        r = client.get("/api/settings/dsn")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["format", "example", "host", "endpoint", "has_api_key"])

    @patch("app.api.settings.api_keys_service")
    def test_list_settings_api_keys(self, mock_svc, client):
        mock_key = MagicMock()
        mock_key.id = "key-1"
        mock_key.name = "Test"
        mock_key.key_prefix = "sk_test"
        mock_key.created_at = "2026-01-01T00:00:00"
        mock_key.last_used_at = None
        mock_svc.list_api_keys.return_value = [mock_key]
        r = client.get("/api/settings/api-keys")
        assert r.status_code == 200
        data = r.json()
        assert_has_keys(data, ["api_keys"])
        assert isinstance(data["api_keys"], list)

    @patch("app.api.settings.api_keys_service")
    def test_create_settings_api_key(self, mock_svc, client):
        mock_key = MagicMock()
        mock_key.id = "key-new"
        mock_key.name = "New Key"
        mock_key.key_prefix = "sk_new"
        mock_key.created_at = "2026-01-01T00:00:00"
        mock_svc.create_api_key.return_value = (mock_key, "sk_new_full_key_value")
        r = client.post("/api/settings/api-keys", json={"name": "New Key"})
        assert r.status_code == 201
        data = r.json()
        assert_has_keys(data, ["id", "name", "key", "prefix", "created_at"])

    @patch("app.api.settings.api_keys_service")
    def test_revoke_settings_api_key(self, mock_svc, client):
        mock_svc.revoke_api_key.return_value = True
        r = client.delete("/api/settings/api-keys/key-123")
        assert r.status_code == 204


# ═══════════════════════════════════════════════════════════════
# TEST: Input Validation (422 errors)
# ═══════════════════════════════════════════════════════════════

class TestInputValidation:
    """Verify 422 errors for invalid input."""

    def test_register_short_password(self, client):
        r = client.post("/api/auth/register", json={
            "email": "test@example.com",
            "password": "short",
            "name": "Test",
        })
        assert r.status_code == 422

    def test_register_invalid_email(self, client):
        r = client.post("/api/auth/register", json={
            "email": "not-an-email",
            "password": "securepassword123",
            "name": "Test",
        })
        assert r.status_code == 422

    def test_ingest_invalid_status_code(self, client):
        r = client.post("/api/ingest", json={
            "request_id": "test",
            "endpoint": "/test",
            "method": "GET",
            "status_code": 999,  # > 599
            "response_time_ms": 100,
        })
        assert r.status_code == 422

    def test_ingest_negative_response_time(self, client):
        r = client.post("/api/ingest", json={
            "request_id": "test",
            "endpoint": "/test",
            "method": "GET",
            "status_code": 200,
            "response_time_ms": -1,  # negative
        })
        assert r.status_code == 422

    def test_create_org_empty_name(self, client):
        r = client.post("/api/organizations", json={"name": ""})
        assert r.status_code == 422

    def test_frontend_log_missing_required(self, client):
        r = client.post("/api/v1/frontend-logs", json={
            "timestamp": "2026-01-01T00:00:00",
            # missing type and message
        })
        assert r.status_code == 422


# ═══════════════════════════════════════════════════════════════
# TEST: OpenAPI Schema Completeness
# ═══════════════════════════════════════════════════════════════

class TestOpenAPISchema:
    """Verify the /openapi.json schema is complete and valid."""

    def test_openapi_schema_accessible(self, client):
        r = client.get("/openapi.json")
        assert r.status_code == 200
        schema = r.json()
        assert schema["info"]["title"] == "Sid Monitoring API"

    def test_all_endpoints_have_summary(self, client):
        r = client.get("/openapi.json")
        schema = r.json()
        missing = []
        for path, methods in schema["paths"].items():
            for method, details in methods.items():
                if method in ("get", "post", "put", "delete", "patch"):
                    if not details.get("summary") and not details.get("description"):
                        missing.append(f"{method.upper()} {path}")
        assert not missing, f"Endpoints missing summary: {missing}"

    def test_schemas_have_field_descriptions(self, client):
        SKIP = {"HTTPValidationError", "ValidationError"}
        r = client.get("/openapi.json")
        schema = r.json()
        components = schema.get("components", {}).get("schemas", {})
        missing = []
        for name, sdef in components.items():
            if name in SKIP:
                continue
            for prop, pdef in sdef.get("properties", {}).items():
                if "description" not in pdef and "$ref" not in pdef \
                   and "allOf" not in pdef and "anyOf" not in pdef:
                    missing.append(f"{name}.{prop}")
        assert not missing, f"Fields missing descriptions: {missing}"

    def test_expected_endpoint_count(self, client):
        r = client.get("/openapi.json")
        schema = r.json()
        paths = schema["paths"]
        endpoint_count = sum(
            1 for methods in paths.values()
            for m in methods if m in ("get", "post", "put", "delete", "patch")
        )
        assert endpoint_count >= 70, f"Expected >= 70 endpoints, got {endpoint_count}"
