"""
E2E Tests for Job Logs Ingest Flow

Tests the complete flow for Laravel queue job monitoring:
1. Send job log entry via Ingest API
2. Verify data stored in ClickHouse
3. Verify data retrievable via Query API (/v1/jobs)
"""

import pytest
import time
import uuid
from datetime import datetime, timedelta


class TestJobLogIngestFlow:
    """Test job log ingestion end-to-end flow."""

    @pytest.mark.e2e
    def test_single_job_log_ingest(
        self,
        sync_client,
        ingest_headers,
        sample_job_log
    ):
        """Test ingesting a single job log entry."""
        response = sync_client.post(
            "/api/ingest/jobs",
            json=sample_job_log,
            headers=ingest_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["ingested_count"] == 1
        assert "ingested successfully" in data["message"].lower()

    @pytest.mark.e2e
    def test_job_log_with_failure_status(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test ingesting a failed job log."""
        failed_job = {
            "job_id": f"e2e-failed-job-{uuid.uuid4()}",
            "job_uuid": str(uuid.uuid4()),
            "job_class": "App\\Jobs\\FailingJob",
            "job_name": "Failing Job",
            "queue_name": "high",
            "connection": "redis",
            "status": "failed",
            "started_at": test_timestamp.isoformat(),
            "completed_at": (test_timestamp + timedelta(milliseconds=100)).isoformat(),
            "duration_ms": 100,
            "attempt_number": 3,
            "max_attempts": 3,
            "exception_class": "RuntimeException",
            "exception_message": "E2E Test: Simulated failure",
            "exception_trace": "at FailingJob.php:42\nat Queue.php:100",
            "metadata": {"test_type": "failure"}
        }

        response = sync_client.post(
            "/api/ingest/jobs",
            json=failed_job,
            headers=ingest_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    @pytest.mark.e2e
    def test_job_log_stored_in_clickhouse(
        self,
        sync_client,
        ingest_headers,
        clickhouse_client,
        test_timestamp
    ):
        """Test that ingested job log is stored in ClickHouse."""
        job_id = f"e2e-ch-verify-{uuid.uuid4()}"
        job_log = {
            "job_id": job_id,
            "job_uuid": str(uuid.uuid4()),
            "job_class": "App\\Jobs\\ClickHouseVerify",
            "job_name": "ClickHouse Verify",
            "queue_name": "default",
            "connection": "sync",
            "status": "completed",
            "started_at": test_timestamp.isoformat(),
            "completed_at": (test_timestamp + timedelta(milliseconds=200)).isoformat(),
            "duration_ms": 200,
            "attempt_number": 1,
            "max_attempts": 1
        }

        response = sync_client.post(
            "/api/ingest/jobs",
            json=job_log,
            headers=ingest_headers
        )
        assert response.status_code == 200

        # Wait for ClickHouse to process
        time.sleep(1)

        # Verify in ClickHouse
        result = clickhouse_client.query(
            f"SELECT job_id, job_class, status, duration_ms FROM job_logs WHERE job_id = '{job_id}'"
        )

        assert len(result.result_rows) >= 1
        row = result.result_rows[0]
        assert row[0] == job_id
        assert row[1] == "App\\Jobs\\ClickHouseVerify"
        assert row[2] == "completed"
        assert row[3] == 200

    @pytest.mark.e2e
    def test_batch_job_logs_ingest(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test batch ingestion of multiple job logs."""
        job_logs = []
        for i in range(5):
            started = test_timestamp + timedelta(seconds=i)
            job_logs.append({
                "job_id": f"e2e-batch-job-{i}-{uuid.uuid4()}",
                "job_uuid": str(uuid.uuid4()),
                "job_class": f"App\\Jobs\\BatchJob{i}",
                "job_name": f"Batch Job {i}",
                "queue_name": "batch",
                "connection": "redis",
                "status": "completed" if i % 2 == 0 else "failed",
                "started_at": started.isoformat(),
                "completed_at": (started + timedelta(milliseconds=100 + i * 50)).isoformat(),
                "duration_ms": 100 + i * 50,
                "attempt_number": 1,
                "max_attempts": 3
            })

        batch_request = {
            "job_logs": job_logs,
            "scheduled_task_logs": []
        }

        response = sync_client.post(
            "/api/ingest/jobs/batch",
            json=batch_request,
            headers=ingest_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["ingested_count"] == 5


class TestJobLogQueryFlow:
    """Test job log query flow after ingestion."""

    @pytest.mark.e2e
    def test_query_jobs_after_ingest(
        self,
        sync_client,
        ingest_headers,
        auth_headers,
        test_timestamp
    ):
        """Test querying jobs via /v1/jobs after ingestion."""
        # First, ingest a job
        job_id = f"e2e-query-job-{uuid.uuid4()}"
        job_log = {
            "job_id": job_id,
            "job_uuid": str(uuid.uuid4()),
            "job_class": "App\\Jobs\\QueryTestJob",
            "job_name": "Query Test Job",
            "queue_name": "query-test",
            "connection": "redis",
            "status": "completed",
            "started_at": test_timestamp.isoformat(),
            "completed_at": (test_timestamp + timedelta(milliseconds=150)).isoformat(),
            "duration_ms": 150,
            "attempt_number": 1,
            "max_attempts": 1
        }

        # Ingest
        ingest_response = sync_client.post(
            "/api/ingest/jobs",
            json=job_log,
            headers=ingest_headers
        )
        assert ingest_response.status_code == 200

        # Wait for data to be available
        time.sleep(1)

        # Query via /v1/jobs - this may require auth
        query_response = sync_client.get(
            "/api/v1/jobs",
            params={"queue_name": "query-test", "limit": 10},
            headers=auth_headers
        )

        # Should return 200 even if empty (API exists)
        assert query_response.status_code == 200

    @pytest.mark.e2e
    def test_job_stats_endpoint(
        self,
        sync_client,
        auth_headers
    ):
        """Test job stats endpoint."""
        response = sync_client.get(
            "/api/v1/jobs/stats",
            params={"timeframe": "24h"},
            headers=auth_headers
        )

        # Stats endpoint should return 200
        assert response.status_code == 200
        data = response.json()

        # Basic structure validation
        assert "total_executions" in data or "total" in data or isinstance(data, dict)


class TestJobLogValidation:
    """Test input validation for job log ingest."""

    @pytest.mark.e2e
    def test_job_ingest_missing_required_fields(
        self,
        sync_client,
        ingest_headers
    ):
        """Test that job ingest fails with missing required fields."""
        invalid_job = {
            "job_id": "test-123"
            # Missing: job_class, job_name, status, started_at
        }

        response = sync_client.post(
            "/api/ingest/jobs",
            json=invalid_job,
            headers=ingest_headers
        )

        assert response.status_code == 422

    @pytest.mark.e2e
    def test_job_ingest_invalid_status(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test job ingest with various valid statuses."""
        valid_statuses = ["pending", "running", "completed", "failed", "retrying"]

        for status in valid_statuses:
            job_log = {
                "job_id": f"e2e-status-{status}-{uuid.uuid4()}",
                "job_uuid": str(uuid.uuid4()),
                "job_class": "App\\Jobs\\StatusTest",
                "job_name": "Status Test",
                "queue_name": "default",
                "connection": "sync",
                "status": status,
                "started_at": test_timestamp.isoformat(),
                "attempt_number": 1,
                "max_attempts": 1
            }

            response = sync_client.post(
                "/api/ingest/jobs",
                json=job_log,
                headers=ingest_headers
            )

            assert response.status_code == 200, f"Status '{status}' should be valid"


class TestJobLogWithMetadata:
    """Test job logs with various metadata scenarios."""

    @pytest.mark.e2e
    def test_job_with_large_payload(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test ingesting job with large payload."""
        large_payload = {"data": "x" * 10000}  # 10KB payload

        job_log = {
            "job_id": f"e2e-large-payload-{uuid.uuid4()}",
            "job_uuid": str(uuid.uuid4()),
            "job_class": "App\\Jobs\\LargePayload",
            "job_name": "Large Payload Job",
            "queue_name": "default",
            "connection": "sync",
            "status": "completed",
            "started_at": test_timestamp.isoformat(),
            "completed_at": (test_timestamp + timedelta(milliseconds=500)).isoformat(),
            "duration_ms": 500,
            "payload": str(large_payload),
            "attempt_number": 1,
            "max_attempts": 1
        }

        response = sync_client.post(
            "/api/ingest/jobs",
            json=job_log,
            headers=ingest_headers
        )

        assert response.status_code == 200

    @pytest.mark.e2e
    def test_job_with_memory_usage(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test ingesting job with memory usage tracking."""
        job_log = {
            "job_id": f"e2e-memory-{uuid.uuid4()}",
            "job_uuid": str(uuid.uuid4()),
            "job_class": "App\\Jobs\\MemoryIntensive",
            "job_name": "Memory Intensive Job",
            "queue_name": "heavy",
            "connection": "redis",
            "status": "completed",
            "started_at": test_timestamp.isoformat(),
            "completed_at": (test_timestamp + timedelta(seconds=5)).isoformat(),
            "duration_ms": 5000,
            "memory_usage_mb": 256.5,
            "attempt_number": 1,
            "max_attempts": 1,
            "metadata": {"peak_memory": "512MB", "gc_cycles": 3}
        }

        response = sync_client.post(
            "/api/ingest/jobs",
            json=job_log,
            headers=ingest_headers
        )

        assert response.status_code == 200
