#!/bin/bash

set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:8080}"

# Docker Compose service name.
# Change this only if your docker-compose.yml uses a different name.
DOWNSTREAM_CONTAINER_SERVICE="${DOWNSTREAM_CONTAINER_SERVICE:-post-service}"

# Gateway route/service name.
# /api/posts maps to service_name="posts" in SERVICE_MAP.
CIRCUIT_SERVICE_NAME="${CIRCUIT_SERVICE_NAME:-posts}"

# These should match your gateway env defaults.
CIRCUIT_FAILURE_THRESHOLD="${CIRCUIT_FAILURE_THRESHOLD:-3}"
CIRCUIT_COOLDOWN_SECONDS="${CIRCUIT_COOLDOWN_SECONDS:-10}"

TEST_ROUTE="$GATEWAY_URL/api/posts"
HEALTH_URL="$GATEWAY_URL/health"
METRICS_JSON_URL="$GATEWAY_URL/metrics/json"

HEADERS_FILE="/tmp/gateway_circuit_headers.txt"
BODY_FILE="/tmp/gateway_circuit_body.txt"

echo "========================================"
echo "GATEWAY CIRCUIT BREAKER TESTS"
echo "========================================"
echo "Gateway: $GATEWAY_URL"
echo "Downstream container service: $DOWNSTREAM_CONTAINER_SERVICE"
echo "Circuit service name: $CIRCUIT_SERVICE_NAME"
echo


cleanup() {
  echo
  echo "Cleanup: making sure $DOWNSTREAM_CONTAINER_SERVICE is running..."
  docker compose up -d "$DOWNSTREAM_CONTAINER_SERVICE" > /dev/null 2>&1 || true
}

trap cleanup EXIT


assert_equals() {
  local expected="$1"
  local actual="$2"
  local message="$3"

  if [[ "$expected" != "$actual" ]]; then
    echo "FAIL: $message"
    echo "Expected: $expected"
    echo "Actual:   $actual"
    echo
    echo "Response headers:"
    cat "$HEADERS_FILE" 2>/dev/null || true
    echo
    echo "Response body:"
    cat "$BODY_FILE" 2>/dev/null || true
    echo
    exit 1
  fi

  echo "PASS: $message"
}


assert_contains_file() {
  local file="$1"
  local expected="$2"
  local message="$3"

  if ! grep -qi "$expected" "$file"; then
    echo "FAIL: $message"
    echo "Expected to find: $expected"
    echo
    echo "File content:"
    cat "$file" 2>/dev/null || true
    exit 1
  fi

  echo "PASS: $message"
}


wait_for_gateway() {
  echo "Waiting for gateway to become ready..."

  for i in {1..30}; do
    STATUS=$(curl -sS --max-time 2 -o /dev/null -w "%{http_code}" "$HEALTH_URL" || true)

    if [[ "$STATUS" == "200" ]]; then
      echo "Gateway is ready."
      echo
      return 0
    fi

    echo "Gateway not ready yet... attempt $i/30, status=$STATUS"
    sleep 1
  done

  echo "FAIL: Gateway did not become ready after 30 seconds."
  echo "Check logs with:"
  echo "docker compose logs gateway --tail=100"
  exit 1
}


wait_for_downstream_route() {
  echo "Waiting for $TEST_ROUTE to become reachable..."

  for i in {1..30}; do
    STATUS=$(curl -sS --max-time 3 -o /dev/null -w "%{http_code}" "$TEST_ROUTE" || true)

    if [[ "$STATUS" == "200" ]]; then
      echo "Downstream route is reachable."
      echo
      return 0
    fi

    echo "Route not ready yet... attempt $i/30, status=$STATUS"
    sleep 1
  done

  echo "FAIL: $TEST_ROUTE did not become reachable after 30 seconds."
  echo "Check logs with:"
  echo "docker compose logs $DOWNSTREAM_CONTAINER_SERVICE --tail=100"
  echo "docker compose logs gateway --tail=100"
  exit 1
}


request_route_capture() {
  curl -sS \
    -D "$HEADERS_FILE" \
    -o "$BODY_FILE" \
    -w "%{http_code}" \
    "$TEST_ROUTE" || true
}


get_circuit_state_from_json() {
  curl -sS "$METRICS_JSON_URL" | CIRCUIT_SERVICE_NAME="$CIRCUIT_SERVICE_NAME" python3 -c '
import json
import os
import sys

service_name = os.environ["CIRCUIT_SERVICE_NAME"]

data = json.load(sys.stdin)
breakers = data.get("circuit_breakers", {})
service_breaker = breakers.get(service_name, {})

print(service_breaker.get("state", "missing"))
'
}


get_json_metric() {
  local key="$1"

  curl -sS "$METRICS_JSON_URL" | METRIC_KEY="$key" python3 -c '
import json
import os
import sys

key = os.environ["METRIC_KEY"]

data = json.load(sys.stdin)
print(data.get(key, "missing"))
'
}


echo "========================================"
echo "1. Start clean"
echo "========================================"

docker compose up -d "$DOWNSTREAM_CONTAINER_SERVICE" > /dev/null
docker compose restart gateway > /dev/null

wait_for_gateway
wait_for_downstream_route

INITIAL_STATUS=$(request_route_capture)
assert_equals "200" "$INITIAL_STATUS" "GET /api/posts works before breaking downstream service"

INITIAL_CIRCUIT_STATE=$(get_circuit_state_from_json)

if [[ "$INITIAL_CIRCUIT_STATE" != "closed" && "$INITIAL_CIRCUIT_STATE" != "missing" ]]; then
  echo "FAIL: Expected initial circuit state to be closed, got $INITIAL_CIRCUIT_STATE"
  exit 1
fi

if [[ "$INITIAL_CIRCUIT_STATE" == "closed" ]]; then
  echo "PASS: initial circuit state is closed"
else
  echo "WARN: circuit_breakers state missing from /metrics/json"
  echo "      The circuit behavior can still be tested through response headers."
fi


echo
echo "========================================"
echo "2. Stop downstream service"
echo "========================================"

docker compose stop "$DOWNSTREAM_CONTAINER_SERVICE" > /dev/null
echo "Stopped $DOWNSTREAM_CONTAINER_SERVICE"


echo
echo "========================================"
echo "3. Trigger circuit failures"
echo "========================================"

for i in $(seq 1 "$CIRCUIT_FAILURE_THRESHOLD"); do
  STATUS=$(request_route_capture)

  if [[ "$STATUS" != "503" && "$STATUS" != "504" ]]; then
    echo "FAIL: Expected failed downstream request to return 503 or 504, got $STATUS"
    echo
    echo "Headers:"
    cat "$HEADERS_FILE"
    echo
    echo "Body:"
    cat "$BODY_FILE"
    exit 1
  fi

  echo "PASS: failure request $i/$CIRCUIT_FAILURE_THRESHOLD returned $STATUS"
done


echo
echo "========================================"
echo "4. Circuit should now reject fast"
echo "========================================"

OPEN_STATUS=$(request_route_capture)
assert_equals "503" "$OPEN_STATUS" "request after threshold returns 503"

assert_contains_file "$HEADERS_FILE" "X-Circuit-State: open" "response includes X-Circuit-State: open"
assert_contains_file "$HEADERS_FILE" "Retry-After:" "response includes Retry-After header"

if grep -q "service circuit is open" "$BODY_FILE"; then
  echo "PASS: response body says circuit is open"
else
  echo "FAIL: response body did not say circuit is open"
  cat "$BODY_FILE"
  exit 1
fi

CIRCUIT_REJECTED=$(get_json_metric "circuit_rejected_requests")

if [[ "$CIRCUIT_REJECTED" == "missing" ]]; then
  echo "WARN: circuit_rejected_requests missing from /metrics/json"
else
  python3 - <<PY
value = int("$CIRCUIT_REJECTED")

if value < 1:
    raise SystemExit(f"FAIL: circuit_rejected_requests expected >= 1, got {value}")

print(f"PASS: circuit_rejected_requests is {value}")
PY
fi


echo
echo "========================================"
echo "5. Restart downstream service"
echo "========================================"

docker compose up -d "$DOWNSTREAM_CONTAINER_SERVICE" > /dev/null
echo "Started $DOWNSTREAM_CONTAINER_SERVICE"

# The gateway circuit is still open here, so /api/posts may still return 503.
# We wait for cooldown so the circuit can move to half-open and test the service.
SLEEP_SECONDS=$((CIRCUIT_COOLDOWN_SECONDS + 2))

echo "Waiting $SLEEP_SECONDS seconds for circuit cooldown..."
sleep "$SLEEP_SECONDS"


echo
echo "========================================"
echo "6. Circuit should recover after cooldown"
echo "========================================"

RECOVERY_STATUS=$(request_route_capture)
assert_equals "200" "$RECOVERY_STATUS" "request after cooldown succeeds and closes circuit"

FINAL_CIRCUIT_STATE=$(get_circuit_state_from_json)

if [[ "$FINAL_CIRCUIT_STATE" == "closed" ]]; then
  echo "PASS: final circuit state is closed"
elif [[ "$FINAL_CIRCUIT_STATE" == "missing" ]]; then
  echo "WARN: final circuit state missing from /metrics/json"
else
  echo "FAIL: Expected final circuit state closed, got $FINAL_CIRCUIT_STATE"
  exit 1
fi


echo
echo "========================================"
echo "7. Prometheus metrics should expose circuit metrics"
echo "========================================"

METRICS_TEXT=$(curl -sS "$GATEWAY_URL/metrics")

if grep -q "gateway_circuit_opened_total" <<< "$METRICS_TEXT"; then
  echo "PASS: Prometheus exposes gateway_circuit_opened_total"
else
  echo "FAIL: Prometheus missing gateway_circuit_opened_total"
  exit 1
fi

if grep -q "gateway_circuit_rejected_requests_total" <<< "$METRICS_TEXT"; then
  echo "PASS: Prometheus exposes gateway_circuit_rejected_requests_total"
else
  echo "FAIL: Prometheus missing gateway_circuit_rejected_requests_total"
  exit 1
fi

if grep -q "gateway_circuit_state" <<< "$METRICS_TEXT"; then
  echo "PASS: Prometheus exposes gateway_circuit_state"
else
  echo "FAIL: Prometheus missing gateway_circuit_state"
  exit 1
fi


echo
echo "========================================"
echo "DONE"
echo "========================================"
echo "Gateway circuit breaker tests passed."
