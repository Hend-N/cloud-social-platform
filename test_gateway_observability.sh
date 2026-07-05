#!/bin/bash

set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:8080}"

METRICS_URL="$GATEWAY_URL/metrics"
METRICS_JSON_URL="$GATEWAY_URL/metrics/json"
HEALTH_URL="$GATEWAY_URL/health"

echo "========================================"
echo "GATEWAY OBSERVABILITY TESTS"
echo "========================================"
echo "Gateway: $GATEWAY_URL"
echo


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


assert_contains() {
  local text="$1"
  local expected="$2"
  local message="$3"

  if ! grep -q "$expected" <<< "$text"; then
    echo "FAIL: $message"
    echo "Expected to find: $expected"
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
  echo
  echo "Check logs with:"
  echo "docker compose logs gateway --tail=100"
  exit 1
}


get_json_value() {
  local key="$1"

  curl -sS "$METRICS_JSON_URL" | python3 -c "
import json
import sys

data = json.load(sys.stdin)
value = data.get('$key')

if value is None:
    print('')
else:
    print(value)
"
}


wait_for_gateway


echo "========================================"
echo "1. /metrics should return Prometheus text"
echo "========================================"

METRICS_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" "$METRICS_URL")
assert_equals "200" "$METRICS_STATUS" "/metrics returned 200"

METRICS_TEXT=$(curl -sS "$METRICS_URL")

assert_contains "$METRICS_TEXT" "gateway_requests_total" "Prometheus exposes gateway_requests_total"
assert_contains "$METRICS_TEXT" "gateway_rate_limited_requests_total" "Prometheus exposes rate-limit metric"
assert_contains "$METRICS_TEXT" "gateway_auth_failed_requests_total" "Prometheus exposes auth failure metric"
assert_contains "$METRICS_TEXT" "gateway_error_requests_total" "Prometheus exposes gateway error metric"
assert_contains "$METRICS_TEXT" "gateway_request_body_too_large_total" "Prometheus exposes request body size metric"
assert_contains "$METRICS_TEXT" "gateway_retry_attempts_total" "Prometheus exposes retry attempts metric"
assert_contains "$METRICS_TEXT" "gateway_requests_retried_total" "Prometheus exposes retried requests metric"
assert_contains "$METRICS_TEXT" "gateway_circuit_opened_total" "Prometheus exposes circuit opened metric"
assert_contains "$METRICS_TEXT" "gateway_circuit_rejected_requests_total" "Prometheus exposes circuit rejected metric"
assert_contains "$METRICS_TEXT" "gateway_circuit_state" "Prometheus exposes circuit state gauge"


echo
echo "========================================"
echo "2. /metrics/json should return valid JSON"
echo "========================================"

METRICS_JSON_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" "$METRICS_JSON_URL")
assert_equals "200" "$METRICS_JSON_STATUS" "/metrics/json returned 200"

curl -sS "$METRICS_JSON_URL" | python3 -m json.tool > /dev/null
echo "PASS: /metrics/json is valid JSON"

TOTAL_REQUESTS=$(get_json_value "total_requests")
if [[ -z "$TOTAL_REQUESTS" ]]; then
  echo "FAIL: total_requests missing from /metrics/json"
  exit 1
fi
echo "PASS: /metrics/json includes total_requests"

RETRY_ATTEMPTS=$(get_json_value "retry_attempts")
if [[ -z "$RETRY_ATTEMPTS" ]]; then
  echo "FAIL: retry_attempts missing from /metrics/json"
  exit 1
fi
echo "PASS: /metrics/json includes retry_attempts"

REQUESTS_RETRIED=$(get_json_value "requests_retried")
if [[ -z "$REQUESTS_RETRIED" ]]; then
  echo "FAIL: requests_retried missing from /metrics/json"
  exit 1
fi
echo "PASS: /metrics/json includes requests_retried"

BODY_TOO_LARGE_BEFORE=$(get_json_value "request_body_too_large")
if [[ -z "$BODY_TOO_LARGE_BEFORE" ]]; then
  echo "FAIL: request_body_too_large missing from /metrics/json"
  exit 1
fi
echo "PASS: /metrics/json includes request_body_too_large"

CIRCUIT_OPENED=$(get_json_value "circuit_opened_total")
if [[ -z "$CIRCUIT_OPENED" ]]; then
  echo "FAIL: circuit_opened_total missing from /metrics/json"
  exit 1
fi
echo "PASS: /metrics/json includes circuit_opened_total"

CIRCUIT_REJECTED=$(get_json_value "circuit_rejected_requests")
if [[ -z "$CIRCUIT_REJECTED" ]]; then
  echo "FAIL: circuit_rejected_requests missing from /metrics/json"
  exit 1
fi
echo "PASS: /metrics/json includes circuit_rejected_requests"


echo
echo "========================================"
echo "3. Request body size metric should increase after 413"
echo "========================================"

LARGE_STATUS=$(python3 - <<'PY'
import http.client

host = "127.0.0.1"
port = 8080
path = "/api/auth/login"

payload = "x" * (2 * 1024 * 1024)

connection = http.client.HTTPConnection(host, port)
connection.request(
    "POST",
    path,
    body=payload,
    headers={"Content-Type": "application/json"}
)

response = connection.getresponse()
print(response.status)
connection.close()
PY
)

assert_equals "413" "$LARGE_STATUS" "large request returned 413"

BODY_TOO_LARGE_AFTER=$(get_json_value "request_body_too_large")

python3 - <<PY
before = int("$BODY_TOO_LARGE_BEFORE")
after = int("$BODY_TOO_LARGE_AFTER")

if after <= before:
    raise SystemExit(
        f"FAIL: request_body_too_large did not increase. before={before}, after={after}"
    )

print(f"PASS: request_body_too_large increased from {before} to {after}")
PY


echo
echo "========================================"
echo "4. Prometheus metric should reflect request body rejection"
echo "========================================"

UPDATED_METRICS_TEXT=$(curl -sS "$METRICS_URL")

assert_contains "$UPDATED_METRICS_TEXT" "gateway_request_body_too_large_total" "Prometheus still exposes body-too-large metric"

PROM_BODY_TOO_LARGE=$(echo "$UPDATED_METRICS_TEXT" | awk '/^gateway_request_body_too_large_total / {print $2}')

if [[ -z "$PROM_BODY_TOO_LARGE" ]]; then
  echo "FAIL: Could not read gateway_request_body_too_large_total value"
  exit 1
fi

python3 - <<PY
value = float("$PROM_BODY_TOO_LARGE")

if value < 1:
    raise SystemExit(
        f"FAIL: gateway_request_body_too_large_total expected >= 1, got {value}"
    )

print(f"PASS: gateway_request_body_too_large_total is {value}")
PY


echo
echo "========================================"
echo "DONE"
echo "========================================"
echo "Gateway observability tests passed."
