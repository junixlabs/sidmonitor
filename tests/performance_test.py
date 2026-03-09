#!/usr/bin/env python3
"""
Performance Test Suite for SidMonitor
Tests: Seed Data, Ingest API, Query Performance, Dashboard Load
"""

import argparse
import random
import uuid
import json
import time
import requests
import sys
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add parent directory for imports
sys.path.insert(0, '/Users/chuongle/web/monitoring/backend')

try:
    import clickhouse_connect
except ImportError:
    print("Error: clickhouse-connect not installed. Run: pip install clickhouse-connect")
    sys.exit(1)


# =============================================================================
# Configuration
# =============================================================================

CLICKHOUSE_HOST = "localhost"
CLICKHOUSE_PORT = 8123
CLICKHOUSE_DB = "sid_monitoring"

BACKEND_URL = "http://localhost:8000"
API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMGNhOGNmYS02ZGRhLTQ4OGYtOWRhYy03YzM3ZTRhOTBjOTkiLCJleHAiOjE3NjU3MzAyMTJ9.0iarQj5YKXFPuuPx0Ow95CW_t7DmrpIQILc2NO-_uu0"

# Test project ID
TEST_PROJECT_ID = "efb477b8-0ff0-4c4b-8c94-e040c23e6dfe"

# Realistic data
MODULES = ["auth", "users", "orders", "products", "payments", "inventory", "reports", "api"]
ENDPOINTS = [
    "/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/users", "/api/v1/users/{id}",
    "/api/v1/orders", "/api/v1/orders/{id}", "/api/v1/products", "/api/v1/products/{id}",
    "/api/v1/payments", "/api/v1/payments/process", "/api/v1/inventory", "/api/v1/reports/sales"
]
METHODS = ["GET", "POST", "PUT", "DELETE"]
THIRD_PARTY_SERVICES = ["stripe", "twilio", "sendgrid", "aws-s3", "firebase", "elasticsearch"]
USER_NAMES = ["john.doe", "jane.smith", "bob.wilson", "alice.johnson", "admin", "support", ""]


def generate_log_record(project_id: str, timestamp: datetime, is_outbound: bool = False) -> dict:
    """Generate a single log record."""
    status_code = random.choices(
        [200, 201, 204, 400, 401, 403, 404, 500],
        weights=[65, 10, 5, 5, 4, 3, 4, 4]
    )[0]

    response_time = random.randint(10, 500) if status_code < 400 else random.randint(5, 100)
    if status_code >= 500:
        response_time = random.randint(100, 5000)

    endpoint = random.choice(ENDPOINTS).replace("{id}", str(random.randint(1, 10000)))

    return {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "request_id": f"req_{uuid.uuid4().hex[:16]}",
        "timestamp": timestamp,
        "endpoint": endpoint,
        "method": random.choice(METHODS),
        "status_code": status_code,
        "response_time_ms": float(response_time),
        "user_id": f"usr_{random.randint(1, 100):03d}" if random.random() > 0.2 else "",
        "user_name": random.choice(USER_NAMES),
        "module": random.choice(MODULES),
        "tags": random.sample(["mobile", "web", "api", "internal"], k=random.randint(0, 2)),
        "is_outbound": 1 if is_outbound else 0,
        "third_party_service": random.choice(THIRD_PARTY_SERVICES) if is_outbound else "",
        "request_body": "{}",
        "response_body": "{}"
    }


# =============================================================================
# Test 1: Seed Large Dataset
# =============================================================================

def test_seed_large_dataset(count: int = 100000, days: int = 7):
    """Seed large dataset into ClickHouse."""
    print("\n" + "="*60)
    print(f"TEST 1: Seeding {count:,} logs over {days} days")
    print("="*60)

    client = clickhouse_connect.get_client(
        host=CLICKHOUSE_HOST,
        port=CLICKHOUSE_PORT,
        database=CLICKHOUSE_DB
    )

    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    time_range_seconds = int((end_date - start_date).total_seconds())

    # Generate data
    batch_size = 10000
    total_inserted = 0
    start_time = time.time()

    columns = ["id", "project_id", "request_id", "timestamp", "endpoint", "method",
               "status_code", "response_time_ms", "user_id", "user_name", "module",
               "tags", "is_outbound", "third_party_service", "request_body", "response_body"]

    batch = []
    for i in range(count):
        random_seconds = random.randint(0, time_range_seconds)
        timestamp = start_date + timedelta(seconds=random_seconds)
        is_outbound = random.random() < 0.3  # 30% outbound

        record = generate_log_record(TEST_PROJECT_ID, timestamp, is_outbound)
        batch.append([record[col] for col in columns])

        if len(batch) >= batch_size:
            client.insert(table="logs", data=batch, column_names=columns)
            total_inserted += len(batch)
            elapsed = time.time() - start_time
            rate = total_inserted / elapsed
            print(f"  Progress: {total_inserted:,}/{count:,} ({100*total_inserted//count}%) - {rate:.0f} records/sec")
            batch = []

    # Insert remaining
    if batch:
        client.insert(table="logs", data=batch, column_names=columns)
        total_inserted += len(batch)

    elapsed = time.time() - start_time
    rate = total_inserted / elapsed

    print(f"\n  RESULT: Inserted {total_inserted:,} records in {elapsed:.2f}s ({rate:.0f} records/sec)")

    # Verify
    result = client.query(f"SELECT count() FROM logs WHERE toString(project_id) = '{TEST_PROJECT_ID}'")
    total = result.result_rows[0][0]
    print(f"  Total logs for project: {total:,}")

    return {"success": True, "count": total_inserted, "rate": rate, "elapsed": elapsed}


# =============================================================================
# Test 2: Ingest API Throughput
# =============================================================================

def test_ingest_api_throughput(requests_count: int = 1000, concurrency: int = 10):
    """Test Ingest API throughput with concurrent requests."""
    print("\n" + "="*60)
    print(f"TEST 2: Ingest API Throughput ({requests_count} requests, {concurrency} concurrent)")
    print("="*60)

    ingest_url = f"{BACKEND_URL}/api/ingest"

    def send_request(i):
        payload = {
            "request_id": f"test_req_{uuid.uuid4().hex[:16]}",
            "timestamp": datetime.now().isoformat(),
            "endpoint": f"/api/v1/test/endpoint/{i}",
            "method": random.choice(METHODS),
            "status_code": random.choice([200, 201, 400, 500]),
            "response_time_ms": random.randint(10, 500),
            "user_id": f"test_user_{i % 10}",
            "module": random.choice(MODULES),
            "is_outbound": False
        }

        start = time.time()
        try:
            # Use API key auth for ingest
            resp = requests.post(
                ingest_url,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key": f"sk_live_{TEST_PROJECT_ID}"
                },
                timeout=10
            )
            elapsed = time.time() - start
            return {"success": resp.status_code in [200, 201], "status": resp.status_code, "time": elapsed}
        except Exception as e:
            return {"success": False, "error": str(e), "time": time.time() - start}

    # Run concurrent requests
    start_time = time.time()
    results = []

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(send_request, i) for i in range(requests_count)]
        for future in as_completed(futures):
            results.append(future.result())

    total_time = time.time() - start_time
    successful = sum(1 for r in results if r.get("success"))
    failed = requests_count - successful
    avg_time = sum(r.get("time", 0) for r in results) / len(results)
    throughput = requests_count / total_time

    print(f"\n  RESULTS:")
    print(f"    Total requests: {requests_count}")
    print(f"    Successful: {successful} ({100*successful//requests_count}%)")
    print(f"    Failed: {failed}")
    print(f"    Total time: {total_time:.2f}s")
    print(f"    Throughput: {throughput:.0f} requests/sec")
    print(f"    Avg response time: {avg_time*1000:.2f}ms")

    if failed > 0:
        errors = [r.get("error") or f"status={r.get('status')}" for r in results if not r.get("success")]
        print(f"    Sample errors: {errors[:3]}")

    return {"success": failed == 0, "throughput": throughput, "avg_time": avg_time}


# =============================================================================
# Test 3: Query Performance
# =============================================================================

def test_query_performance():
    """Test ClickHouse query performance."""
    print("\n" + "="*60)
    print("TEST 3: ClickHouse Query Performance")
    print("="*60)

    client = clickhouse_connect.get_client(
        host=CLICKHOUSE_HOST,
        port=CLICKHOUSE_PORT,
        database=CLICKHOUSE_DB
    )

    queries = [
        ("Total count", f"SELECT count() FROM logs WHERE toString(project_id) = '{TEST_PROJECT_ID}'"),
        ("Stats aggregation", f"""
            SELECT
                count(*) as total,
                round(countIf(status_code >= 400) * 100.0 / count(*), 2) as error_rate,
                round(avg(response_time_ms), 2) as avg_response_time
            FROM logs
            WHERE toString(project_id) = '{TEST_PROJECT_ID}'
        """),
        ("Time series (hourly)", f"""
            SELECT
                toStartOfHour(timestamp) as hour,
                count(*) as requests,
                countIf(status_code >= 400) as errors
            FROM logs
            WHERE toString(project_id) = '{TEST_PROJECT_ID}'
                AND timestamp >= now() - INTERVAL 24 HOUR
            GROUP BY hour
            ORDER BY hour
        """),
        ("Top endpoints", f"""
            SELECT endpoint, method, count(*) as cnt
            FROM logs
            WHERE toString(project_id) = '{TEST_PROJECT_ID}'
            GROUP BY endpoint, method
            ORDER BY cnt DESC
            LIMIT 10
        """),
        ("Module health", f"""
            SELECT
                module,
                count(*) as total,
                round(countIf(status_code < 400) * 100.0 / count(*), 2) as success_rate
            FROM logs
            WHERE toString(project_id) = '{TEST_PROJECT_ID}'
                AND is_outbound = 0
            GROUP BY module
            ORDER BY total DESC
        """),
        ("Service health", f"""
            SELECT
                third_party_service,
                count(*) as total,
                round(countIf(status_code < 400) * 100.0 / count(*), 2) as success_rate
            FROM logs
            WHERE toString(project_id) = '{TEST_PROJECT_ID}'
                AND is_outbound = 1
                AND third_party_service != ''
            GROUP BY third_party_service
            ORDER BY total DESC
        """),
    ]

    results = []
    for name, query in queries:
        start = time.time()
        result = client.query(query)
        elapsed = time.time() - start
        row_count = len(result.result_rows)

        print(f"\n  {name}:")
        print(f"    Time: {elapsed*1000:.2f}ms")
        print(f"    Rows: {row_count}")
        if row_count > 0 and row_count <= 3:
            print(f"    Data: {result.result_rows}")

        results.append({"name": name, "time": elapsed, "rows": row_count})

    avg_time = sum(r["time"] for r in results) / len(results)
    print(f"\n  SUMMARY: Average query time: {avg_time*1000:.2f}ms")

    return {"success": True, "queries": results, "avg_time": avg_time}


# =============================================================================
# Test 4: API Endpoint Performance
# =============================================================================

def test_api_performance():
    """Test API endpoint response times."""
    print("\n" + "="*60)
    print("TEST 4: API Endpoint Performance")
    print("="*60)

    headers = {"Authorization": f"Bearer {API_TOKEN}"}

    endpoints = [
        ("GET /api/stats", f"{BACKEND_URL}/api/stats?project_id={TEST_PROJECT_ID}&type=all"),
        ("GET /api/stats/timeseries", f"{BACKEND_URL}/api/stats/timeseries?project_id={TEST_PROJECT_ID}&type=all"),
        ("GET /api/stats/top-endpoints", f"{BACKEND_URL}/api/stats/top-endpoints?project_id={TEST_PROJECT_ID}&limit=10"),
        ("GET /api/stats/service-health", f"{BACKEND_URL}/api/stats/service-health?project_id={TEST_PROJECT_ID}"),
        ("GET /api/stats/module-health", f"{BACKEND_URL}/api/stats/module-health?project_id={TEST_PROJECT_ID}"),
        ("GET /api/stats/counts", f"{BACKEND_URL}/api/stats/counts?project_id={TEST_PROJECT_ID}"),
        ("GET /api/logs", f"{BACKEND_URL}/api/logs?project_id={TEST_PROJECT_ID}&limit=50"),
    ]

    results = []
    for name, url in endpoints:
        times = []
        for _ in range(3):  # Run 3 times for average
            start = time.time()
            try:
                resp = requests.get(url, headers=headers, timeout=30)
                elapsed = time.time() - start
                times.append(elapsed)
                status = resp.status_code
            except Exception as e:
                print(f"    ERROR: {name} - {e}")
                status = 0
                times.append(30)  # timeout

        avg_time = sum(times) / len(times)
        print(f"\n  {name}:")
        print(f"    Status: {status}")
        print(f"    Avg time: {avg_time*1000:.2f}ms")

        results.append({"name": name, "status": status, "avg_time": avg_time})

    all_success = all(r["status"] == 200 for r in results)
    avg_time = sum(r["avg_time"] for r in results) / len(results)

    print(f"\n  SUMMARY:")
    print(f"    All endpoints OK: {all_success}")
    print(f"    Average response time: {avg_time*1000:.2f}ms")

    return {"success": all_success, "endpoints": results, "avg_time": avg_time}


# =============================================================================
# Test 5: Concurrent Dashboard Load
# =============================================================================

def test_concurrent_dashboard_load(users: int = 10):
    """Simulate multiple users loading dashboard concurrently."""
    print("\n" + "="*60)
    print(f"TEST 5: Concurrent Dashboard Load ({users} users)")
    print("="*60)

    headers = {"Authorization": f"Bearer {API_TOKEN}"}

    dashboard_requests = [
        f"{BACKEND_URL}/api/stats?project_id={TEST_PROJECT_ID}&type=all",
        f"{BACKEND_URL}/api/stats/timeseries?project_id={TEST_PROJECT_ID}&type=all",
        f"{BACKEND_URL}/api/stats/top-endpoints?project_id={TEST_PROJECT_ID}&limit=5",
        f"{BACKEND_URL}/api/stats/service-health?project_id={TEST_PROJECT_ID}",
        f"{BACKEND_URL}/api/stats/module-health?project_id={TEST_PROJECT_ID}",
        f"{BACKEND_URL}/api/stats/counts?project_id={TEST_PROJECT_ID}",
    ]

    def simulate_user(user_id):
        """Simulate a single user loading the dashboard."""
        start = time.time()
        results = []
        for url in dashboard_requests:
            try:
                resp = requests.get(url, headers=headers, timeout=30)
                results.append(resp.status_code == 200)
            except:
                results.append(False)
        elapsed = time.time() - start
        return {"user": user_id, "success": all(results), "time": elapsed}

    start_time = time.time()

    with ThreadPoolExecutor(max_workers=users) as executor:
        futures = [executor.submit(simulate_user, i) for i in range(users)]
        results = [f.result() for f in as_completed(futures)]

    total_time = time.time() - start_time
    successful = sum(1 for r in results if r["success"])
    avg_load_time = sum(r["time"] for r in results) / len(results)

    print(f"\n  RESULTS:")
    print(f"    Users simulated: {users}")
    print(f"    Successful loads: {successful}/{users}")
    print(f"    Total time: {total_time:.2f}s")
    print(f"    Avg dashboard load time: {avg_load_time:.2f}s")

    return {"success": successful == users, "avg_load_time": avg_load_time}


# =============================================================================
# Main
# =============================================================================

def run_all_tests(seed_count: int = 100000):
    """Run all performance tests."""
    print("\n" + "#"*60)
    print(" SidMonitor Performance Test Suite")
    print("#"*60)

    results = {}

    # Test 1: Seed data
    results["seed"] = test_seed_large_dataset(count=seed_count, days=7)

    # Test 2: Ingest API (skip if no API key setup)
    # results["ingest"] = test_ingest_api_throughput(requests_count=100, concurrency=5)
    print("\n  [SKIP] Ingest API test - requires API key setup")

    # Test 3: Query performance
    results["queries"] = test_query_performance()

    # Test 4: API performance
    results["api"] = test_api_performance()

    # Test 5: Concurrent load
    results["concurrent"] = test_concurrent_dashboard_load(users=10)

    # Summary
    print("\n" + "#"*60)
    print(" FINAL SUMMARY")
    print("#"*60)

    for test_name, result in results.items():
        status = "PASS" if result.get("success") else "FAIL"
        print(f"  {test_name}: {status}")

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SidMonitor Performance Tests")
    parser.add_argument("--seed-count", type=int, default=100000, help="Number of logs to seed")
    parser.add_argument("--test", choices=["all", "seed", "query", "api", "concurrent"], default="all")

    args = parser.parse_args()

    if args.test == "all":
        run_all_tests(seed_count=args.seed_count)
    elif args.test == "seed":
        test_seed_large_dataset(count=args.seed_count)
    elif args.test == "query":
        test_query_performance()
    elif args.test == "api":
        test_api_performance()
    elif args.test == "concurrent":
        test_concurrent_dashboard_load()
