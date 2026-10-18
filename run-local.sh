#!/usr/bin/env bash
# Run the gateway and all six services WITHOUT Docker.
#   ./run-local.sh            start everything
#   ./run-local.sh --install  pip-install every service's requirements first
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  # Generate independent random signing and internal-service secrets on first run.
  python - <<'PYCODE'
from pathlib import Path
import re
import secrets
s = Path('.env.example').read_text()
for name in ('SECRET_KEY', 'INTERNAL_SERVICE_SECRET'):
    s = re.sub(rf'(?m)^{name}=.*$', f'{name}={secrets.token_urlsafe(48)}', s)
Path('.env').write_text(s)
PYCODE
  chmod 600 .env
  echo ">> Created .env with locally generated secrets"
fi
set -a; source .env; set +a

# Inside Docker the services reach each other by hostname. Locally they are
# all on localhost, so override those values.
export AUTH_SERVICE_URL=http://127.0.0.1:8001
export USER_SERVICE_URL=http://127.0.0.1:8002
export POST_SERVICE_URL=http://127.0.0.1:8003
export LIKE_SERVICE_URL=http://127.0.0.1:8004
export FOLLOW_SERVICE_URL=http://127.0.0.1:8005
export COMMENT_SERVICE_URL=http://127.0.0.1:8006
export REDIS_HOST=127.0.0.1
export REDIS_URL=redis://127.0.0.1:6379/0

SERVICES="auth-service:8001 user-service:8002 post-service:8003 like-service:8004 follow-service:8005 comment-service:8006"

if [ "${1:-}" = "--install" ]; then
  for entry in $SERVICES; do pip install -r "services/${entry%%:*}/requirements.txt"; done
  pip install -r gateway/requirements.txt
fi

if command -v redis-cli >/dev/null 2>&1 && redis-cli ping >/dev/null 2>&1; then
  echo ">> Redis is running"
else
  echo ">> WARNING: Redis not reachable on 127.0.0.1:6379."
  echo "   Comment/like cleanup events need it:  docker run -d -p 6379:6379 redis:7-alpine"
fi

PIDS=()
cleanup() { echo; echo ">> stopping"; kill "${PIDS[@]}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

for entry in $SERVICES; do
  name="${entry%%:*}"; port="${entry##*:}"
  ( cd "services/$name" && exec python -m uvicorn main:app --host 127.0.0.1 --port "$port" ) &
  PIDS+=($!)
  echo ">> $name on :$port"
done

( cd gateway && exec python -m uvicorn main:app --host 127.0.0.1 --port 8000 ) &
PIDS+=($!)
echo ">> gateway on :8000   (frontend: cd ../frontend && npm run dev)"
wait
