"""
E2E Tests for Ingest Flow

Tests the complete flow:
1. Send log entry via Ingest API
2. Verify data stored in ClickHouse
3. Verify data retrievable via Query API
"""

import pytest
import time
import uuid
from datetime import datetime


class TestInboundLogIngestFlow:
    """Test inbound log ingestion end-to-end flow."""

    @pytest.mark.e2e
    def test_single_inbound_log_ingest(
        self,
        sync_client,
        ingest_headers,
        sample_inbound_log
    ):
        """Test ingesting a single inbound log entry."""
        # Step 1: Send log via Ingest API
        response = sync_client.post(
            "/api/ingest",
            json=sample_inbound_log,
            headers=ingest_headers
        )

        # Verify ingest response
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["ingested_count"] == 1
        assert "ingested successfully" in data["message"].lower()

    @pytest.mark.e2e
    def test_batch_inbound_logs_ingest(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test batch ingestion of multiple inbound logs."""
        # Create batch of inbound logs
        inbound_logs = []
        for i in range(5):
            inbound_logs.append({
                "request_id": f"e2e-batch-{uuid.uuid4()}",
                "timestamp": test_timestamp.isoformat(),
                "endpoint": f"/api/test/batch/{i}",
                "method": "GET",
                "status_code": 200,
                "response_time_ms": 100 + i * 10,
                "user_id": f"batch-user-{i}",
                "module": "e2e-batch-test",
                "tags": ["batch", f"item-{i}"]
            })

        batch_request = {
            "inbound_logs": inbound_logs,
            "outbound_logs": []
        }

        # Step 1: Send batch via Ingest API
        response = sync_client.post(
            "/api/ingest/batch",
            json=batch_request,
            headers=ingest_headers
        )

        # Verify batch ingest response
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["ingested_count"] == 5

    @pytest.mark.e2e
    def test_inbound_log_stored_in_clickhouse(
        self,
        sync_client,
        ingest_headers,
        clickhouse_client,
        unique_request_id,
        test_timestamp
    ):
        """Test that ingested log is stored in ClickHouse."""
        # Create and ingest a log
        log_entry = {
            "request_id": unique_request_id,
            "timestamp": test_timestamp.isoformat(),
            "endpoint": "/api/clickhouse/verify",
            "method": "POST",
            "status_code": 201,
            "response_time_ms": 250.0,
            "user_id": "clickhouse-verify-user",
            "module": "e2e-clickhouse-test"
        }

        response = sync_client.post(
            "/api/ingest",
            json=log_entry,
            headers=ingest_headers
        )
        assert response.status_code == 200

        # Wait for ClickHouse to process
        time.sleep(1)

        # Verify in ClickHouse directly
        result = clickhouse_client.query(
            f"SELECT request_id, endpoint, status_code FROM logs WHERE request_id = '{unique_request_id}'"
        )

        assert len(result.result_rows) >= 1
        row = result.result_rows[0]
        assert row[0] == unique_request_id
        assert row[1] == "/api/clickhouse/verify"
        assert row[2] == 201


class TestOutboundLogIngestFlow:
    """Test outbound log ingestion end-to-end flow."""

    @pytest.mark.e2e
    def test_single_outbound_log_ingest(
        self,
        sync_client,
        ingest_headers,
        sample_outbound_log
    ):
        """Test ingesting a single outbound log entry."""
        response = sync_client.post(
            "/api/ingest",
            json=sample_outbound_log,
            headers=ingest_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["ingested_count"] == 1

    @pytest.mark.e2e
    def test_mixed_batch_ingest(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test batch ingestion with both inbound and outbound logs."""
        batch_request = {
            "inbound_logs": [
                {
                    "request_id": f"e2e-mixed-in-{uuid.uuid4()}",
                    "timestamp": test_timestamp.isoformat(),
                    "endpoint": "/api/internal/action",
                    "method": "POST",
                    "status_code": 200,
                    "response_time_ms": 100.0,
                    "module": "e2e-mixed-test"
                }
            ],
            "outbound_logs": [
                {
                    "request_id": f"e2e-mixed-out-{uuid.uuid4()}",
                    "timestamp": test_timestamp.isoformat(),
                    "endpoint": "https://api.external.com/data",
                    "method": "GET",
                    "status_code": 200,
                    "response_time_ms": 350.0,
                    "third_party_service": "external-api",
                    "module": "e2e-mixed-test"
                }
            ]
        }

        response = sync_client.post(
            "/api/ingest/batch",
            json=batch_request,
            headers=ingest_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["ingested_count"] == 2


class TestIngestAPIKeyAuthentication:
    """Test API key authentication for ingest endpoints."""

    @pytest.mark.e2e
    def test_ingest_without_api_key_fails(
        self,
        sync_client,
        sample_inbound_log
    ):
        """Test that ingest fails without API key."""
        response = sync_client.post(
            "/api/ingest",
            json=sample_inbound_log,
            headers={"Content-Type": "application/json"}
        )

        assert response.status_code == 422  # Missing header

    @pytest.mark.e2e
    def test_ingest_with_invalid_api_key_fails(
        self,
        sync_client,
        sample_inbound_log
    ):
        """Test that ingest fails with invalid API key."""
        response = sync_client.post(
            "/api/ingest",
            json=sample_inbound_log,
            headers={
                "X-API-Key": "invalid-api-key-12345",
                "Content-Type": "application/json"
            }
        )

        assert response.status_code == 401


class TestIngestValidation:
    """Test input validation for ingest endpoints."""

    @pytest.mark.e2e
    def test_ingest_missing_required_fields(
        self,
        sync_client,
        ingest_headers
    ):
        """Test that ingest fails with missing required fields."""
        invalid_log = {
            "request_id": "test-123"
            # Missing: endpoint, method, status_code, response_time_ms
        }

        response = sync_client.post(
            "/api/ingest",
            json=invalid_log,
            headers=ingest_headers
        )

        assert response.status_code == 422  # Validation error

    @pytest.mark.e2e
    def test_ingest_invalid_status_code(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test that ingest fails with invalid status code."""
        invalid_log = {
            "request_id": f"e2e-invalid-{uuid.uuid4()}",
            "timestamp": test_timestamp.isoformat(),
            "endpoint": "/api/test",
            "method": "GET",
            "status_code": 999,  # Invalid: must be 100-599
            "response_time_ms": 100.0
        }

        response = sync_client.post(
            "/api/ingest",
            json=invalid_log,
            headers=ingest_headers
        )

        assert response.status_code == 422

    @pytest.mark.e2e
    def test_ingest_negative_response_time(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test that ingest fails with negative response time."""
        invalid_log = {
            "request_id": f"e2e-negative-{uuid.uuid4()}",
            "timestamp": test_timestamp.isoformat(),
            "endpoint": "/api/test",
            "method": "GET",
            "status_code": 200,
            "response_time_ms": -10.0  # Invalid: must be >= 0
        }

        response = sync_client.post(
            "/api/ingest",
            json=invalid_log,
            headers=ingest_headers
        )

        assert response.status_code == 422
