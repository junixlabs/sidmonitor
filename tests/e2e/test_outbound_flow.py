"""
E2E Tests for Outbound Logs Flow

Tests the complete flow for outbound HTTP request monitoring:
1. Send outbound log entry via Ingest API (/api/ingest/outbound)
2. Verify data stored in ClickHouse (outbound_logs table)
3. Verify data retrievable via Query API (/api/logs/outbound)
"""

import pytest
import time
import uuid
from datetime import datetime, timedelta


@pytest.fixture
def sample_outbound_log_v2(test_timestamp: datetime) -> dict:
    """Generate a sample outbound log entry with new schema."""
    return {
        "request_id": f"e2e-outbound-{uuid.uuid4()}",
        "timestamp": test_timestamp.isoformat(),
        "service_name": "stripe",
        "target_host": "api.stripe.com",
        "target_url": "https://api.stripe.com/v1/charges",
        "method": "POST",
        "status_code": 201,
        "latency_ms": 320.5,
        "parent_request_id": f"parent-{uuid.uuid4()}",
        "trace_id": f"trace-{uuid.uuid4().hex[:16]}",
        "span_id": f"span-{uuid.uuid4().hex[:8]}",
        "request_size": 256,
        "response_size": 1024,
        "module": "payments",
        "user_id": "user-123",
        "tags": ["payment", "stripe", "e2e-test"],
        "request_headers": '{"Authorization": "Bearer sk_***", "Content-Type": "application/json"}',
        "response_headers": '{"Content-Type": "application/json"}',
        "request_body": '{"amount": 1000, "currency": "usd"}',
        "response_body": '{"id": "ch_xxx", "status": "succeeded"}'
    }


class TestOutboundLogIngestFlow:
    """Test outbound log ingestion end-to-end flow."""

    @pytest.mark.e2e
    def test_single_outbound_log_ingest(
        self,
        sync_client,
        ingest_headers,
        sample_outbound_log_v2
    ):
        """Test ingesting a single outbound log entry via new endpoint."""
        response = sync_client.post(
            "/api/ingest/outbound",
            json=sample_outbound_log_v2,
            headers=ingest_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["ingested_count"] == 1
        assert "ingested successfully" in data["message"].lower()

    @pytest.mark.e2e
    def test_outbound_log_with_error(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test ingesting a failed outbound request."""
        error_log = {
            "request_id": f"e2e-error-{uuid.uuid4()}",
            "timestamp": test_timestamp.isoformat(),
            "service_name": "external-api",
            "target_host": "api.external.com",
            "target_url": "https://api.external.com/v1/resource",
            "method": "POST",
            "status_code": 503,
            "latency_ms": 30000.0,
            "error_message": "Service Unavailable - timeout after 30s",
            "error_code": "TIMEOUT",
            "retry_count": 3,
            "module": "integrations"
        }

        response = sync_client.post(
            "/api/ingest/outbound",
            json=error_log,
            headers=ingest_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    @pytest.mark.e2e
    def test_batch_outbound_logs_ingest(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test batch ingestion of multiple outbound logs."""
        logs = []
        services = ["stripe", "sendgrid", "twilio", "aws-s3", "elasticsearch"]

        for i, service in enumerate(services):
            logs.append({
                "request_id": f"e2e-batch-{i}-{uuid.uuid4()}",
                "timestamp": test_timestamp.isoformat(),
                "service_name": service,
                "target_host": f"api.{service}.com",
                "target_url": f"https://api.{service}.com/v1/resource",
                "method": "GET" if i % 2 == 0 else "POST",
                "status_code": 200 if i < 3 else 500,
                "latency_ms": 100 + i * 50,
                "request_size": 100 + i * 10,
                "response_size": 500 + i * 100,
                "module": "e2e-batch-test"
            })

        batch_request = {"logs": logs}

        response = sync_client.post(
            "/api/ingest/outbound/batch",
            json=batch_request,
            headers=ingest_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["ingested_count"] == 5

    @pytest.mark.e2e
    def test_outbound_log_stored_in_clickhouse(
        self,
        sync_client,
        ingest_headers,
        clickhouse_client,
        test_timestamp
    ):
        """Test that ingested outbound log is stored in ClickHouse."""
        request_id = f"e2e-ch-outbound-{uuid.uuid4()}"
        log_entry = {
            "request_id": request_id,
            "timestamp": test_timestamp.isoformat(),
            "service_name": "clickhouse-verify-service",
            "target_host": "api.verify.com",
            "target_url": "https://api.verify.com/check",
            "method": "GET",
            "status_code": 200,
            "latency_ms": 150.5,
            "request_size": 128,
            "response_size": 512
        }

        response = sync_client.post(
            "/api/ingest/outbound",
            json=log_entry,
            headers=ingest_headers
        )
        assert response.status_code == 200

        # Wait for ClickHouse to process
        time.sleep(1)

        # Verify in ClickHouse
        result = clickhouse_client.query(
            f"SELECT request_id, service_name, status_code, latency_ms "
            f"FROM outbound_logs WHERE request_id = '{request_id}'"
        )

        assert len(result.result_rows) >= 1
        row = result.result_rows[0]
        assert row[0] == request_id
        assert row[1] == "clickhouse-verify-service"
        assert row[2] == 200
        assert abs(row[3] - 150.5) < 0.1


class TestOutboundLogQueryFlow:
    """Test outbound log query flow after ingestion."""

    @pytest.mark.e2e
    def test_query_outbound_logs_after_ingest(
        self,
        sync_client,
        ingest_headers,
        auth_headers,
        test_timestamp
    ):
        """Test querying outbound logs via /api/logs/outbound after ingestion."""
        # First, ingest a log with unique service name
        unique_service = f"e2e-query-svc-{uuid.uuid4().hex[:8]}"
        log_entry = {
            "request_id": f"e2e-query-{uuid.uuid4()}",
            "timestamp": test_timestamp.isoformat(),
            "service_name": unique_service,
            "target_host": "api.query-test.com",
            "target_url": "https://api.query-test.com/v1/test",
            "method": "POST",
            "status_code": 201,
            "latency_ms": 200.0
        }

        # Ingest
        ingest_response = sync_client.post(
            "/api/ingest/outbound",
            json=log_entry,
            headers=ingest_headers
        )
        assert ingest_response.status_code == 200

        # Wait for data to be available
        time.sleep(1)

        # Query via /api/logs/outbound
        query_response = sync_client.get(
            "/api/logs/outbound",
            params={"service_name": unique_service, "limit": 10},
            headers=auth_headers
        )

        assert query_response.status_code == 200
        data = query_response.json()
        assert "data" in data
        assert "total" in data

    @pytest.mark.e2e
    def test_query_outbound_logs_with_filters(
        self,
        sync_client,
        auth_headers
    ):
        """Test querying outbound logs with various filters."""
        # Test status filter
        response = sync_client.get(
            "/api/logs/outbound",
            params={"status": "success", "page_size": 10},
            headers=auth_headers
        )
        assert response.status_code == 200

        # Test method filter
        response = sync_client.get(
            "/api/logs/outbound",
            params={"method": "POST", "page_size": 10},
            headers=auth_headers
        )
        assert response.status_code == 200

        # Test error status filter
        response = sync_client.get(
            "/api/logs/outbound",
            params={"status": "error", "page_size": 10},
            headers=auth_headers
        )
        assert response.status_code == 200

    @pytest.mark.e2e
    def test_get_outbound_services(
        self,
        sync_client,
        auth_headers
    ):
        """Test getting distinct outbound services."""
        response = sync_client.get(
            "/api/logs/outbound/services",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.e2e
    def test_get_outbound_hosts(
        self,
        sync_client,
        auth_headers
    ):
        """Test getting distinct outbound hosts."""
        response = sync_client.get(
            "/api/logs/outbound/hosts",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestOutboundLogValidation:
    """Test input validation for outbound log ingest."""

    @pytest.mark.e2e
    def test_outbound_ingest_missing_required_fields(
        self,
        sync_client,
        ingest_headers
    ):
        """Test that outbound ingest fails with missing required fields."""
        invalid_log = {
            "request_id": "test-123"
            # Missing: service_name, target_host, target_url, method, status_code, latency_ms
        }

        response = sync_client.post(
            "/api/ingest/outbound",
            json=invalid_log,
            headers=ingest_headers
        )

        assert response.status_code == 422

    @pytest.mark.e2e
    def test_outbound_ingest_invalid_status_code(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test that outbound ingest fails with invalid status code."""
        invalid_log = {
            "request_id": f"e2e-invalid-{uuid.uuid4()}",
            "timestamp": test_timestamp.isoformat(),
            "service_name": "test-service",
            "target_host": "api.test.com",
            "target_url": "https://api.test.com/v1/test",
            "method": "GET",
            "status_code": 999,  # Invalid: must be 100-599
            "latency_ms": 100.0
        }

        response = sync_client.post(
            "/api/ingest/outbound",
            json=invalid_log,
            headers=ingest_headers
        )

        assert response.status_code == 422

    @pytest.mark.e2e
    def test_outbound_ingest_negative_latency(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test that outbound ingest fails with negative latency."""
        invalid_log = {
            "request_id": f"e2e-negative-{uuid.uuid4()}",
            "timestamp": test_timestamp.isoformat(),
            "service_name": "test-service",
            "target_host": "api.test.com",
            "target_url": "https://api.test.com/v1/test",
            "method": "GET",
            "status_code": 200,
            "latency_ms": -10.0  # Invalid: must be >= 0
        }

        response = sync_client.post(
            "/api/ingest/outbound",
            json=invalid_log,
            headers=ingest_headers
        )

        assert response.status_code == 422


class TestOutboundLogWithDistributedTracing:
    """Test outbound logs with distributed tracing fields."""

    @pytest.mark.e2e
    def test_outbound_with_trace_context(
        self,
        sync_client,
        ingest_headers,
        test_timestamp
    ):
        """Test ingesting outbound log with full tracing context."""
        trace_id = uuid.uuid4().hex
        parent_span = uuid.uuid4().hex[:16]
        span_id = uuid.uuid4().hex[:16]

        log_entry = {
            "request_id": f"e2e-trace-{uuid.uuid4()}",
            "timestamp": test_timestamp.isoformat(),
            "service_name": "downstream-api",
            "target_host": "api.downstream.com",
            "target_url": "https://api.downstream.com/v1/resource",
            "method": "GET",
            "status_code": 200,
            "latency_ms": 50.0,
            "parent_request_id": f"parent-{uuid.uuid4()}",
            "trace_id": trace_id,
            "span_id": span_id
        }

        response = sync_client.post(
            "/api/ingest/outbound",
            json=log_entry,
            headers=ingest_headers
        )

        assert response.status_code == 200

    @pytest.mark.e2e
    def test_query_outbound_by_trace_id(
        self,
        sync_client,
        ingest_headers,
        auth_headers,
        test_timestamp
    ):
        """Test querying outbound logs by trace_id."""
        trace_id = f"trace-{uuid.uuid4().hex[:16]}"

        # Ingest multiple logs with same trace_id
        for i in range(3):
            log_entry = {
                "request_id": f"e2e-trace-query-{i}-{uuid.uuid4()}",
                "timestamp": test_timestamp.isoformat(),
                "service_name": f"service-{i}",
                "target_host": f"api.service{i}.com",
                "target_url": f"https://api.service{i}.com/v1/test",
                "method": "GET",
                "status_code": 200,
                "latency_ms": 100.0 + i * 10,
                "trace_id": trace_id,
                "span_id": f"span-{uuid.uuid4().hex[:8]}"
            }

            sync_client.post(
                "/api/ingest/outbound",
                json=log_entry,
                headers=ingest_headers
            )

        time.sleep(1)

        # Query by trace_id
        response = sync_client.get(
            "/api/logs/outbound",
            params={"trace_id": trace_id},
            headers=auth_headers
        )

        assert response.status_code == 200


class TestOutboundLogsByService:
    """Test outbound logs grouped by service."""

    @pytest.mark.e2e
    def test_multiple_services_ingest_and_query(
        self,
        sync_client,
        ingest_headers,
        auth_headers,
        test_timestamp
    ):
        """Test ingesting and querying logs from multiple services."""
        unique_prefix = uuid.uuid4().hex[:8]
        services = [
            {"name": f"stripe-{unique_prefix}", "host": "api.stripe.com"},
            {"name": f"sendgrid-{unique_prefix}", "host": "api.sendgrid.com"},
            {"name": f"twilio-{unique_prefix}", "host": "api.twilio.com"},
        ]

        # Ingest logs for each service
        for i, svc in enumerate(services):
            for j in range(2):
                log_entry = {
                    "request_id": f"e2e-svc-{i}-{j}-{uuid.uuid4()}",
                    "timestamp": test_timestamp.isoformat(),
                    "service_name": svc["name"],
                    "target_host": svc["host"],
                    "target_url": f"https://{svc['host']}/v1/test",
                    "method": "POST",
                    "status_code": 200,
                    "latency_ms": 100.0 + j * 20
                }

                sync_client.post(
                    "/api/ingest/outbound",
                    json=log_entry,
                    headers=ingest_headers
                )

        time.sleep(1)

        # Query for specific service
        response = sync_client.get(
            "/api/logs/outbound",
            params={"service_name": services[0]["name"]},
            headers=auth_headers
        )

        assert response.status_code == 200


class TestOutboundStatsEndpoints:
    """Test outbound stats API endpoints."""

    @pytest.mark.e2e
    def test_get_outbound_overall_stats(
        self,
        sync_client,
        auth_headers
    ):
        """Test overall outbound stats endpoint."""
        response = sync_client.get(
            "/api/stats/outbound",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        # Verify stats structure
        assert "total_requests" in data
        assert "success_count" in data
        assert "failure_count" in data
        assert "success_rate" in data
        assert "avg_latency_ms" in data
        assert "p95_latency_ms" in data
        assert "services_count" in data

    @pytest.mark.e2e
    def test_get_outbound_stats_by_service(
        self,
        sync_client,
        auth_headers
    ):
        """Test outbound stats grouped by service."""
        response = sync_client.get(
            "/api/stats/outbound/by-service",
            params={"limit": 10},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

        # If data exists, verify structure
        if len(data) > 0:
            service_stats = data[0]
            assert "service_name" in service_stats
            assert "total_requests" in service_stats
            assert "success_rate" in service_stats
            assert "avg_latency_ms" in service_stats

    @pytest.mark.e2e
    def test_get_outbound_stats_by_host(
        self,
        sync_client,
        auth_headers
    ):
        """Test outbound stats grouped by host."""
        response = sync_client.get(
            "/api/stats/outbound/by-host",
            params={"limit": 10},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

        # If data exists, verify structure
        if len(data) > 0:
            host_stats = data[0]
            assert "target_host" in host_stats
            assert "total_requests" in host_stats
            assert "success_rate" in host_stats

    @pytest.mark.e2e
    def test_outbound_stats_with_date_filter(
        self,
        sync_client,
        auth_headers,
        test_timestamp
    ):
        """Test outbound stats with date filters."""
        start_date = (test_timestamp - timedelta(days=7)).strftime("%Y-%m-%d")
        end_date = test_timestamp.strftime("%Y-%m-%d")

        response = sync_client.get(
            "/api/stats/outbound",
            params={"start_date": start_date, "end_date": end_date},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_requests" in data


class TestOutboundFullFlow:
    """Test complete outbound logging flow."""

    @pytest.mark.e2e
    @pytest.mark.slow
    def test_outbound_full_e2e_flow(
        self,
        sync_client,
        ingest_headers,
        auth_headers,
        clickhouse_client,
        test_timestamp
    ):
        """
        Full E2E test for outbound log:
        1. Ingest via API
        2. Verify in ClickHouse
        3. Query via Query API
        4. Verify pagination works
        """
        unique_service = f"e2e-full-{uuid.uuid4().hex[:8]}"
        request_ids = []

        # Step 1: Ingest multiple logs
        for i in range(5):
            request_id = f"e2e-full-flow-{i}-{uuid.uuid4()}"
            request_ids.append(request_id)

            log_entry = {
                "request_id": request_id,
                "timestamp": test_timestamp.isoformat(),
                "service_name": unique_service,
                "target_host": "api.fullflow.com",
                "target_url": f"https://api.fullflow.com/v1/resource/{i}",
                "method": "GET" if i % 2 == 0 else "POST",
                "status_code": 200 if i < 4 else 500,
                "latency_ms": 100.0 + i * 25,
                "request_size": 100 + i * 10,
                "response_size": 500 + i * 100
            }

            response = sync_client.post(
                "/api/ingest/outbound",
                json=log_entry,
                headers=ingest_headers
            )
            assert response.status_code == 200

        # Step 2: Wait and verify in ClickHouse
        time.sleep(2)

        ch_result = clickhouse_client.query(
            f"SELECT count(*) FROM outbound_logs WHERE service_name = '{unique_service}'"
        )
        assert ch_result.result_rows[0][0] >= 5

        # Step 3: Query via API
        query_response = sync_client.get(
            "/api/logs/outbound",
            params={"service_name": unique_service, "page_size": 10},
            headers=auth_headers
        )
        assert query_response.status_code == 200
        data = query_response.json()
        assert data["total"] >= 5
        assert len(data["data"]) >= 5

        # Step 4: Verify pagination
        query_response = sync_client.get(
            "/api/logs/outbound",
            params={"service_name": unique_service, "page": 1, "page_size": 2},
            headers=auth_headers
        )
        assert query_response.status_code == 200
        data = query_response.json()
        assert len(data["data"]) == 2
        assert data["total_pages"] >= 3

    @pytest.mark.e2e
    @pytest.mark.slow
    def test_outbound_ingest_then_stats(
        self,
        sync_client,
        ingest_headers,
        auth_headers,
        test_timestamp
    ):
        """
        Full E2E test: Ingest -> Verify Stats updated
        """
        unique_service = f"e2e-stats-{uuid.uuid4().hex[:8]}"

        # Get initial stats
        initial_response = sync_client.get(
            "/api/stats/outbound",
            headers=auth_headers
        )
        assert initial_response.status_code == 200
        initial_total = initial_response.json().get("total_requests", 0)

        # Ingest some logs
        for i in range(3):
            log_entry = {
                "request_id": f"e2e-stats-{i}-{uuid.uuid4()}",
                "timestamp": test_timestamp.isoformat(),
                "service_name": unique_service,
                "target_host": "api.stats-test.com",
                "target_url": f"https://api.stats-test.com/v1/test/{i}",
                "method": "POST",
                "status_code": 200,
                "latency_ms": 150.0 + i * 20
            }

            sync_client.post(
                "/api/ingest/outbound",
                json=log_entry,
                headers=ingest_headers
            )

        # Wait for data to be processed
        time.sleep(2)

        # Check stats updated
        final_response = sync_client.get(
            "/api/stats/outbound",
            headers=auth_headers
        )
        assert final_response.status_code == 200
        final_total = final_response.json().get("total_requests", 0)

        # Total should have increased
        assert final_total >= initial_total + 3
