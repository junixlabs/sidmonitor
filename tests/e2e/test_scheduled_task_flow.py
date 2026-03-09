"""
E2E Tests for Scheduled Task Logs Flow

Tests the complete flow for Laravel scheduled task monitoring:
1. Send scheduled task log entry via Ingest API
2. Verify data stored in ClickHouse
3. Verify data retrievable via Query API (/v1/scheduled-tasks)
"""

import pytest
import time
import uuid
from datetime import datetime, timedelta


class TestScheduledTaskIngestFlow:
    """Test scheduled task log ingestion end-to-end flow."""

    @pytest.mark.e2e
    def test_single_scheduled_task_ingest(
        self,
        sync_client,
        ingest_headers,
        sample_scheduled_task_log
    ):
        """Test ingesting a single scheduled task log entry."""
        response = sync_client.post(
            "/api/ingest/scheduled-tasks",
            json=sample_scheduled_task_log,
            headers=ingest_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["ingested_count"] == 1
        assert "ingested successfully" in data["message"].lower()

    @pytest.mark.e2e
    def test_scheduled_task_with_failed_status(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test ingesting a failed scheduled task log."""
        failed_task = {
            "task_id": f"e2e-failed-task-{uuid.uuid4()}",
            "command": "e2e:failing-command",
            "description": "E2E Failing Scheduled Task",
            "expression": "0 * * * *",
            "timezone": "UTC",
            "status": "failed",
            "scheduled_at": test_timestamp.isoformat(),
            "started_at": (test_timestamp + timedelta(milliseconds=50)).isoformat(),
            "completed_at": (test_timestamp + timedelta(milliseconds=150)).isoformat(),
            "duration_ms": 100,
            "exit_code": 1,
            "output": "",
            "error_message": "E2E Test: Simulated task failure",
            "error_trace": "at Command.php:42",
            "without_overlapping": True,
            "mutex_name": "framework/schedule-e2e-failing-command",
            "expected_run_time": test_timestamp.isoformat(),
            "delay_ms": 50,
            "metadata": {"test_type": "failure"}
        }

        response = sync_client.post(
            "/api/ingest/scheduled-tasks",
            json=failed_task,
            headers=ingest_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    @pytest.mark.e2e
    def test_scheduled_task_with_missed_status(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test ingesting a missed scheduled task log."""
        missed_task = {
            "task_id": f"e2e-missed-task-{uuid.uuid4()}",
            "command": "e2e:missed-command",
            "description": "E2E Missed Scheduled Task",
            "expression": "*/5 * * * *",
            "timezone": "UTC",
            "status": "missed",
            "scheduled_at": test_timestamp.isoformat(),
            "expected_run_time": test_timestamp.isoformat(),
            "delay_ms": 300000,  # 5 minutes late
            "metadata": {"reason": "server_overload"}
        }

        response = sync_client.post(
            "/api/ingest/scheduled-tasks",
            json=missed_task,
            headers=ingest_headers
        )

        assert response.status_code == 200

    @pytest.mark.e2e
    def test_scheduled_task_stored_in_clickhouse(
        self,
        sync_client,
        ingest_headers,
        clickhouse_client,
        test_timestamp
    ):
        """Test that ingested scheduled task is stored in ClickHouse."""
        task_id = f"e2e-ch-task-{uuid.uuid4()}"
        task_log = {
            "task_id": task_id,
            "command": "e2e:clickhouse-verify",
            "description": "ClickHouse Verify Task",
            "expression": "0 0 * * *",
            "timezone": "UTC",
            "status": "completed",
            "scheduled_at": test_timestamp.isoformat(),
            "started_at": (test_timestamp + timedelta(milliseconds=10)).isoformat(),
            "completed_at": (test_timestamp + timedelta(milliseconds=210)).isoformat(),
            "duration_ms": 200,
            "exit_code": 0,
            "output": "Task completed successfully",
            "expected_run_time": test_timestamp.isoformat(),
            "delay_ms": 10
        }

        response = sync_client.post(
            "/api/ingest/scheduled-tasks",
            json=task_log,
            headers=ingest_headers
        )
        assert response.status_code == 200

        # Wait for ClickHouse to process
        time.sleep(1)

        # Verify in ClickHouse
        result = clickhouse_client.query(
            f"SELECT task_id, command, status, duration_ms FROM scheduled_task_logs WHERE task_id = '{task_id}'"
        )

        assert len(result.result_rows) >= 1
        row = result.result_rows[0]
        assert row[0] == task_id
        assert row[1] == "e2e:clickhouse-verify"
        assert row[2] == "completed"
        assert row[3] == 200

    @pytest.mark.e2e
    def test_batch_scheduled_tasks_ingest(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test batch ingestion of scheduled task logs."""
        task_logs = []
        for i in range(5):
            scheduled = test_timestamp + timedelta(minutes=i)
            task_logs.append({
                "task_id": f"e2e-batch-task-{i}-{uuid.uuid4()}",
                "command": f"e2e:batch-command-{i}",
                "description": f"Batch Task {i}",
                "expression": f"*/{i+1} * * * *",
                "timezone": "UTC",
                "status": "completed" if i % 2 == 0 else "failed",
                "scheduled_at": scheduled.isoformat(),
                "started_at": (scheduled + timedelta(milliseconds=20)).isoformat(),
                "completed_at": (scheduled + timedelta(milliseconds=120 + i * 30)).isoformat(),
                "duration_ms": 100 + i * 30,
                "exit_code": 0 if i % 2 == 0 else 1,
                "expected_run_time": scheduled.isoformat(),
                "delay_ms": 20
            })

        batch_request = {
            "job_logs": [],
            "scheduled_task_logs": task_logs
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


class TestScheduledTaskQueryFlow:
    """Test scheduled task query flow after ingestion."""

    @pytest.mark.e2e
    def test_query_scheduled_tasks_after_ingest(
        self,
        sync_client,
        ingest_headers,
        auth_headers,
        test_timestamp
    ):
        """Test querying scheduled tasks via /v1/scheduled-tasks after ingestion."""
        # First, ingest a task
        task_id = f"e2e-query-task-{uuid.uuid4()}"
        task_log = {
            "task_id": task_id,
            "command": "e2e:query-test",
            "description": "Query Test Task",
            "expression": "* * * * *",
            "timezone": "UTC",
            "status": "completed",
            "scheduled_at": test_timestamp.isoformat(),
            "started_at": (test_timestamp + timedelta(milliseconds=5)).isoformat(),
            "completed_at": (test_timestamp + timedelta(milliseconds=55)).isoformat(),
            "duration_ms": 50,
            "exit_code": 0,
            "expected_run_time": test_timestamp.isoformat(),
            "delay_ms": 5
        }

        # Ingest
        ingest_response = sync_client.post(
            "/api/ingest/scheduled-tasks",
            json=task_log,
            headers=ingest_headers
        )
        assert ingest_response.status_code == 200

        # Wait for data to be available
        time.sleep(1)

        # Query via /v1/scheduled-tasks
        query_response = sync_client.get(
            "/api/v1/scheduled-tasks",
            params={"command": "e2e:query-test", "limit": 10},
            headers=auth_headers
        )

        # Should return 200
        assert query_response.status_code == 200

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

        # Stats endpoint should return 200
        assert response.status_code == 200
        data = response.json()

        # Basic structure validation
        assert isinstance(data, dict)


class TestScheduledTaskValidation:
    """Test input validation for scheduled task ingest."""

    @pytest.mark.e2e
    def test_task_ingest_missing_required_fields(
        self,
        sync_client,
        ingest_headers
    ):
        """Test that task ingest fails with missing required fields."""
        invalid_task = {
            "task_id": "test-123"
            # Missing: command, expression, status, scheduled_at, expected_run_time
        }

        response = sync_client.post(
            "/api/ingest/scheduled-tasks",
            json=invalid_task,
            headers=ingest_headers
        )

        assert response.status_code == 422

    @pytest.mark.e2e
    def test_task_with_various_cron_expressions(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test task ingestion with various cron expressions."""
        cron_expressions = [
            "* * * * *",        # Every minute
            "0 * * * *",        # Every hour
            "0 0 * * *",        # Daily
            "0 0 * * 0",        # Weekly
            "0 0 1 * *",        # Monthly
            "*/5 * * * *",      # Every 5 minutes
            "0 9-17 * * 1-5",   # Weekdays 9am-5pm
        ]

        for expression in cron_expressions:
            task_log = {
                "task_id": f"e2e-cron-{uuid.uuid4()}",
                "command": f"e2e:cron-test",
                "expression": expression,
                "timezone": "UTC",
                "status": "completed",
                "scheduled_at": test_timestamp.isoformat(),
                "expected_run_time": test_timestamp.isoformat()
            }

            response = sync_client.post(
                "/api/ingest/scheduled-tasks",
                json=task_log,
                headers=ingest_headers
            )

            assert response.status_code == 200, f"Cron '{expression}' should be valid"


class TestScheduledTaskWithOverlapping:
    """Test scheduled task with overlapping prevention scenarios."""

    @pytest.mark.e2e
    def test_task_with_overlapping_prevention(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test task with overlapping prevention enabled."""
        task_log = {
            "task_id": f"e2e-overlap-{uuid.uuid4()}",
            "command": "e2e:long-running",
            "description": "Long Running Task",
            "expression": "* * * * *",
            "timezone": "UTC",
            "status": "completed",
            "scheduled_at": test_timestamp.isoformat(),
            "started_at": (test_timestamp + timedelta(milliseconds=10)).isoformat(),
            "completed_at": (test_timestamp + timedelta(seconds=90)).isoformat(),
            "duration_ms": 90000,
            "exit_code": 0,
            "without_overlapping": True,
            "mutex_name": "framework/schedule-e2e-long-running",
            "expected_run_time": test_timestamp.isoformat(),
            "delay_ms": 10
        }

        response = sync_client.post(
            "/api/ingest/scheduled-tasks",
            json=task_log,
            headers=ingest_headers
        )

        assert response.status_code == 200

    @pytest.mark.e2e
    def test_task_skipped_due_to_overlap(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test task that was skipped due to overlapping."""
        task_log = {
            "task_id": f"e2e-skipped-{uuid.uuid4()}",
            "command": "e2e:skipped-overlap",
            "description": "Skipped Due to Overlap",
            "expression": "* * * * *",
            "timezone": "UTC",
            "status": "skipped",
            "scheduled_at": test_timestamp.isoformat(),
            "without_overlapping": True,
            "mutex_name": "framework/schedule-e2e-skipped-overlap",
            "expected_run_time": test_timestamp.isoformat(),
            "metadata": {"skip_reason": "previous_still_running"}
        }

        response = sync_client.post(
            "/api/ingest/scheduled-tasks",
            json=task_log,
            headers=ingest_headers
        )

        assert response.status_code == 200


class TestMixedBatchIngest:
    """Test batch ingestion with both jobs and scheduled tasks."""

    @pytest.mark.e2e
    def test_mixed_jobs_and_tasks_batch(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test batch with both job logs and scheduled task logs."""
        batch_request = {
            "job_logs": [
                {
                    "job_id": f"e2e-mixed-job-{uuid.uuid4()}",
                    "job_uuid": str(uuid.uuid4()),
                    "job_class": "App\\Jobs\\MixedBatchJob",
                    "job_name": "Mixed Batch Job",
                    "queue_name": "default",
                    "connection": "sync",
                    "status": "completed",
                    "started_at": test_timestamp.isoformat(),
                    "completed_at": (test_timestamp + timedelta(milliseconds=100)).isoformat(),
                    "duration_ms": 100,
                    "attempt_number": 1,
                    "max_attempts": 1
                }
            ],
            "scheduled_task_logs": [
                {
                    "task_id": f"e2e-mixed-task-{uuid.uuid4()}",
                    "command": "e2e:mixed-batch",
                    "expression": "* * * * *",
                    "timezone": "UTC",
                    "status": "completed",
                    "scheduled_at": test_timestamp.isoformat(),
                    "started_at": (test_timestamp + timedelta(milliseconds=5)).isoformat(),
                    "completed_at": (test_timestamp + timedelta(milliseconds=55)).isoformat(),
                    "duration_ms": 50,
                    "exit_code": 0,
                    "expected_run_time": test_timestamp.isoformat(),
                    "delay_ms": 5
                }
            ]
        }

        response = sync_client.post(
            "/api/ingest/jobs/batch",
            json=batch_request,
            headers=ingest_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["ingested_count"] == 2
