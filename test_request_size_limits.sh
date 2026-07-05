#!/bin/bash

set -e

GATEWAY_URL="http://127.0.0.1:8080"

echo "Testing request body size limits..."

echo "1. Health endpoint should still work"
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/health")

if [ "$HEALTH_STATUS" != "200" ]; then
  echo "FAIL: Expected /health to return 200, got $HEALTH_STATUS"
  exit 1
fi

echo "2. Small public login request should not return 413"
SMALL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$GATEWAY_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"fake@example.com","password":"wrongpassword"}')

if [ "$SMALL_STATUS" = "413" ]; then
  echo "FAIL: Small request unexpectedly returned 413"
  exit 1
fi

echo "3. Large request should return 413"
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

if [ "$LARGE_STATUS" != "413" ]; then
  echo "FAIL: Expected large request to return 413, got $LARGE_STATUS"
  exit 1
fi

echo "DONE"
echo "Request body size limit tests passed."
