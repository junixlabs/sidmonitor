#!/usr/bin/env python3
"""
Seed Data Generator for ClickHouse Log Monitoring Dashboard
Generates realistic test data for inbound_requests and outbound_requests tables.

Usage:
    python seed_data.py [--host HOST] [--port PORT] [--database DATABASE]
                        [--days DAYS] [--inbound-count COUNT] [--outbound-count COUNT]

Example:
    python seed_data.py --host localhost --port 8123 --days 30 --inbound-count 50000
"""

import argparse
import random
import uuid
import json
from datetime import datetime, timedelta
from typing import Generator
import sys

try:
    import clickhouse_connect
except ImportError:
    print("Error: clickhouse-connect not installed. Run: pip install clickhouse-connect")
    sys.exit(1)


# =============================================================================
# Configuration Constants
# =============================================================================

# Laravel-like modules
MODULES = [
    "auth", "users", "orders", "products", "payments",
    "inventory", "reports", "notifications", "admin", "api"
]

# Common API endpoints grouped by module
ENDPOINTS_BY_MODULE = {
    "auth": [
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh-token",
        "/api/v1/auth/forgot-password",
        "/api/v1/auth/reset-password",
        "/api/v1/auth/verify-email",
    ],
    "users": [
        "/api/v1/users",
        "/api/v1/users/{id}",
        "/api/v1/users/{id}/profile",
        "/api/v1/users/{id}/preferences",
        "/api/v1/users/{id}/activity",
        "/api/v1/users/search",
    ],
    "orders": [
        "/api/v1/orders",
        "/api/v1/orders/{id}",
        "/api/v1/orders/{id}/status",
        "/api/v1/orders/{id}/items",
        "/api/v1/orders/{id}/cancel",
        "/api/v1/orders/{id}/refund",
        "/api/v1/orders/history",
    ],
    "products": [
        "/api/v1/products",
        "/api/v1/products/{id}",
        "/api/v1/products/{id}/variants",
        "/api/v1/products/{id}/reviews",
        "/api/v1/products/categories",
        "/api/v1/products/search",
        "/api/v1/products/featured",
    ],
    "payments": [
        "/api/v1/payments",
        "/api/v1/payments/{id}",
        "/api/v1/payments/methods",
        "/api/v1/payments/process",
        "/api/v1/payments/webhook",
        "/api/v1/payments/refund",
    ],
    "inventory": [
        "/api/v1/inventory",
        "/api/v1/inventory/{id}",
        "/api/v1/inventory/stock",
        "/api/v1/inventory/warehouses",
        "/api/v1/inventory/transfers",
    ],
    "reports": [
        "/api/v1/reports/sales",
        "/api/v1/reports/users",
        "/api/v1/reports/orders",
        "/api/v1/reports/revenue",
        "/api/v1/reports/export",
    ],
    "notifications": [
        "/api/v1/notifications",
        "/api/v1/notifications/{id}",
        "/api/v1/notifications/read",
        "/api/v1/notifications/settings",
    ],
    "admin": [
        "/api/v1/admin/dashboard",
        "/api/v1/admin/users",
        "/api/v1/admin/settings",
        "/api/v1/admin/logs",
        "/api/v1/admin/cache",
    ],
    "api": [
        "/api/v1/health",
        "/api/v1/version",
        "/api/v1/status",
    ],
}

# HTTP methods with weighted distribution
HTTP_METHODS = {
    "GET": 60,
    "POST": 25,
    "PUT": 8,
    "PATCH": 4,
    "DELETE": 3,
}

# Status codes with weighted distribution (realistic error rates)
STATUS_CODES = {
    200: 75,
    201: 10,
    204: 3,
    400: 4,
    401: 3,
    403: 2,
    404: 2,
    500: 1,
}

# Tags for requests
TAGS = [
    "mobile", "web", "api", "internal", "external",
    "premium", "free-tier", "beta", "legacy", "v2",
    "high-priority", "batch", "async", "sync", "cached",
]

# Third-party services for outbound requests
THIRD_PARTY_SERVICES = {
    "stripe": {
        "base_url": "https://api.stripe.com/v1",
        "endpoints": [
            "/charges",
            "/customers",
            "/payment_intents",
            "/refunds",
            "/subscriptions",
            "/invoices",
        ],
        "weight": 25,
    },
    "twilio": {
        "base_url": "https://api.twilio.com/2010-04-01",
        "endpoints": [
            "/Messages.json",
            "/Calls.json",
            "/Accounts/{AccountSid}/Messages.json",
        ],
        "weight": 15,
    },
    "sendgrid": {
        "base_url": "https://api.sendgrid.com/v3",
        "endpoints": [
            "/mail/send",
            "/templates",
            "/marketing/contacts",
        ],
        "weight": 20,
    },
    "aws-s3": {
        "base_url": "https://s3.amazonaws.com",
        "endpoints": [
            "/bucket/object",
            "/bucket/upload",
            "/bucket/download",
        ],
        "weight": 20,
    },
    "firebase": {
        "base_url": "https://fcm.googleapis.com/v1",
        "endpoints": [
            "/projects/myproject/messages:send",
        ],
        "weight": 10,
    },
    "elasticsearch": {
        "base_url": "https://search.internal.com:9200",
        "endpoints": [
            "/products/_search",
            "/orders/_search",
            "/users/_search",
            "/_bulk",
        ],
        "weight": 10,
    },
}

# Error messages for failed requests
ERROR_MESSAGES_INBOUND = {
    400: [
        "Invalid request body",
        "Missing required field: email",
        "Validation failed",
        "Invalid JSON format",
        "Parameter out of range",
    ],
    401: [
        "Token expired",
        "Invalid credentials",
        "Authentication required",
        "Invalid API key",
    ],
    403: [
        "Access denied",
        "Insufficient permissions",
        "Resource forbidden",
    ],
    404: [
        "Resource not found",
        "User not found",
        "Order not found",
        "Product not found",
    ],
    500: [
        "Internal server error",
        "Database connection failed",
        "Service unavailable",
        "Unexpected error occurred",
    ],
}

ERROR_MESSAGES_OUTBOUND = {
    400: ["Invalid request to external service", "Bad request format"],
    401: ["API key invalid", "Authentication failed with service"],
    403: ["Rate limit exceeded", "Access forbidden"],
    404: ["External resource not found"],
    500: ["Service temporarily unavailable", "Gateway timeout", "Connection refused"],
    502: ["Bad gateway", "Upstream server error"],
    503: ["Service unavailable", "Maintenance mode"],
}

# User agents for realistic data
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0",
    "PostmanRuntime/7.35.0",
    "curl/8.4.0",
    "okhttp/4.12.0",
    "axios/1.6.0",
    "python-requests/2.31.0",
]

# Sample user data
SAMPLE_USERS = [
    {"id": "usr_001", "email": "john.doe@example.com"},
    {"id": "usr_002", "email": "jane.smith@example.com"},
    {"id": "usr_003", "email": "bob.wilson@example.com"},
    {"id": "usr_004", "email": "alice.johnson@example.com"},
    {"id": "usr_005", "email": "charlie.brown@example.com"},
    {"id": "usr_006", "email": "diana.prince@example.com"},
    {"id": "usr_007", "email": "admin@example.com"},
    {"id": "usr_008", "email": "support@example.com"},
    {"id": "usr_009", "email": "developer@example.com"},
    {"id": "usr_010", "email": "tester@example.com"},
    {"id": "", "email": ""},  # Anonymous requests
]


# =============================================================================
# Helper Functions
# =============================================================================

def weighted_choice(choices: dict) -> str:
    """Select a random item based on weights."""
    items = list(choices.keys())
    weights = list(choices.values())
    return random.choices(items, weights=weights, k=1)[0]


def generate_uuid() -> str:
    """Generate a UUID string."""
    return str(uuid.uuid4())


def generate_request_id() -> str:
    """Generate a request ID in Laravel-like format."""
    return f"req_{uuid.uuid4().hex[:16]}"


def generate_trace_id() -> str:
    """Generate a trace ID for distributed tracing."""
    return f"trace_{uuid.uuid4().hex[:24]}"


def generate_ip_address() -> str:
    """Generate a random IP address."""
    # Mix of public and private IPs for realism
    if random.random() < 0.2:
        # Private IP (internal)
        return f"10.0.{random.randint(0, 255)}.{random.randint(1, 254)}"
    else:
        # Public IP
        return f"{random.randint(1, 223)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}"


def generate_response_time(status_code: int) -> int:
    """Generate realistic response time in milliseconds."""
    # Error responses tend to be faster (fail fast)
    if status_code >= 500:
        return random.randint(100, 5000)  # Server errors can be slow (timeouts)
    elif status_code >= 400:
        return random.randint(5, 100)  # Client errors are fast
    else:
        # Success responses follow a distribution
        # Most are fast, some are slow
        if random.random() < 0.9:
            return random.randint(10, 500)  # Fast responses
        else:
            return random.randint(500, 3000)  # Slow responses (p90+)


def generate_response_size(method: str, status_code: int) -> int:
    """Generate realistic response size in bytes."""
    if status_code == 204:
        return 0
    elif status_code >= 400:
        return random.randint(100, 500)  # Error responses are small
    elif method == "GET":
        return random.randint(500, 50000)
    elif method in ["POST", "PUT", "PATCH"]:
        return random.randint(100, 5000)
    else:
        return random.randint(50, 200)


def generate_tags() -> list:
    """Generate random tags for a request."""
    num_tags = random.choices([0, 1, 2, 3], weights=[30, 40, 20, 10])[0]
    return random.sample(TAGS, min(num_tags, len(TAGS)))


def generate_query_string(endpoint: str, method: str) -> str:
    """Generate realistic query strings."""
    if method != "GET":
        return ""

    if random.random() < 0.3:
        return ""

    params = []

    if "search" in endpoint:
        params.append(f"q={random.choice(['test', 'product', 'user', 'order'])}")

    if random.random() < 0.5:
        params.append(f"page={random.randint(1, 20)}")

    if random.random() < 0.4:
        params.append(f"limit={random.choice([10, 20, 50, 100])}")

    if random.random() < 0.2:
        params.append(f"sort={random.choice(['created_at', 'updated_at', 'name', 'id'])}")

    return "&".join(params) if params else ""


def resolve_endpoint_path(endpoint: str) -> tuple:
    """Replace {id} placeholders with actual IDs and return (endpoint, path)."""
    path = endpoint
    if "{id}" in endpoint:
        entity_id = random.randint(1, 10000)
        path = endpoint.replace("{id}", str(entity_id))
    if "{AccountSid}" in endpoint:
        path = endpoint.replace("{AccountSid}", f"AC{uuid.uuid4().hex[:32]}")
    return (endpoint, path)


def generate_metadata() -> str:
    """Generate random metadata JSON."""
    if random.random() < 0.7:
        return "{}"

    metadata = {}
    if random.random() < 0.3:
        metadata["client_version"] = f"{random.randint(1, 5)}.{random.randint(0, 9)}.{random.randint(0, 20)}"
    if random.random() < 0.2:
        metadata["device_type"] = random.choice(["ios", "android", "web", "desktop"])
    if random.random() < 0.1:
        metadata["feature_flags"] = random.sample(["new_ui", "beta_checkout", "fast_search"], 2)

    return json.dumps(metadata)


# =============================================================================
# Data Generators
# =============================================================================

def generate_inbound_requests(
    count: int,
    start_date: datetime,
    end_date: datetime
) -> Generator[dict, None, None]:
    """Generate inbound request records."""

    time_range_seconds = int((end_date - start_date).total_seconds())

    for _ in range(count):
        # Random timestamp within range
        random_seconds = random.randint(0, time_range_seconds)
        timestamp = start_date + timedelta(seconds=random_seconds)

        # Select module and endpoint
        module = random.choice(MODULES)
        endpoints = ENDPOINTS_BY_MODULE.get(module, ENDPOINTS_BY_MODULE["api"])
        endpoint_template = random.choice(endpoints)
        endpoint, path = resolve_endpoint_path(endpoint_template)

        # Select method based on endpoint
        if endpoint.endswith("/search") or endpoint.endswith("/history"):
            method = "GET"
        elif endpoint.endswith("/cancel") or endpoint.endswith("/refund"):
            method = "POST"
        elif any(x in endpoint for x in ["login", "logout", "register", "process"]):
            method = "POST"
        else:
            method = weighted_choice(HTTP_METHODS)

        # Select status code
        status_code = weighted_choice(STATUS_CODES)

        # Select user
        user = random.choice(SAMPLE_USERS)

        # Generate error info if applicable
        error_message = ""
        error_class = ""
        if status_code >= 400:
            errors = ERROR_MESSAGES_INBOUND.get(status_code, ["Unknown error"])
            error_message = random.choice(errors)
            if status_code >= 500:
                error_class = random.choice(["Exception", "RuntimeException", "DatabaseException", "ServiceException"])
            else:
                error_class = random.choice(["ValidationException", "AuthenticationException", "NotFoundHttpException"])

        record = {
            "request_id": generate_request_id(),
            "trace_id": generate_trace_id() if random.random() < 0.8 else "",
            "timestamp": timestamp,
            "method": method,
            "endpoint": endpoint,
            "path": path,
            "query_string": generate_query_string(endpoint, method),
            "user_id": user["id"],
            "user_email": user["email"],
            "module": module,
            "tags": generate_tags(),
            "status_code": status_code,
            "response_time_ms": generate_response_time(status_code),
            "response_size_bytes": generate_response_size(method, status_code),
            "ip_address": generate_ip_address(),
            "user_agent": random.choice(USER_AGENTS),
            "error_message": error_message,
            "error_class": error_class,
            "metadata": generate_metadata(),
        }

        yield record


def generate_outbound_requests(
    count: int,
    start_date: datetime,
    end_date: datetime,
    parent_request_ids: list = None
) -> Generator[dict, None, None]:
    """Generate outbound request records (third-party API calls)."""

    time_range_seconds = int((end_date - start_date).total_seconds())

    # Service selection weights
    service_weights = {name: info["weight"] for name, info in THIRD_PARTY_SERVICES.items()}

    for _ in range(count):
        # Random timestamp within range
        random_seconds = random.randint(0, time_range_seconds)
        timestamp = start_date + timedelta(seconds=random_seconds)

        # Select service
        service_name = weighted_choice(service_weights)
        service_info = THIRD_PARTY_SERVICES[service_name]

        endpoint = random.choice(service_info["endpoints"])
        service_url = service_info["base_url"] + endpoint

        # Determine method based on endpoint
        if any(x in endpoint for x in ["_search", "download"]):
            method = "GET"
        elif any(x in endpoint for x in ["send", "upload", "_bulk"]):
            method = "POST"
        else:
            method = random.choice(["GET", "POST"])

        # Success rate varies by service
        success_rate = 0.95 if service_name in ["stripe", "sendgrid"] else 0.90
        is_success = 1 if random.random() < success_rate else 0

        # Status code based on success
        if is_success:
            status_code = random.choices([200, 201, 204], weights=[80, 15, 5])[0]
        else:
            status_code = weighted_choice({400: 20, 401: 15, 403: 10, 404: 5, 500: 30, 502: 10, 503: 10})

        # Error info
        error_message = ""
        error_code = ""
        if not is_success:
            errors = ERROR_MESSAGES_OUTBOUND.get(status_code, ["Service error"])
            error_message = random.choice(errors)
            error_code = f"ERR_{status_code}_{random.randint(1000, 9999)}"

        # Response time (external services are slower)
        if is_success:
            response_time = random.randint(50, 2000)
        else:
            response_time = random.randint(100, 30000)  # Failures can timeout

        # Retry count (only for failures that were retried)
        retry_count = 0
        if not is_success and random.random() < 0.3:
            retry_count = random.randint(1, 3)

        # Module context
        module_mapping = {
            "stripe": "payments",
            "twilio": "notifications",
            "sendgrid": "notifications",
            "firebase": "notifications",
            "aws-s3": "inventory",
            "elasticsearch": "products",
        }
        module = module_mapping.get(service_name, "api")

        # User context
        user = random.choice(SAMPLE_USERS)

        record = {
            "request_id": generate_request_id(),
            "parent_request_id": random.choice(parent_request_ids) if parent_request_ids and random.random() < 0.7 else "",
            "trace_id": generate_trace_id() if random.random() < 0.7 else "",
            "timestamp": timestamp,
            "service_name": service_name,
            "service_url": service_url,
            "method": method,
            "endpoint": endpoint,
            "module": module,
            "user_id": user["id"],
            "status_code": status_code,
            "response_time_ms": response_time,
            "response_size_bytes": random.randint(100, 10000),
            "is_success": is_success,
            "error_message": error_message,
            "error_code": error_code,
            "retry_count": retry_count,
            "request_headers": json.dumps({"Authorization": "Bearer ***", "Content-Type": "application/json"}),
            "response_headers": json.dumps({"Content-Type": "application/json", "X-Request-Id": generate_uuid()}),
            "metadata": generate_metadata(),
        }

        yield record


# =============================================================================
# Database Operations
# =============================================================================

def insert_batch(client, table: str, records: list, database: str = "sid_monitoring"):
    """Insert a batch of records into ClickHouse."""
    if not records:
        return

    columns = list(records[0].keys())
    data = [[record[col] for col in columns] for record in records]

    client.insert(
        table=f"{database}.{table}",
        data=data,
        column_names=columns
    )


def seed_database(
    host: str = "localhost",
    port: int = 8123,
    database: str = "sid_monitoring",
    user: str = "default",
    password: str = "",
    days: int = 30,
    inbound_count: int = 50000,
    outbound_count: int = 20000,
    batch_size: int = 5000,
):
    """Main function to seed the database with test data."""

    print(f"Connecting to ClickHouse at {host}:{port}...")

    client = clickhouse_connect.get_client(
        host=host,
        port=port,
        database=database,
        username=user,
        password=password,
    )

    # Calculate date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    print(f"\nGenerating data for {days} days ({start_date.date()} to {end_date.date()})")
    print(f"  - Inbound requests: {inbound_count:,}")
    print(f"  - Outbound requests: {outbound_count:,}")

    # Generate and insert inbound requests
    print(f"\n[1/2] Inserting inbound_requests...")
    inbound_batch = []
    parent_request_ids = []
    inserted = 0

    for record in generate_inbound_requests(inbound_count, start_date, end_date):
        inbound_batch.append(record)
        parent_request_ids.append(record["request_id"])

        if len(inbound_batch) >= batch_size:
            insert_batch(client, "inbound_requests", inbound_batch, database)
            inserted += len(inbound_batch)
            print(f"  Progress: {inserted:,}/{inbound_count:,} ({100*inserted//inbound_count}%)")
            inbound_batch = []

    # Insert remaining
    if inbound_batch:
        insert_batch(client, "inbound_requests", inbound_batch, database)
        inserted += len(inbound_batch)
        print(f"  Progress: {inserted:,}/{inbound_count:,} (100%)")

    print(f"  Completed: {inserted:,} inbound requests inserted")

    # Generate and insert outbound requests
    print(f"\n[2/2] Inserting outbound_requests...")
    outbound_batch = []
    inserted = 0

    for record in generate_outbound_requests(outbound_count, start_date, end_date, parent_request_ids):
        outbound_batch.append(record)

        if len(outbound_batch) >= batch_size:
            insert_batch(client, "outbound_requests", outbound_batch, database)
            inserted += len(outbound_batch)
            print(f"  Progress: {inserted:,}/{outbound_count:,} ({100*inserted//outbound_count}%)")
            outbound_batch = []

    # Insert remaining
    if outbound_batch:
        insert_batch(client, "outbound_requests", outbound_batch, database)
        inserted += len(outbound_batch)
        print(f"  Progress: {inserted:,}/{outbound_count:,} (100%)")

    print(f"  Completed: {inserted:,} outbound requests inserted")

    # Print summary
    print("\n" + "="*60)
    print("SEED DATA GENERATION COMPLETE")
    print("="*60)

    # Verify counts
    inbound_total = client.query(f"SELECT count() FROM {database}.inbound_requests").result_rows[0][0]
    outbound_total = client.query(f"SELECT count() FROM {database}.outbound_requests").result_rows[0][0]

    print(f"\nVerification:")
    print(f"  - inbound_requests: {inbound_total:,} rows")
    print(f"  - outbound_requests: {outbound_total:,} rows")

    print("\nSample queries you can run:")
    print("  SELECT count(), avg(response_time_ms) FROM inbound_requests WHERE timestamp >= now() - INTERVAL 24 HOUR;")
    print("  SELECT service_name, count(), countIf(is_success=0) as errors FROM outbound_requests GROUP BY service_name;")


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate seed data for ClickHouse log monitoring")

    parser.add_argument("--host", default="localhost", help="ClickHouse host (default: localhost)")
    parser.add_argument("--port", type=int, default=8123, help="ClickHouse HTTP port (default: 8123)")
    parser.add_argument("--database", default="sid_monitoring", help="Database name (default: sid_monitoring)")
    parser.add_argument("--user", default="default", help="ClickHouse user (default: default)")
    parser.add_argument("--password", default="", help="ClickHouse password (default: empty)")
    parser.add_argument("--days", type=int, default=30, help="Days of data to generate (default: 30)")
    parser.add_argument("--inbound-count", type=int, default=50000, help="Number of inbound requests (default: 50000)")
    parser.add_argument("--outbound-count", type=int, default=20000, help="Number of outbound requests (default: 20000)")
    parser.add_argument("--batch-size", type=int, default=5000, help="Batch size for inserts (default: 5000)")

    args = parser.parse_args()

    try:
        seed_database(
            host=args.host,
            port=args.port,
            database=args.database,
            user=args.user,
            password=args.password,
            days=args.days,
            inbound_count=args.inbound_count,
            outbound_count=args.outbound_count,
            batch_size=args.batch_size,
        )
    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)
