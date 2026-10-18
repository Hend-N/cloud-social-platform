#!/usr/bin/env bash
# Finds which hop of  browser -> Vite -> gateway -> auth-service  is broken.
GATEWAY="${GATEWAY:-http://localhost:8000}"
FRONTEND="${FRONTEND:-http://localhost:5173}"
u="diag$RANDOM"
body="{\"username\":\"$u\",\"email\":\"$u@example.com\",\"password\":\"password123\"}"

echo "1) Gateway health        GET  $GATEWAY/health"
curl -s -m 5 -w "\n   -> HTTP %{http_code}\n" "$GATEWAY/health" || echo "   -> nothing is listening (connection refused)"

echo; echo "2) Register via gateway  POST $GATEWAY/api/auth/register"
curl -s -m 10 -w "\n   -> HTTP %{http_code}\n" -X POST "$GATEWAY/api/auth/register" \
  -H 'Content-Type: application/json' -d "$body" || echo "   -> nothing is listening"

echo; echo "3) Register via Vite     POST $FRONTEND/api/auth/register"
curl -s -m 10 -w "\n   -> HTTP %{http_code}\n" -X POST "$FRONTEND/api/auth/register" \
  -H 'Content-Type: application/json' -d "$body" || echo "   -> nothing is listening"

cat << 'TXT'

How to read the results
  Step 1/2 connection refused ........ gateway isn't running (start it, or run backend/run-local.sh)
  Step 2 {"detail":"Not Found"} ...... you're talking to a single service, not the gateway (wrong port)
  Step 2 "route not found" ........... gateway reached, path not allowed (check the URL / trailing slash)
  Step 2 502/503 ..................... gateway can't reach auth-service (hostnames/URLs; use run-local.sh)
  Step 2 200 but Step 3 404/HTML ..... Vite proxy missing: restart `npm run dev` after editing vite.config.ts,
                                       and note `npm run preview` needs the same proxy (now configured)
  Step 2 and 3 both 200 ............. backend is fine; the problem is in the browser (stale bundle, CORS origin)
TXT
