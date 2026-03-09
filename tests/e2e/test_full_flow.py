"""
E2E Tests for Full Flow

Tests the complete end-to-end flow:
SDK -> Backend Ingest -> ClickHouse Storage -> Query APIs -> Stats APIs

This file contains integration tests that verify the entire system works together.
"""

import pytest
import time
import uuid
from datetime import datetime, timedelta


class TestFullIngestToQueryFlow:
    """Test complete flow from ingestion to query retrieval."""

    @pytest.mark.e2e
    @pytest.mark.slow
    def test_inbound_log_full_flow(
        self,
        sync_client,
        ingest_headers,
        auth_headers,
        clickhouse_client,
        test_timestamp
    ):
        """
        Full E2E test for inbound log:
        1. Ingest via API
        2. Verify in ClickHouse
        3. Query via Logs API
        """
        # Generate unique identifiable data
        unique_module = f"e2e-full-flow-{uuid.uuid4().hex[:8]}"
        request_id = f"e2e-full-{uuid.uuid4()}"

        log_entry = {
            "request_id": request_id,
            "timestamp": test_timestamp.isoformat(),
            "endpoint": "/api/full-flow/test",
            "method": "POST",
            "status_code": 201,
            "response_time_ms": 175.5,
            "user_id": "full-flow-user",
            "user_name": "Full Flow Tester",
            "module": unique_module,
            "tags": ["e2e", "full-flow", "integration"]
        }

        # Step 1: Ingest
        ingest_response = sync_client.post(
            "/api/ingest",
            json=log_entry,
            headers=ingest_headers
        )
        assert ingest_response.status_code == 200
        assert ingest_response.json()["success"] is True

        # Step 2: Wait and verify in ClickHouse
        time.sleep(2)

        ch_result = clickhouse_client.query(
            f"SELECT request_id, endpoint, module, status_code "
            f"FROM logs WHERE request_id = '{request_id}'"
        )
        assert len(ch_result.result_rows) >= 1
        row = ch_result.result_rows[0]
        assert row[0] == request_id
        assert row[1] == "/api/full-flow/test"
        assert row[2] == unique_module

        # Step 3: Query via Logs API
        query_response = sync_client.get(
            "/api/logs",
            params={"module": unique_module, "limit": 10},
            headers=auth_headers
        )
        assert query_response.status_code == 200

    @pytest.mark.e2e
    @pytest.mark.slow
    def test_job_log_full_flow(
        self,
        sync_client,
        ingest_headers,
        auth_headers,
        clickhouse_client,
        test_timestamp
    ):
        """
        Full E2E test for job log:
        1. Ingest via API
        2. Verify in ClickHouse
        3. Query via Jobs API
        """
        job_id = f"e2e-full-job-{uuid.uuid4()}"
        unique_queue = f"e2e-queue-{uuid.uuid4().hex[:8]}"

        job_log = {
            "job_id": job_id,
            "job_uuid": str(uuid.uuid4()),
            "job_class": "App\\Jobs\\FullFlowTest",
            "job_name": "Full Flow Test Job",
            "queue_name": unique_queue,
            "connection": "redis",
            "status": "completed",
            "started_at": test_timestamp.isoformat(),
            "completed_at": (test_timestamp + timedelta(milliseconds=300)).isoformat(),
            "duration_ms": 300,
            "attempt_number": 1,
            "max_attempts": 3,
            "user_id": "full-flow-user",
            "memory_usage_mb": 45.2
        }

        # Step 1: Ingest
        ingest_response = sync_client.post(
            "/api/ingest/jobs",
            json=job_log,
            headers=ingest_headers
        )
        assert ingest_response.status_code == 200

        # Step 2: Wait and verify in ClickHouse
        time.sleep(2)

        ch_result = clickhouse_client.query(
            f"SELECT job_id, queue_name, status, duration_ms "
            f"FROM job_logs WHERE job_id = '{job_id}'"
        )
        assert len(ch_result.result_rows) >= 1
        row = ch_result.result_rows[0]
        assert row[0] == job_id
        assert row[1] == unique_queue
        assert row[2] == "completed"
        assert row[3] == 300

        # Step 3: Query via Jobs API
        query_response = sync_client.get(
            "/api/v1/jobs",
            params={"queue_name": unique_queue, "limit": 10},
            headers=auth_headers
        )
        assert query_response.status_code == 200

    @pytest.mark.e2e
    @pytest.mark.slow
    def test_scheduled_task_full_flow(
        self,
        sync_client,
        ingest_headers,
        auth_headers,
        clickhouse_client,
        test_timestamp
    ):
        """
        Full E2E test for scheduled task:
        1. Ingest via API
        2. Verify in ClickHouse
        3. Query via Scheduled Tasks API
        """
        task_id = f"e2e-full-task-{uuid.uuid4()}"
        unique_command = f"e2e:full-flow-{uuid.uuid4().hex[:8]}"

        task_log = {
            "task_id": task_id,
            "command": unique_command,
            "description": "Full Flow Test Task",
            "expression": "*/15 * * * *",
            "timezone": "UTC",
            "status": "completed",
            "scheduled_at": test_timestamp.isoformat(),
            "started_at": (test_timestamp + timedelta(milliseconds=20)).isoformat(),
            "completed_at": (test_timestamp + timedelta(milliseconds=220)).isoformat(),
            "duration_ms": 200,
            "exit_code": 0,
            "output": "Full flow test completed",
            "expected_run_time": test_timestamp.isoformat(),
            "delay_ms": 20
        }

        # Step 1: Ingest
        ingest_response = sync_client.post(
            "/api/ingest/scheduled-tasks",
            json=task_log,
            headers=ingest_headers
        )
        assert ingest_response.status_code == 200

        # Step 2: Wait and verify in ClickHouse
        time.sleep(2)

        ch_result = clickhouse_client.query(
            f"SELECT task_id, command, status, duration_ms "
            f"FROM scheduled_task_logs WHERE task_id = '{task_id}'"
        )
        assert len(ch_result.result_rows) >= 1
        row = ch_result.result_rows[0]
        assert row[0] == task_id
        assert row[1] == unique_command
        assert row[2] == "completed"
        assert row[3] == 200

        # Step 3: Query via Scheduled Tasks API
        query_response = sync_client.get(
            "/api/v1/scheduled-tasks",
            params={"command": unique_command, "limit": 10},
            headers=auth_headers
        )
        assert query_response.status_code == 200


class TestStatsAPIFlow:
    """Test stats APIs return correct aggregated data."""

    @pytest.mark.e2e
    def test_dashboard_stats_endpoint(
        self,
        sync_client,
        auth_headers
    ):
        """Test main dashboard stats endpoint."""
        response = sync_client.get(
            "/api/stats",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        # Verify stats structure
        assert isinstance(data, dict)
        # Should have some stats fields
        assert any(key in data for key in [
            "total_requests", "total_count", "avg_response_time",
            "error_rate", "success_rate"
        ])

    @pytest.mark.e2e
    def test_timeseries_stats_endpoint(
        self,
        sync_client,
        auth_headers
    ):
        """Test time series stats endpoint."""
        response = sync_client.get(
            "/api/stats/timeseries",
            params={"interval": "1h"},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        # Should return array of time series points
        assert isinstance(data, list)

    @pytest.mark.e2e
    def test_top_endpoints_stats(
        self,
        sync_client,
        auth_headers
    ):
        """Test top endpoints stats endpoint."""
        response = sync_client.get(
            "/api/stats/top-endpoints",
            params={"limit": 10},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

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

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)

    @pytest.mark.e2e
    def test_scheduled_task_stats_endpoint(
        self,
        sync_client,
        auth_headers
    ):
        """Test scheduled task stats endpoint."""
        response = sync_client.get(
            "/api/v1/scheduled-tasks/stats",
            params={"timeframe": "7d"},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)


class TestHealthEndpoints:
    """Test health check endpoints."""

    @pytest.mark.e2e
    def test_health_endpoint(
        self,
        sync_client
    ):
        """Test basic health endpoint."""
        response = sync_client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy" or data.get("status") == "ok"


class TestConcurrentIngestion:
    """Test concurrent ingestion scenarios."""

    @pytest.mark.e2e
    @pytest.mark.slow
    def test_concurrent_batch_ingestion(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test multiple batch ingestions in quick succession."""
        results = []

        for batch_num in range(3):
            inbound_logs = []
            for i in range(10):
                inbound_logs.append({
                    "request_id": f"e2e-concurrent-{batch_num}-{i}-{uuid.uuid4()}",
                    "timestamp": test_timestamp.isoformat(),
                    "endpoint": f"/api/concurrent/{batch_num}/{i}",
                    "method": "GET",
                    "status_code": 200,
                    "response_time_ms": 50.0 + i,
                    "module": f"concurrent-batch-{batch_num}"
                })

            batch_request = {
                "inbound_logs": inbound_logs,
                "outbound_logs": []
            }

            response = sync_client.post(
                "/api/ingest/batch",
                json=batch_request,
                headers=ingest_headers
            )
            results.append(response)

        # All batches should succeed
        for response in results:
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["ingested_count"] == 10


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    @pytest.mark.e2e
    def test_empty_batch_ingest(
        self,
        sync_client,
        ingest_headers
    ):
        """Test ingesting empty batch."""
        batch_request = {
            "inbound_logs": [],
            "outbound_logs": []
        }

        response = sync_client.post(
            "/api/ingest/batch",
            json=batch_request,
            headers=ingest_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["ingested_count"] == 0

    @pytest.mark.e2e
    def test_log_with_special_characters(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test log with special characters in fields."""
        log_entry = {
            "request_id": f"e2e-special-{uuid.uuid4()}",
            "timestamp": test_timestamp.isoformat(),
            "endpoint": "/api/test?param=value&foo=bar",
            "method": "POST",
            "status_code": 200,
            "response_time_ms": 100.0,
            "user_name": "Test User <test@example.com>",
            "module": "special-chars",
            "tags": ["tag-with-dash", "tag_with_underscore", "tag.with.dot"],
            "request_body": '{"key": "value with \\"quotes\\""}',
            "response_body": '{"message": "Success with emoji 🎉"}'
        }

        response = sync_client.post(
            "/api/ingest",
            json=log_entry,
            headers=ingest_headers
        )

        assert response.status_code == 200

    @pytest.mark.e2e
    def test_log_with_unicode(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test log with unicode characters."""
        log_entry = {
            "request_id": f"e2e-unicode-{uuid.uuid4()}",
            "timestamp": test_timestamp.isoformat(),
            "endpoint": "/api/users/日本語",
            "method": "GET",
            "status_code": 200,
            "response_time_ms": 80.0,
            "user_name": "用户名称",
            "module": "unicode-test",
            "tags": ["日本語", "中文", "한국어"]
        }

        response = sync_client.post(
            "/api/ingest",
            json=log_entry,
            headers=ingest_headers
        )

        assert response.status_code == 200

    @pytest.mark.e2e
    def test_very_long_response_time(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test log with very long response time (slow request)."""
        log_entry = {
            "request_id": f"e2e-slow-{uuid.uuid4()}",
            "timestamp": test_timestamp.isoformat(),
            "endpoint": "/api/slow-endpoint",
            "method": "GET",
            "status_code": 200,
            "response_time_ms": 300000.0,  # 5 minutes
            "module": "slow-requests"
        }

        response = sync_client.post(
            "/api/ingest",
            json=log_entry,
            headers=ingest_headers
        )

        assert response.status_code == 200

    @pytest.mark.e2e
    def test_all_status_code_ranges(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test various HTTP status codes."""
        status_codes = [200, 201, 204, 301, 302, 400, 401, 403, 404, 500, 502, 503]

        for status_code in status_codes:
            log_entry = {
                "request_id": f"e2e-status-{status_code}-{uuid.uuid4()}",
                "timestamp": test_timestamp.isoformat(),
                "endpoint": f"/api/status/{status_code}",
                "method": "GET",
                "status_code": status_code,
                "response_time_ms": 50.0,
                "module": "status-codes-test"
            }

            response = sync_client.post(
                "/api/ingest",
                json=log_entry,
                headers=ingest_headers
            )

            assert response.status_code == 200, f"Status code {status_code} should be valid"
