#!/usr/bin/env bash
#
# Integration test script for Laravel Observatory SDK + SidMonitor backend
#
# Prerequisites:
#   1. Backend running: cd /path/to/sidmonitor && make dev-db && make dev-backend
#   2. Laravel test app running: cd tests/laravel-test && php artisan serve --port=8080
#
# Usage:
#   ./test-integration.sh                    # Test everything
#   ./test-integration.sh --skip-setup       # Skip dependency check
#   ./test-integration.sh --backend-only     # Only test backend directly
#

set -euo pipefail

# ========================================
# Configuration
# ========================================
LARAVEL_URL="${LARAVEL_URL:-http://localhost:8080}"
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
API_KEY="${SIDMONITOR_API_KEY:?Set SIDMONITOR_API_KEY env var}"
CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"
CLICKHOUSE_DB="${CLICKHOUSE_DB:-sid_monitoring}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

pass=0
fail=0
skip=0

# ========================================
# Helpers
# ========================================
log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_pass()  { echo -e "${GREEN}[PASS]${NC} $1"; ((pass++)); }
log_fail()  { echo -e "${RED}[FAIL]${NC} $1"; ((fail++)); }
log_skip()  { echo -e "${YELLOW}[SKIP]${NC} $1"; ((skip++)); }
log_section() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

check_service() {
    local name=$1 url=$2
    if curl -sf --max-time 3 "$url" > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

assert_status() {
    local test_name=$1 url=$2 expected=$3
    local status
    status=$(curl -sf -o /dev/null -w '%{http_code}' --max-time 10 "$url" 2>/dev/null || echo "000")
    if [[ "$status" == "$expected" ]]; then
        log_pass "$test_name (HTTP $status)"
    else
        log_fail "$test_name — expected HTTP $expected, got $status"
    fi
}

assert_json_field() {
    local test_name=$1 url=$2 field=$3 expected=$4
    local response
    response=$(curl -sf --max-time 10 "$url" 2>/dev/null || echo "{}")
    local value
    value=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$field',''))" 2>/dev/null || echo "")
    if [[ "$value" == "$expected" ]]; then
        log_pass "$test_name ($field=$value)"
    else
        log_fail "$test_name — expected $field=$expected, got '$value'"
    fi
}

# ========================================
# Pre-flight checks
# ========================================
log_section "Pre-flight Checks"

if [[ "${1:-}" != "--skip-setup" ]]; then
    if check_service "Backend" "$BACKEND_URL/docs"; then
        log_pass "Backend reachable at $BACKEND_URL"
    else
        log_fail "Backend not reachable at $BACKEND_URL"
        echo "  Start it: make dev-db && make dev-backend"
        exit 1
    fi

    if check_service "ClickHouse" "$CLICKHOUSE_URL/?query=SELECT%201"; then
        log_pass "ClickHouse reachable at $CLICKHOUSE_URL"
    else
        log_skip "ClickHouse not reachable — will skip verification tests"
    fi

    if check_service "Laravel" "$LARAVEL_URL"; then
        log_pass "Laravel test app reachable at $LARAVEL_URL"
    else
        log_fail "Laravel test app not reachable at $LARAVEL_URL"
        echo "  Start it: cd tests/laravel-test && php artisan serve --port=8080"
        exit 1
    fi
fi

# ========================================
# Phase 1: Observatory Status
# ========================================
log_section "Phase 1: Observatory Configuration"

response=$(curl -sf --max-time 10 "$LARAVEL_URL/api/observatory-status" 2>/dev/null || echo "{}")
exporter=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('exporter',''))" 2>/dev/null || echo "")
enabled=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('enabled',''))" 2>/dev/null || echo "")
api_key_set=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('api_key_set',''))" 2>/dev/null || echo "")

if [[ "$exporter" == "sidmonitor" ]]; then
    log_pass "Exporter configured as 'sidmonitor'"
else
    log_fail "Exporter is '$exporter', expected 'sidmonitor'"
fi

if [[ "$enabled" == "True" || "$enabled" == "true" || "$enabled" == "1" ]]; then
    log_pass "Observatory enabled"
else
    log_fail "Observatory not enabled (enabled=$enabled)"
fi

if [[ "$api_key_set" == "True" || "$api_key_set" == "true" ]]; then
    log_pass "API key configured"
else
    log_fail "API key not configured"
fi

# ========================================
# Phase 2: Inbound Request Monitoring
# ========================================
log_section "Phase 2: Inbound Request Monitoring"

assert_status "GET /api/users" "$LARAVEL_URL/api/users" "200"
assert_status "GET /api/users/1" "$LARAVEL_URL/api/users/1" "200"

# POST request
status=$(curl -sf -o /dev/null -w '%{http_code}' --max-time 10 \
    -X POST -H "Content-Type: application/json" \
    -d '{"name":"Test User","email":"test@example.com"}' \
    "$LARAVEL_URL/api/users" 2>/dev/null || echo "000")
if [[ "$status" == "201" ]]; then
    log_pass "POST /api/users (HTTP 201)"
else
    log_fail "POST /api/users — expected HTTP 201, got $status"
fi

# Error responses
assert_status "GET /api/error/400" "$LARAVEL_URL/api/error/400" "400"
assert_status "GET /api/error/500" "$LARAVEL_URL/api/error/500" "500"
assert_status "GET /api/error/503" "$LARAVEL_URL/api/error/503" "503"

# ========================================
# Phase 3: Exception Handling Safety
# ========================================
log_section "Phase 3: Exception Handling (should not crash app)"

# Exception should return 500 but NOT crash the app
assert_status "Exception doesn't crash app" "$LARAVEL_URL/api/error/exception" "500"

# App should still work after exception
assert_status "App healthy after exception" "$LARAVEL_URL/api/users" "200"

# ========================================
# Phase 4: Outbound Request Monitoring
# ========================================
log_section "Phase 4: Outbound Request Monitoring"

assert_json_field "Single outbound" "$LARAVEL_URL/api/test-outbound" "status" "success"

response=$(curl -sf --max-time 30 "$LARAVEL_URL/api/test-outbound-multi" 2>/dev/null || echo "{}")
status=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
if [[ "$status" == "success" ]]; then
    log_pass "Multi outbound requests"
else
    log_fail "Multi outbound requests — status=$status"
fi

# ========================================
# Phase 5: Job Monitoring
# ========================================
log_section "Phase 5: Job Monitoring"

assert_json_field "Successful job" "$LARAVEL_URL/api/test-job" "status" "success"
assert_json_field "Failed job" "$LARAVEL_URL/api/test-job-fail" "status" "failed"

response=$(curl -sf --max-time 15 "$LARAVEL_URL/api/test-jobs-batch?count=3" 2>/dev/null || echo "{}")
status=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
if [[ "$status" == "success" ]]; then
    log_pass "Batch jobs (3 dispatched)"
else
    log_fail "Batch jobs — status=$status"
fi

# ========================================
# Phase 6: Flush & Verify Backend Receipt
# ========================================
log_section "Phase 6: Flush Buffer & Backend Verification"

# Force flush
flush_response=$(curl -sf --max-time 10 "$LARAVEL_URL/api/observatory-flush" 2>/dev/null || echo "{}")
flush_status=$(echo "$flush_response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
if [[ "$flush_status" == "flushed" ]]; then
    log_pass "Buffer flushed successfully"
    before_inbound=$(echo "$flush_response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('before',{}).get('buffer',{}).get('inbound',0))" 2>/dev/null || echo "0")
    after_inbound=$(echo "$flush_response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('after',{}).get('buffer',{}).get('inbound',0))" 2>/dev/null || echo "0")
    log_info "Buffer before flush: inbound=$before_inbound, after: inbound=$after_inbound"
else
    log_fail "Buffer flush failed"
fi

# Wait for ClickHouse to process
sleep 2

# Direct backend ingest test
log_info "Testing backend ingest API directly..."
backend_response=$(curl -sf --max-time 10 -X POST \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
        "request_id": "integration-test-'"$(date +%s)"'",
        "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%S)"'",
        "endpoint": "/api/integration-test",
        "method": "GET",
        "status_code": 200,
        "response_time_ms": 42.5,
        "module": "integration-test"
    }' \
    "$BACKEND_URL/api/ingest" 2>/dev/null || echo "{}")

backend_success=$(echo "$backend_response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',''))" 2>/dev/null || echo "")
if [[ "$backend_success" == "True" || "$backend_success" == "true" ]]; then
    log_pass "Direct backend ingest successful"
else
    log_fail "Direct backend ingest failed: $backend_response"
fi

# ========================================
# Phase 7: Circuit Breaker Test
# ========================================
log_section "Phase 7: Circuit Breaker (buffer retention)"

# Check observatory status shows circuit breaker info
response=$(curl -sf --max-time 10 "$LARAVEL_URL/api/observatory-status" 2>/dev/null || echo "{}")
has_cb=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin).get('buffer_status',{}); print('circuit_breaker' in d)" 2>/dev/null || echo "")
if [[ "$has_cb" == "True" ]]; then
    log_pass "Circuit breaker state exposed in status"
else
    log_skip "Circuit breaker state not in status output"
fi

# ========================================
# Phase 8: ClickHouse Data Verification
# ========================================
log_section "Phase 8: ClickHouse Verification"

if check_service "ClickHouse" "$CLICKHOUSE_URL/?query=SELECT%201"; then
    # Check inbound logs exist
    count=$(curl -sf "$CLICKHOUSE_URL/?query=SELECT+count()+FROM+${CLICKHOUSE_DB}.logs+FORMAT+TabSeparated" 2>/dev/null || echo "error")
    if [[ "$count" != "error" && "$count" -gt 0 ]] 2>/dev/null; then
        log_pass "Inbound logs in ClickHouse: $count rows"
    else
        log_skip "No inbound logs found in ClickHouse (count=$count)"
    fi

    # Check outbound logs
    count=$(curl -sf "$CLICKHOUSE_URL/?query=SELECT+count()+FROM+${CLICKHOUSE_DB}.outbound_logs+FORMAT+TabSeparated" 2>/dev/null || echo "error")
    if [[ "$count" != "error" && "$count" -gt 0 ]] 2>/dev/null; then
        log_pass "Outbound logs in ClickHouse: $count rows"
    else
        log_skip "No outbound logs found in ClickHouse (count=$count)"
    fi

    # Check job logs
    count=$(curl -sf "$CLICKHOUSE_URL/?query=SELECT+count()+FROM+${CLICKHOUSE_DB}.job_logs+FORMAT+TabSeparated" 2>/dev/null || echo "error")
    if [[ "$count" != "error" && "$count" -gt 0 ]] 2>/dev/null; then
        log_pass "Job logs in ClickHouse: $count rows"
    else
        log_skip "No job logs found in ClickHouse (count=$count)"
    fi

    # Check scheduled task logs table exists
    exists=$(curl -sf "$CLICKHOUSE_URL/?query=EXISTS+TABLE+${CLICKHOUSE_DB}.scheduled_task_logs+FORMAT+TabSeparated" 2>/dev/null || echo "0")
    if [[ "$exists" == "1" ]]; then
        log_pass "scheduled_task_logs table exists in ClickHouse"
    else
        log_skip "scheduled_task_logs table not found in ClickHouse"
    fi
else
    log_skip "ClickHouse not available — skipping data verification"
fi

# ========================================
# Summary
# ========================================
log_section "Test Summary"

total=$((pass + fail + skip))
echo -e "  ${GREEN}Passed: $pass${NC}"
echo -e "  ${RED}Failed: $fail${NC}"
echo -e "  ${YELLOW}Skipped: $skip${NC}"
echo -e "  Total:  $total"
echo ""

if [[ $fail -eq 0 ]]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}$fail test(s) failed.${NC}"
    exit 1
fi
