#!/bin/bash

set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:8080}"

echo "========================================"
echo "GATEWAY ROUTE RULE TESTS"
echo "========================================"
echo "Gateway: $GATEWAY_URL"
echo


wait_for_gateway() {
  echo "Waiting for gateway to become ready..."

  for i in {1..30}; do
    STATUS=$(curl -sS --max-time 2 -o /dev/null -w "%{http_code}" "$GATEWAY_URL/health" || true)

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


request_status() {
  local method="$1"
  local url="$2"

# ============================================================
  # We intentionally avoid curl -f here.
  #
  # Why?
  # Some expected results are 401.
  # curl -f would treat 401 as an error and stop the script.
  #
  # We also use "|| true" so network-level errors like:
  # curl: (52) Empty reply from server
  # do not instantly kill the script without showing a useful status.
# ============================================================

  STATUS=$(curl -sS --max-time 5 -o /dev/null -w "%{http_code}" \
    -X "$method" \
    "$url" || true)

  if [[ -z "$STATUS" ]]; then
    echo "000"
  else
    echo "$STATUS"
  fi
}


wait_for_gateway


echo "========================================"
echo "Public exact routes"
echo "========================================"

STATUS=$(request_status GET "$GATEWAY_URL/health")
assert_equals "200" "$STATUS" "GET /health is public"

STATUS=$(request_status GET "$GATEWAY_URL/metrics")
assert_equals "200" "$STATUS" "GET /metrics is public"

STATUS=$(request_status GET "$GATEWAY_URL/api/posts")
assert_equals "200" "$STATUS" "GET /api/posts is public"


echo
echo "========================================"
echo "Public pattern routes with valid IDs"
echo "========================================"

STATUS=$(request_status GET "$GATEWAY_URL/api/comments/post/1")
assert_equals "200" "$STATUS" "GET /api/comments/post/1 is public"

STATUS=$(request_status GET "$GATEWAY_URL/api/likes/posts/1/count")
assert_equals "200" "$STATUS" "GET /api/likes/posts/1/count is public"

STATUS=$(request_status GET "$GATEWAY_URL/api/follows/users/1/followers")
assert_equals "200" "$STATUS" "GET /api/follows/users/1/followers is public"

STATUS=$(request_status GET "$GATEWAY_URL/api/follows/users/1/following")
assert_equals "200" "$STATUS" "GET /api/follows/users/1/following is public"


echo
echo "========================================"
echo "Invalid public-looking routes should be protected"
echo "========================================"

STATUS=$(request_status GET "$GATEWAY_URL/api/comments/post/me")
assert_equals "401" "$STATUS" "GET /api/comments/post/me is protected because ID is not int"

STATUS=$(request_status GET "$GATEWAY_URL/api/comments/post/0")
assert_equals "401" "$STATUS" "GET /api/comments/post/0 is protected because ID must be positive"

STATUS=$(request_status GET "$GATEWAY_URL/api/likes/posts/me/count")
assert_equals "401" "$STATUS" "GET /api/likes/posts/me/count is protected because ID is not int"

STATUS=$(request_status GET "$GATEWAY_URL/api/follows/users/me/followers")
assert_equals "401" "$STATUS" "GET /api/follows/users/me/followers is protected because ID is not int"

STATUS=$(request_status GET "$GATEWAY_URL/api/posts/me")
assert_equals "401" "$STATUS" "GET /api/posts/me is protected"


echo
echo "========================================"
echo "Protected write routes without token"
echo "========================================"

STATUS=$(request_status POST "$GATEWAY_URL/api/posts/me")
assert_equals "401" "$STATUS" "POST /api/posts/me requires JWT"

STATUS=$(request_status POST "$GATEWAY_URL/api/comments")
assert_equals "401" "$STATUS" "POST /api/comments requires JWT"

STATUS=$(request_status POST "$GATEWAY_URL/api/follows")
assert_equals "401" "$STATUS" "POST /api/follows requires JWT"

STATUS=$(request_status DELETE "$GATEWAY_URL/api/users/me")
assert_equals "401" "$STATUS" "DELETE /api/users/me requires JWT"


echo
echo "========================================"
echo "DONE"
echo "========================================"
echo "Gateway route rule tests passed."