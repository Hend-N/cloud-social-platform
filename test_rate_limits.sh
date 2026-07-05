#!/bin/bash

set -euo pipefail

# ============================================================
# Rate Limit Test Script
# ============================================================
# This script intentionally triggers gateway rate limits.
#
# This is separate from test_all_services.sh because:
# - test_all_services.sh should prove normal app behavior works.
# - test_rate_limits.sh should intentionally create 429 responses.
#
# IMPORTANT:
# Do not use curl -f here.
#
# Why?
# curl -f treats 4xx/5xx responses as command failures.
# But in this script, 401 and 429 are expected responses.
# So we want to capture them, not crash immediately.
# ============================================================

GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:8080}"

AUTH_URL="$GATEWAY_URL/api/auth"
HEALTH_URL="$GATEWAY_URL/health"
METRICS_URL="$GATEWAY_URL/metrics"

echo "========================================"
echo "RATE LIMIT TESTS"
echo "========================================"
echo "Gateway: $GATEWAY_URL"
echo

# ============================================================
# Helper: make login request and return status code
# ============================================================
login_attempt() {
  curl -sS -o /dev/null -w "%{http_code}" \
    -X POST "$AUTH_URL/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"fake@test.com","password":"password123"}'
}

# ============================================================
# Helper: assert two values are equal
# ============================================================
assert_equals() {
  local expected="$1"
  local actual="$2"
  local message="$3"

  if [[ "$expected" != "$actual" ]]; then
    echo "FAIL: $message"
    echo "Expected: $expected"
    echo "Actual:   $actual"
    exit 1
  fi

  echo "PASS: $message"
}

# ============================================================
# Helper: assert value is one of two allowed values
# ============================================================
assert_one_of_two() {
  local option_one="$1"
  local option_two="$2"
  local actual="$3"
  local message="$4"

  if [[ "$actual" != "$option_one" && "$actual" != "$option_two" ]]; then
    echo "FAIL: $message"
    echo "Expected one of: $option_one, $option_two"
    echo "Actual:          $actual"
    exit 1
  fi

  echo "PASS: $message"
}

# ============================================================
# Test 1: Health endpoint should not be rate limited
# ============================================================
echo "Test 1: /health should stay available"

for i in {1..10}; do
  STATUS=$(curl -sS -o /dev/null -w "%{http_code}" "$HEALTH_URL")
  assert_equals "200" "$STATUS" "health request $i returned 200"
done

echo

# ============================================================
# Test 2: Login route should be rate limited
# ============================================================
# Your auth_login rule allows:
#
# capacity = 5
#
# That means the first 5 fake logins should reach auth-service.
# Since credentials are fake, auth-service returns 401.
#
# After that, the gateway should block requests before auth-service.
# Those should return 429.
# ============================================================

echo "Test 2: /api/auth/login should return 401 first, then 429"

EXPECTED_STATUSES=("401" "401" "401" "401" "401" "429" "429" "429")

for i in {0..7}; do
  ATTEMPT_NUMBER=$((i + 1))
  STATUS=$(login_attempt)
  EXPECTED="${EXPECTED_STATUSES[$i]}"

  assert_equals "$EXPECTED" "$STATUS" "login attempt $ATTEMPT_NUMBER returned $EXPECTED"
done

echo

# ============================================================
# Test 3: 429 response should include rate-limit headers
# ============================================================
# We make one more login attempt after the bucket is empty.
# It should be blocked with 429.
#
# We verify:
# - status code is 429
# - X-RateLimit-Rule exists
# - Retry-After exists
# ============================================================

echo "Test 3: 429 response should include rate-limit headers"

HEADERS_FILE=$(mktemp)

STATUS=$(curl -sS -D "$HEADERS_FILE" -o /dev/null -w "%{http_code}" \
  -X POST "$AUTH_URL/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"fake@test.com","password":"password123"}')

assert_equals "429" "$STATUS" "extra login attempt returned 429"

if grep -qi "^x-ratelimit-rule: auth_login" "$HEADERS_FILE"; then
  echo "PASS: X-RateLimit-Rule header is auth_login"
else
  echo "FAIL: missing or incorrect X-RateLimit-Rule header"
  echo "Headers:"
  cat "$HEADERS_FILE"
  rm -f "$HEADERS_FILE"
  exit 1
fi

if grep -qi "^retry-after:" "$HEADERS_FILE"; then
  echo "PASS: Retry-After header exists"
else
  echo "FAIL: missing Retry-After header"
  echo "Headers:"
  cat "$HEADERS_FILE"
  rm -f "$HEADERS_FILE"
  exit 1
fi

rm -f "$HEADERS_FILE"

echo

# ============================================================
# Test 4: Metrics endpoint should be available
# ============================================================
# This test assumes you add the /metrics endpoint from the next section.
#
# It accepts either:
# - 200 if /metrics is already added
# - 404 if you have not added observability yet
#
# After you add observability, it should become 200.
# ============================================================

echo "Test 4: /metrics endpoint check"

METRICS_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" "$METRICS_URL")

assert_equals "200" "$METRICS_STATUS" "metrics endpoint returned 200"

echo
echo "========================================"
echo "DONE"
echo "========================================"
echo "Rate limit tests passed."
