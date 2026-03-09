"""
E2E Test Configuration for SidMonitor

This module provides fixtures and configuration for end-to-end testing
of the entire flow: SDK -> Backend Ingest -> ClickHouse -> Query APIs
"""

import os
import uuid
import pytest
import httpx
from datetime import datetime, timedelta
from typing import Generator, AsyncGenerator
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '../../backend/.env'))

# Test configuration
BASE_URL = os.getenv("TEST_API_URL", "http://localhost:8030")
API_KEY = os.getenv("TEST_API_KEY", os.getenv("INGEST_API_KEYS", "test-api-key").split(",")[0])
AUTH_USERNAME = os.getenv("AUTH_USERNAME", "admin")
AUTH_PASSWORD = os.getenv("AUTH_PASSWORD", "changeme")

# ClickHouse configuration for direct verification
CLICKHOUSE_HOST = os.getenv("CLICKHOUSE_HOST", "localhost")
CLICKHOUSE_PORT = int(os.getenv("CLICKHOUSE_PORT", "8123"))
CLICKHOUSE_DATABASE = os.getenv("CLICKHOUSE_DATABASE", "sid_monitoring")
CLICKHOUSE_USER = os.getenv("CLICKHOUSE_USER", "default")
CLICKHOUSE_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "")


@pytest.fixture(scope="session")
def api_base_url() -> str:
    """Return the base URL for API calls."""
    return BASE_URL


@pytest.fixture(scope="session")
def api_key() -> str:
    """Return the API key for ingest endpoints."""
    return API_KEY


@pytest.fixture(scope="session")
def auth_headers() -> dict:
    """Return basic auth headers for authenticated endpoints."""
    import base64
    credentials = base64.b64encode(f"{AUTH_USERNAME}:{AUTH_PASSWORD}".encode()).decode()
    return {"Authorization": f"Basic {credentials}"}


@pytest.fixture(scope="session")
def ingest_headers(api_key: str) -> dict:
    """Return headers for ingest API calls."""
    return {
        "X-API-Key": api_key,
        "Content-Type": "application/json"
    }


@pytest.fixture
def unique_request_id() -> str:
    """Generate a unique request ID for test isolation."""
    return f"e2e-test-{uuid.uuid4()}"


@pytest.fixture
def test_timestamp() -> datetime:
    """Return current timestamp for test data."""
    return datetime.utcnow()


@pytest.fixture
def sample_inbound_log(unique_request_id: str, test_timestamp: datetime) -> dict:
    """Generate a sample inbound log entry."""
    return {
        "request_id": unique_request_id,
        "timestamp": test_timestamp.isoformat(),
        "endpoint": "/api/test/endpoint",
        "method": "POST",
        "status_code": 200,
        "response_time_ms": 150.5,
        "user_id": "test-user-123",
        "user_name": "Test User",
        "module": "e2e-testing",
        "tags": ["e2e", "automated-test"],
        "request_body": '{"test": "data"}',
        "response_body": '{"success": true}'
    }


@pytest.fixture
def sample_outbound_log(unique_request_id: str, test_timestamp: datetime) -> dict:
    """Generate a sample outbound log entry."""
    return {
        "request_id": unique_request_id,
        "timestamp": test_timestamp.isoformat(),
        "endpoint": "https://api.stripe.com/v1/charges",
        "method": "POST",
        "status_code": 201,
        "response_time_ms": 320.8,
        "third_party_service": "stripe",
        "user_id": "test-user-123",
        "user_name": "Test User",
        "module": "payments",
        "tags": ["payment", "stripe"],
        "request_body": '{"amount": 1000}',
        "response_body": '{"id": "ch_xxx"}'
    }


@pytest.fixture
def sample_job_log(test_timestamp: datetime) -> dict:
    """Generate a sample job log entry."""
    job_id = f"e2e-job-{uuid.uuid4()}"
    started_at = test_timestamp
    completed_at = started_at + timedelta(milliseconds=500)

    return {
        "job_id": job_id,
        "job_uuid": str(uuid.uuid4()),
        "job_class": "App\\Jobs\\ProcessE2ETest",
        "job_name": "Process E2E Test",
        "queue_name": "default",
        "connection": "redis",
        "status": "completed",
        "started_at": started_at.isoformat(),
        "completed_at": completed_at.isoformat(),
        "duration_ms": 500,
        "payload": '{"test_id": "e2e-001"}',
        "attempt_number": 1,
        "max_attempts": 3,
        "user_id": "test-user-123",
        "memory_usage_mb": 25.5,
        "metadata": {"source": "e2e-test"}
    }


@pytest.fixture
def sample_scheduled_task_log(test_timestamp: datetime) -> dict:
    """Generate a sample scheduled task log entry."""
    task_id = f"e2e-task-{uuid.uuid4()}"
    scheduled_at = test_timestamp
    started_at = scheduled_at + timedelta(milliseconds=100)
    completed_at = started_at + timedelta(milliseconds=300)

    return {
        "task_id": task_id,
        "command": "e2e:test-command",
        "description": "E2E Test Scheduled Task",
        "expression": "* * * * *",
        "timezone": "UTC",
        "status": "completed",
        "scheduled_at": scheduled_at.isoformat(),
        "started_at": started_at.isoformat(),
        "completed_at": completed_at.isoformat(),
        "duration_ms": 300,
        "exit_code": 0,
        "output": "E2E test executed successfully",
        "without_overlapping": False,
        "expected_run_time": scheduled_at.isoformat(),
        "delay_ms": 100,
        "metadata": {"source": "e2e-test"}
    }


@pytest.fixture
def clickhouse_client():
    """Get ClickHouse client for direct verification."""
    try:
        import clickhouse_connect
        client = clickhouse_connect.get_client(
            host=CLICKHOUSE_HOST,
            port=CLICKHOUSE_PORT,
            database=CLICKHOUSE_DATABASE,
            username=CLICKHOUSE_USER,
            password=CLICKHOUSE_PASSWORD,
        )
        yield client
    except Exception as e:
        pytest.skip(f"ClickHouse not available: {e}")


@pytest.fixture
async def async_client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """Create an async HTTP client for API calls."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        yield client


@pytest.fixture
def sync_client() -> Generator[httpx.Client, None, None]:
    """Create a sync HTTP client for API calls."""
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        yield client


# Pytest configuration
def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line(
        "markers", "e2e: mark test as end-to-end test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )
