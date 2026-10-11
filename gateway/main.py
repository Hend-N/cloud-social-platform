from importlib.resources import path
import os
import time
import uuid
import json
import httpx
import asyncio
import logging
import redis.asyncio as redis
from datetime import datetime, UTC
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from jose import jwt, JWTError

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi import BackgroundTasks

# ============================================================
# 1. ENVIRONMENT / CONFIGURATION
# ============================================================

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")

if SECRET_KEY is None:
    raise RuntimeError("SECRET_KEY is missing. Add it to your .env file.")

ALGORITHM = "HS256"

# ============================================================
# 2. LOGGING CONFIGURATION/ MESSAGE SIZE/ RETRY CONFIGURATION/ REDIS
# ============================================================

RETRY_ATTEMPTS = max(
    1,
    int(os.getenv("GATEWAY_RETRY_ATTEMPTS", "2"))
)

RETRY_BACKOFF_SECONDS = float(
    os.getenv("GATEWAY_RETRY_BACKOFF_SECONDS", "0.15")
)

RETRYABLE_METHODS = {"GET", "HEAD", "OPTIONS"}

RETRYABLE_STATUS_CODES = {502, 503, 504}

CIRCUIT_FAILURE_STATUS_CODES = {500, 502, 503, 504}

MAX_REQUEST_BODY_SIZE_BYTES = int(
    os.getenv("MAX_REQUEST_BODY_SIZE_BYTES", str(1024 * 1024))
)

CIRCUIT_FAILURE_THRESHOLD = int(
    os.getenv("CIRCUIT_FAILURE_THRESHOLD", "3")
)

CIRCUIT_COOLDOWN_SECONDS = float(
    os.getenv("CIRCUIT_COOLDOWN_SECONDS", "10")
)

REDIS_URL = os.getenv(
    "REDIS_URL",
    "redis://localhost:6379/0"
)

RATE_LIMIT_BACKEND = os.getenv(
    "RATE_LIMIT_BACKEND",
    "memory"
).lower()

RATE_LIMIT_KEY_PREFIX = os.getenv(
    "RATE_LIMIT_KEY_PREFIX",
    "gateway:rate_limit"
)

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(message)s"
)

logger = logging.getLogger("api-gateway")

def log_event(event: str, level: str = "info", **fields):

    log_data = {
        "timestamp": datetime.now(UTC).isoformat(),
        "level": level.lower(),
        "event": event,
    }

    # Add extra fields while skipping None values.
    # Skipping None keeps logs cleaner.
    for key, value in fields.items():
        if value is not None:
            log_data[key] = value

    message = json.dumps(
        log_data,
        default=str,
        separators=(",", ":")
    )

    if level == "error":
        logger.error(message)
    elif level == "warning":
        logger.warning(message)
    else:
        logger.info(message)




# ============================================================
# 3. FASTAPI LIFESPAN / SHARED HTTP CLIENT
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(
            timeout=10.0,
            connect=2.0,
            read=10.0,
            write=10.0
        )
    )

    app.state.redis_client = None

    if RATE_LIMIT_BACKEND == "redis":
        app.state.redis_client = redis.from_url(
            REDIS_URL,
            decode_responses=True
        )

        await app.state.redis_client.ping()

    log_event(
        "gateway_startup",
        shared_http_client_created=True,
        redis_enabled=RATE_LIMIT_BACKEND == "redis",
        redis_url=REDIS_URL if RATE_LIMIT_BACKEND == "redis" else None,
        timeout_seconds=10.0
    )

    yield

    await app.state.http_client.aclose()

    if app.state.redis_client is not None:
        await app.state.redis_client.aclose()

    log_event(
        "gateway_shutdown",
        shared_http_client_closed=True,
        redis_client_closed=app.state.redis_client is not None
    )


app = FastAPI(lifespan=lifespan)


# ============================================================
# 4. CORS CONFIGURATION
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# 5. SERVICE ROUTING CONFIGURATION
# ============================================================
# External gateway route:
#   /api/posts/me
#
# Internal service route:
#   http://post-service:8000/posts/me

SERVICE_MAP = {
    "auth": {
        "base_url": os.getenv("AUTH_SERVICE_URL", "http://auth-service:8000"),
        "prefix": ""
    },
    "users": {
        "base_url": os.getenv("USER_SERVICE_URL", "http://user-service:8000"),
        "prefix": "/profiles"
    },
    "posts": {
        "base_url": os.getenv("POST_SERVICE_URL", "http://post-service:8000"),
        "prefix": "/posts"
    },
    "likes": {
        "base_url": os.getenv("LIKE_SERVICE_URL", "http://like-service:8000"),
        "prefix": "/likes"
    },
    "follows": {
        "base_url": os.getenv("FOLLOW_SERVICE_URL", "http://follow-service:8000"),
        "prefix": "/follows"
    },
    "comments": {
        "base_url": os.getenv("COMMENT_SERVICE_URL", "http://comment-service:8000"),
        "prefix": "/comments"
    },
    "profiles": {
        "base_url": os.getenv("USER_SERVICE_URL", "http://user-service:8000"),
        "prefix": "/profiles"
    }
}

circuit_breakers = {
    service_name: {
        "state": "closed",
        "failure_count": 0,
        "opened_at": None
    }
    for service_name in SERVICE_MAP
}

# ============================================================
# 6. HEADER FILTERING CONFIGURATION
# ============================================================

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
}

BLOCKED_REQUEST_HEADERS = HOP_BY_HOP_HEADERS | {
    "host",
    "content-length",
    "x-user-id",
    "x-user-email",
}

BLOCKED_RESPONSE_HEADERS = HOP_BY_HOP_HEADERS | {
    "content-length",
    "date",
    "server",
}


# ============================================================
# 7. PUBLIC ROUTE CONFIGURATION
# ============================================================
PUBLIC_EXACT_ROUTES = {
    ("GET", "/health"),
    ("GET", "/metrics"),
    ("GET", "/metrics/json"),
    ("POST", "/api/auth/register"),
    ("POST", "/api/auth/login"),
    ("GET", "/api/posts"),
}

PUBLIC_PATTERN_ROUTES = [
    {
        "method": "GET",
        "pattern": ["api", "profiles", "{str}"],
    },
    {
        "method": "GET",
        "pattern": ["api", "profiles", "user", "{int}"],
    },
    {
        "method": "GET",
        "pattern": ["api", "users", "{str}"],
    },
    {
        "method": "GET",
        "pattern": ["api", "users", "user", "{int}"],
    },
    {
        "method": "GET",
        "pattern": ["api", "comments", "post", "{int}"],
    },
    {
        "method": "GET",
        "pattern": ["api", "likes", "posts", "{int}", "count"],
    },
    {
        "method": "GET",
        "pattern": ["api", "likes", "comments", "{int}", "count"],
    },
    {
        "method": "GET",
        "pattern": ["api", "follows", "users", "{int}", "followers"],
    },
    {
        "method": "GET",
        "pattern": ["api", "follows", "users", "{int}", "following"],
    },
    {
        "method": "GET",
        "pattern": ["api", "follows", "users", "{int}", "stats"],
    },
    {
        "method": "GET",
        "pattern": ["api", "posts", "user", "{int}"],
    },
]

# NOTE: "/api/profiles/me" and "/api/users/me" are intentionally NOT public,
# even though they would otherwise match the "{str}"/"username" pattern
# above. classify_route() checks PROTECTED routes before PUBLIC routes so
# that reserved paths like "me" are never accidentally treated as a public
# username lookup.
PROTECTED_EXACT_ROUTES = {
    ("GET", "/api/auth/me"),

    ("POST", "/api/profiles/me"),
    ("GET", "/api/profiles/me"),
    ("PUT", "/api/profiles/me"),
    ("DELETE", "/api/profiles/me"),
    ("POST", "/api/profiles/me/avatar"),
    ("POST", "/api/users/me"),
    ("GET", "/api/users/me"),
    ("PUT", "/api/users/me"),
    ("DELETE", "/api/users/me"),
    ("POST", "/api/users/me/avatar"),

    ("POST", "/api/posts"),
    ("POST", "/api/posts/me"),
    ("GET", "/api/posts/me"),

    ("GET", "/api/likes/me"),
    ("GET", "/api/likes/comments/me"),
    ("POST", "/api/likes/comments/batch-reactions"),

    ("POST", "/api/follows"),
    ("GET", "/api/follows/me"),
    ("GET", "/api/follows/me/followers"),

    ("POST", "/api/comments"),
    ("GET", "/api/comments/user/me"),
}

PROTECTED_PATTERN_ROUTES = [
    # Posts
    {
        "method": "PUT",
        "pattern": ["api", "posts", "{int}"],
    },
    {
        "method": "DELETE",
        "pattern": ["api", "posts", "{int}"],
    },

    # Post likes
    {
        "method": "POST",
        "pattern": ["api", "likes", "posts", "{int}"],
    },
    {
        "method": "DELETE",
        "pattern": ["api", "likes", "posts", "{int}"],
    },

    # Comment reactions
    {
        "method": "POST",
        "pattern": ["api", "likes", "comments", "{int}"],
    },
    {
        "method": "POST",
        "pattern": ["api", "likes", "comments", "{int}", "dislike"],
    },
    {
        "method": "DELETE",
        "pattern": ["api", "likes", "comments", "{int}"],
    },
    {
        "method": "GET",
        "pattern": ["api", "likes", "comments", "{int}", "reaction"],
    },

    # Follows
    {
        "method": "DELETE",
        "pattern": ["api", "follows", "{int}"],
    },
    {
        "method": "GET",
        "pattern": ["api", "follows", "status", "{int}"],
    },

    # Comments
    {
        "method": "PUT",
        "pattern": ["api", "comments", "{int}"],
    },
    {
        "method": "DELETE",
        "pattern": ["api", "comments", "{int}"],
    },
]


# ============================================================
# 8. RATE LIMIT CONFIGURATION
# ============================================================

RATE_LIMIT_SKIP_PATHS = {
    "/health",
    "/metrics",
    "/metrics/json"
}

DEFAULT_RATE_LIMIT = {
    "name": "default",
    "capacity": 60,
    "refill_rate": 1.0
}

# Data-driven rate-limit rules.
#
# match styles:
#
# exact:
#   path must equal rule["path"]
#
# pattern:
#   path must match rule["pattern"]
#
# prefix:
#   path must start with rule["path"]
#
# We only use prefix for broad fallback rules, not for precise public
# routes with IDs.

RATE_LIMIT_RULES = [
    {
        "name": "auth_login",
        "method": "POST",
        "match": "exact",
        "path": "/api/auth/login",
        "capacity": 5,
        "refill_rate": 1 / 12
    },
    {
        "name": "auth_register",
        "method": "POST",
        "match": "exact",
        "path": "/api/auth/register",
        "capacity": 3,
        "refill_rate": 1 / 20
    },
    {
        "name": "public_posts_read",
        "method": "GET",
        "match": "exact",
        "path": "/api/posts",
        "capacity": 120,
        "refill_rate": 2.0
    },
    {
        "name": "public_profile_read",
        "method": "GET",
        "match": "pattern",
        "pattern": ["api", "users", "{str}"],
        "capacity": 120,
        "refill_rate": 2.0
    },
    {
        "name": "public_comments_read",
        "method": "GET",
        "match": "pattern",
        "pattern": ["api", "comments", "post", "{int}"],
        "capacity": 120,
        "refill_rate": 2.0
    },
    {
        "name": "public_likes_count",
        "method": "GET",
        "match": "pattern",
        "pattern": ["api", "likes", "posts", "{int}", "count"],
        "capacity": 120,
        "refill_rate": 2.0
    },
    {
        "name": "public_followers_read",
        "method": "GET",
        "match": "pattern",
        "pattern": ["api", "follows", "users", "{int}", "followers"],
        "capacity": 120,
        "refill_rate": 2.0
    },
    {
        "name": "public_following_read",
        "method": "GET",
        "match": "pattern",
        "pattern": ["api", "follows", "users", "{int}", "following"],
        "capacity": 120,
        "refill_rate": 2.0
    },
    {
        "name": "authenticated_api_default",
        "method": "*",
        "match": "prefix",
        "path": "/api/",
        "capacity": 60,
        "refill_rate": 1.0
    },
]

rate_limit_buckets = {}


# ============================================================
# 9. BASIC IN-MEMORY METRICS
# ============================================================

gateway_metrics = {
    "started_at_monotonic": time.monotonic(),

    "total_requests": 0,
    "total_duration_seconds": 0.0,
    "max_duration_seconds": 0.0,

    "retry_attempts": 0,
    "requests_retried": 0,

    "rate_limited_requests": 0,
    "auth_failed_requests": 0,
    "gateway_error_requests": 0,
    "request_body_too_large": 0,

    "circuit_opened_total": 0,
    "circuit_rejected_requests": 0,

    "requests_by_method": {},
    "requests_by_status_code": {},
    "requests_by_service": {},
    "requests_by_rate_limit_rule": {},
}

# ============================================================
# 10. PATH PATTERN HELPERS
# ============================================================

def is_positive_integer(value: str):
    return value.isdigit() and int(value) > 0


def path_matches_pattern(path: str, pattern: list[str]):
    parts = path.strip("/").split("/")

    if len(parts) != len(pattern):
        return False

    for actual_part, expected_part in zip(parts, pattern):
        if expected_part == "{int}":
            if not is_positive_integer(actual_part):
                return False

        elif expected_part == "{str}":
            if actual_part == "":
                return False

        elif actual_part != expected_part:
            return False

    return True

# ============================================================
# 11. GATEWAY ERROR RESPONSE HELPER
# ============================================================

def gateway_error_response(
    status_code: int,
    detail: str,
    request_id: str | None = None,
    service_name: str | None = None,
    extra_headers: dict | None = None
):

    content = {
        "detail": detail,
        "gateway_error": True
    }

    if service_name is not None:
        content["service"] = service_name

    if request_id is not None:
        content["request_id"] = request_id

    headers = {
        "X-Gateway-Error": "true"
    }

    if request_id is not None:
        headers["X-Request-ID"] = request_id

    if extra_headers:
        headers.update(extra_headers)

    return JSONResponse(
        status_code=status_code,
        content=content,
        headers=headers
    )


# ============================================================
# 12. PUBLIC ROUTE CHECKING
# ============================================================

def pattern_route_matches(method: str, path: str, route: dict):
    return (
        route["method"] == method
        and path_matches_pattern(path, route["pattern"])
    )


def classify_route(method: str, path: str) -> str:
    """
    Classify route as 'public', 'protected', or 'unknown'.

    - public: No authentication required.
    - protected: Valid JWT required in Authorization header.
    - unknown: Unrecognized route -> 404 Not Found.

    Protected routes are checked before public routes. This matters
    because some protected paths (e.g. "/api/profiles/me") share a shape
    with a broader public pattern (e.g. "/api/profiles/{str}" for public
    username lookups). Checking protected routes first guarantees that a
    reserved segment like "me" is always treated as "the current user",
    never as a public username lookup.
    """
    # 1. Protected checks (most specific / reserved routes first)
    if (method, path) in PROTECTED_EXACT_ROUTES:
        return "protected"

    for route in PROTECTED_PATTERN_ROUTES:
        if pattern_route_matches(method, path, route):
            return "protected"

    # 2. Public checks
    if (method, path) in PUBLIC_EXACT_ROUTES:
        return "public"

    for route in PUBLIC_PATTERN_ROUTES:
        if pattern_route_matches(method, path, route):
            return "public"

    # 3. Anything not explicitly recognized is unknown and gets a 404
    # instead of being silently forwarded without a gateway-level auth
    # decision.
    return "unknown"


# ============================================================
# 13. JWT VERIFICATION
# ============================================================

def verify_gateway_token(authorization: str | None):
    """
    Verify Authorization: Bearer <token>.

    If valid:
        return decoded JWT payload

    If invalid:
        raise HTTPException(401)
    """

    if authorization is None:
        raise HTTPException(
            status_code=401,
            detail="missing authorization header"
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="invalid authorization header"
        )

    token = authorization.split(" ", 1)[1]

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="invalid token"
        )

    user_id = payload.get("sub")

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="invalid token payload"
        )

    return payload


# ============================================================
# 14. RATE LIMIT RULE MATCHING
# ============================================================

def rate_limit_rule_matches(request: Request, rule: dict):
    """
    Decide whether a rate-limit rule applies to this request.

    Supports:
        exact
        pattern
        prefix

    exact:
        /api/posts only matches /api/posts

    pattern:
        /api/comments/post/{int}
        matches /api/comments/post/1
        does not match /api/comments/post/me

    prefix:
        /api/
        matches all API routes
        used only as a fallback
    """

    method = request.method
    path = request.url.path

    method_matches = rule["method"] == "*" or rule["method"] == method

    if not method_matches:
        return False

    match_type = rule.get("match", "prefix")

    if match_type == "exact":
        return path == rule["path"]

    if match_type == "pattern":
        return path_matches_pattern(path, rule["pattern"])

    if match_type == "prefix":
        return path.startswith(rule["path"])

    return False


def get_rate_limit_rule(request: Request):
    """
    Return the first matching rate-limit rule.

    Rule order matters:
        specific rules first
        general fallback rule last
    """

    for rule in RATE_LIMIT_RULES:
        if rate_limit_rule_matches(request, rule):
            return rule

    return DEFAULT_RATE_LIMIT


def get_rate_limit_key(request: Request, rule: dict):
    """
    Build the token bucket key.

    Public request example:
        auth_login:ip:127.0.0.1

    Authenticated request example:
        authenticated_api_default:user:5

    The rule name is included so different route groups do not share
    the same bucket.
    """

    if hasattr(request.state, "user_id"):
        identity = f"user:{request.state.user_id}"
    elif request.client:
        identity = f"ip:{request.client.host}"
    else:
        identity = "ip:unknown"

    return f"{rule['name']}:{identity}"


def check_memory_rate_limit(request: Request):
    """
    Apply token bucket rate limiting.

    Returns:
        allowed: bool
        retry_after: int
        rule: dict | None
    """

    path = request.url.path

    if path in RATE_LIMIT_SKIP_PATHS:
        return True, 0, None

    rule = get_rate_limit_rule(request)
    key = get_rate_limit_key(request, rule)

    now = time.monotonic()

    capacity = rule["capacity"]
    refill_rate = rule["refill_rate"]

    bucket = rate_limit_buckets.get(key)

    if bucket is None:
        rate_limit_buckets[key] = {
            "tokens": capacity - 1,
            "last_refill": now
        }

        return True, 0, rule

    elapsed = now - bucket["last_refill"]
    refill_amount = elapsed * refill_rate

    bucket["tokens"] = min(
        capacity,
        bucket["tokens"] + refill_amount
    )

    bucket["last_refill"] = now

    if bucket["tokens"] >= 1:
        bucket["tokens"] -= 1
        return True, 0, rule

    retry_after = int((1 - bucket["tokens"]) / refill_rate) + 1

    return False, retry_after, rule

REDIS_TOKEN_BUCKET_SCRIPT = """
    local key = KEYS[1]

    local capacity = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local ttl_seconds = tonumber(ARGV[4])

    local bucket = redis.call("HMGET", key, "tokens", "last_refill")

    local tokens = tonumber(bucket[1])
    local last_refill = tonumber(bucket[2])

    if tokens == nil then
        tokens = capacity
    end

    if last_refill == nil then
        last_refill = now
    end

    local elapsed = now - last_refill

    if elapsed < 0 then
        elapsed = 0
    end

    local refill_amount = elapsed * refill_rate

    tokens = math.min(capacity, tokens + refill_amount)

    local allowed = 0
    local retry_after = 0

    if tokens >= 1 then
        allowed = 1
        tokens = tokens - 1
    else
        retry_after = math.ceil((1 - tokens) / refill_rate)
    end

    redis.call("HSET", key, "tokens", tokens, "last_refill", now)
    redis.call("EXPIRE", key, ttl_seconds)

    return {allowed, retry_after, tokens}
    """

def get_rate_limit_bucket_ttl(rule: dict):
    """
    Decide how long Redis should keep an unused rate-limit bucket.

    Example:
    capacity = 60
    refill_rate = 1 token/sec

    Full refill time is about 60 seconds.
    We keep the key for at least twice that.
    """

    capacity = rule["capacity"]
    refill_rate = rule["refill_rate"]

    if refill_rate <= 0:
        return 3600

    full_refill_seconds = int(capacity / refill_rate)

    return max(
        60,
        min(full_refill_seconds * 2, 86400)
    )


def build_redis_rate_limit_key(local_key: str):
    """
    Convert the local bucket key into a Redis key.

    Example:
    auth_login:ip:127.0.0.1

    Becomes:
    gateway:rate_limit:auth_login:ip:127.0.0.1
    """

    return f"{RATE_LIMIT_KEY_PREFIX}:{local_key}"


async def check_redis_rate_limit(request: Request, rule: dict, local_key: str):
    """
    Apply token bucket rate limiting using Redis.

    Returns:
        allowed: bool
        retry_after: int
        rule: dict
    """

    redis_client = request.app.state.redis_client

    if redis_client is None:
        log_event(
            "redis_rate_limit_unavailable",
            level="warning",
            path=request.url.path,
            rule=rule["name"]
        )

        return True, 0, rule

    redis_key = build_redis_rate_limit_key(local_key)

    now = time.monotonic()
    ttl_seconds = get_rate_limit_bucket_ttl(rule)

    result = await redis_client.eval(
        REDIS_TOKEN_BUCKET_SCRIPT,
        1,
        redis_key,
        rule["capacity"],
        rule["refill_rate"],
        now,
        ttl_seconds
    )

    allowed = int(result[0]) == 1
    retry_after = int(result[1])

    return allowed, retry_after, rule

async def check_rate_limit(request: Request):
    """
    Apply rate limiting using the configured backend.

    Supported backends:
        memory
        redis
    """

    path = request.url.path

    if path in RATE_LIMIT_SKIP_PATHS:
        return True, 0, None

    rule = get_rate_limit_rule(request)
    local_key = get_rate_limit_key(request, rule)

    if RATE_LIMIT_BACKEND == "redis":
        return await check_redis_rate_limit(
            request=request,
            rule=rule,
            local_key=local_key
        )

    return check_memory_rate_limit(request)


# ============================================================
# 15. CIRCUIT BREAKER HELPERS
# ============================================================

def get_circuit_breaker(service_name: str):
    """
    Return the circuit breaker state for a service.

    Each service has its own circuit:
        auth
        users
        posts
        likes
        follows
        comments
    """

    return circuit_breakers[service_name]


def should_allow_service_request(service_name: str):
    """
    Decide whether the gateway should call the downstream service.

    Returns:
        allowed: bool
        retry_after: int

    Circuit states:

    closed:
        Normal state. Requests are allowed.

    open:
        Service is considered unhealthy. Requests are rejected fast.

    half-open:
        Cooldown passed. Gateway allows a test request.
    """

    breaker = get_circuit_breaker(service_name)
    state = breaker["state"]

    if state == "closed":
        return True, 0

    if state == "open":
        opened_at = breaker["opened_at"]

        if opened_at is None:
            breaker["opened_at"] = time.monotonic()
            return False, int(CIRCUIT_COOLDOWN_SECONDS)

        elapsed = time.monotonic() - opened_at

        if elapsed >= CIRCUIT_COOLDOWN_SECONDS:
            breaker["state"] = "half_open"

            log_event(
                "circuit_half_open",
                level="warning",
                service=service_name,
                cooldown_seconds=CIRCUIT_COOLDOWN_SECONDS
            )

            return True, 0

        retry_after = int(CIRCUIT_COOLDOWN_SECONDS - elapsed) + 1
        return False, retry_after

    if state == "half_open":
        return True, 0

    # Defensive fallback.
    # If the state somehow becomes invalid, fail safe by opening it.
    breaker["state"] = "open"
    breaker["opened_at"] = time.monotonic()
    return False, int(CIRCUIT_COOLDOWN_SECONDS)


def record_service_success(service_name: str, request_id: str | None = None):
    """
    Record a successful downstream service call.

    If the circuit was half-open, a success closes it again.
    If there were previous failures, success resets the failure count.
    """

    breaker = get_circuit_breaker(service_name)

    previous_state = breaker["state"]
    previous_failure_count = breaker["failure_count"]

    breaker["state"] = "closed"
    breaker["failure_count"] = 0
    breaker["opened_at"] = None

    if previous_state != "closed" or previous_failure_count > 0:
        log_event(
            "circuit_closed",
            request_id=request_id,
            service=service_name,
            previous_state=previous_state,
            previous_failure_count=previous_failure_count
        )


def record_service_failure(
    service_name: str,
    request_id: str | None = None,
    reason: str = "downstream_failure",
    status_code: int | None = None,
    error_type: str | None = None
):
    """
    Record a downstream service failure.

    If failures reach the threshold, open the circuit.

    A failure while half-open immediately reopens the circuit.
    """

    breaker = get_circuit_breaker(service_name)

    previous_state = breaker["state"]

    if previous_state == "half_open":
        breaker["state"] = "open"
        breaker["failure_count"] = CIRCUIT_FAILURE_THRESHOLD
        breaker["opened_at"] = time.monotonic()

        gateway_metrics["circuit_opened_total"] += 1

        log_event(
            "circuit_reopened",
            level="warning",
            request_id=request_id,
            service=service_name,
            reason=reason,
            status_code=status_code,
            error_type=error_type,
            failure_threshold=CIRCUIT_FAILURE_THRESHOLD,
            cooldown_seconds=CIRCUIT_COOLDOWN_SECONDS
        )

        return

    if previous_state == "open":
        return

    breaker["failure_count"] += 1

    log_event(
        "circuit_failure_recorded",
        level="warning",
        request_id=request_id,
        service=service_name,
        reason=reason,
        status_code=status_code,
        error_type=error_type,
        failure_count=breaker["failure_count"],
        failure_threshold=CIRCUIT_FAILURE_THRESHOLD
    )

    if breaker["failure_count"] >= CIRCUIT_FAILURE_THRESHOLD:
        breaker["state"] = "open"
        breaker["opened_at"] = time.monotonic()

        gateway_metrics["circuit_opened_total"] += 1

        log_event(
            "circuit_opened",
            level="warning",
            request_id=request_id,
            service=service_name,
            reason=reason,
            status_code=status_code,
            error_type=error_type,
            failure_count=breaker["failure_count"],
            failure_threshold=CIRCUIT_FAILURE_THRESHOLD,
            cooldown_seconds=CIRCUIT_COOLDOWN_SECONDS
        )

# ============================================================
# 16. HEADER BUILDING
# ============================================================

def build_forward_headers(request: Request):
    """
    Build safe headers for forwarding to a downstream service.

    This function:
    - removes unsafe client-controlled headers
    - keeps useful request headers like Content-Type and Authorization
    - adds gateway-generated trusted headers
    """

    headers = {}

    for key, value in request.headers.items():
        lower_key = key.lower()

        if lower_key in BLOCKED_REQUEST_HEADERS:
            continue

        headers[key] = value

    headers["X-Request-ID"] = request.state.request_id

    if hasattr(request.state, "user_id"):
        headers["X-User-ID"] = str(request.state.user_id)

    if hasattr(request.state, "user_email") and request.state.user_email:
        headers["X-User-Email"] = request.state.user_email

    if request.client:
        headers["X-Forwarded-For"] = request.client.host

    headers["X-Forwarded-Proto"] = request.url.scheme

    return headers


def build_response_headers(service_response: httpx.Response, request_id: str):
    """
    Build safe response headers for returning to the client.

    We skip content-type here because Response(media_type=...)
    handles it separately.
    """

    headers = {}

    for key, value in service_response.headers.items():
        lower_key = key.lower()

        if lower_key in BLOCKED_RESPONSE_HEADERS:
            continue

        if lower_key == "content-type":
            continue

        headers[key] = value

    headers["X-Request-ID"] = request_id

    return headers


# ============================================================
# 17. METRICS HELPERS
# ============================================================

def increment_counter(counter: dict, key: str, amount: int = 1):
    key = str(key)
    counter[key] = counter.get(key, 0) + amount


def get_service_name_from_path(path: str):
    if path in {"/health", "/metrics", "/metrics/json"}:
        return "gateway"

    parts = path.strip("/").split("/")

    if len(parts) >= 2 and parts[0] == "api":
        return parts[1]

    return "unknown"


def record_request_metrics(
    request: Request,
    status_code: int,
    duration: float,
    rate_limit_rule: dict | None = None,
    was_rate_limited: bool = False,
    was_auth_failure: bool = False,
    was_gateway_error: bool = False
):
    """
    Record in-memory metrics.
    """

    path = request.url.path
    method = request.method
    service_name = get_service_name_from_path(path)

    gateway_metrics["total_requests"] += 1
    gateway_metrics["total_duration_seconds"] += duration
    gateway_metrics["max_duration_seconds"] = max(
        gateway_metrics["max_duration_seconds"],
        duration
    )

    increment_counter(
        gateway_metrics["requests_by_method"],
        method
    )

    increment_counter(
        gateway_metrics["requests_by_status_code"],
        status_code
    )

    increment_counter(
        gateway_metrics["requests_by_service"],
        service_name
    )

    if rate_limit_rule is not None:
        increment_counter(
            gateway_metrics["requests_by_rate_limit_rule"],
            rate_limit_rule["name"]
        )

    if was_rate_limited:
        gateway_metrics["rate_limited_requests"] += 1

    if was_auth_failure:
        gateway_metrics["auth_failed_requests"] += 1

    if was_gateway_error:
        gateway_metrics["gateway_error_requests"] += 1

def prometheus_escape_label_value(value: str):
    """
    Escape label values for Prometheus text format.

    Prometheus labels look like:
        service="posts"

    If the value contains backslashes, quotes, or newlines,
    we escape them so the output remains valid.
    """

    return (
        str(value)
        .replace("\\", "\\\\")
        .replace("\n", "\\n")
        .replace('"', '\\"')
    )


def prometheus_labels(**labels):
    """
    Convert keyword labels into Prometheus label format.

    Example:
        prometheus_labels(method="GET", service="posts")

    If no labels are provided:
        return an empty string
    """

    if not labels:
        return ""

    label_parts = []

    for key, value in labels.items():
        escaped_value = prometheus_escape_label_value(value)
        label_parts.append(f'{key}="{escaped_value}"')

    return "{" + ",".join(label_parts) + "}"


def prometheus_metric_line(name: str, value, **labels):
    """
    Build one Prometheus metric line.

    Example:
        gateway_requests_total{method="GET"} 5
    """

    return f"{name}{prometheus_labels(**labels)} {value}"


def build_prometheus_metrics():
    """
    Convert your in-memory gateway_metrics dictionary into
    Prometheus text format.

    Prometheus reads metrics as plain text lines, not JSON.

    """

    uptime_seconds = time.monotonic() - gateway_metrics["started_at_monotonic"]

    total_requests = gateway_metrics["total_requests"]

    if total_requests == 0:
        average_duration_seconds = 0
    else:
        average_duration_seconds = (
            gateway_metrics["total_duration_seconds"] / total_requests
        )

    lines = []

    # HELP explains what a metric means.
    # TYPE tells Prometheus whether it is a counter, gauge, histogram, etc.
    lines.append("# HELP gateway_uptime_seconds Gateway uptime in seconds.")
    lines.append("# TYPE gateway_uptime_seconds gauge")
    lines.append(
        prometheus_metric_line(
            "gateway_uptime_seconds",
            round(uptime_seconds, 4)
        )
    )

    lines.append("# HELP gateway_requests_total Total HTTP requests handled by the gateway.")
    lines.append("# TYPE gateway_requests_total counter")
    lines.append(
        prometheus_metric_line(
            "gateway_requests_total",
            gateway_metrics["total_requests"]
        )
    )

    lines.append("# HELP gateway_rate_limited_requests_total Total requests blocked by rate limiting.")
    lines.append("# TYPE gateway_rate_limited_requests_total counter")
    lines.append(
        prometheus_metric_line(
            "gateway_rate_limited_requests_total",
            gateway_metrics["rate_limited_requests"]
        )
    )

    lines.append("# HELP gateway_auth_failed_requests_total Total requests rejected by gateway authentication.")
    lines.append("# TYPE gateway_auth_failed_requests_total counter")
    lines.append(
        prometheus_metric_line(
            "gateway_auth_failed_requests_total",
            gateway_metrics["auth_failed_requests"]
        )
    )

    lines.append("# HELP gateway_error_requests_total Total gateway-generated error responses.")
    lines.append("# TYPE gateway_error_requests_total counter")
    lines.append(
        prometheus_metric_line(
            "gateway_error_requests_total",
            gateway_metrics["gateway_error_requests"]
        )
    )

    lines.append("# HELP gateway_request_duration_seconds_total Total request duration observed by the gateway.")
    lines.append("# TYPE gateway_request_duration_seconds_total counter")
    lines.append(
        prometheus_metric_line(
            "gateway_request_duration_seconds_total",
            round(gateway_metrics["total_duration_seconds"], 6)
        )
    )

    lines.append("# HELP gateway_request_duration_seconds_average Average request duration observed by the gateway.")
    lines.append("# TYPE gateway_request_duration_seconds_average gauge")
    lines.append(
        prometheus_metric_line(
            "gateway_request_duration_seconds_average",
            round(average_duration_seconds, 6)
        )
    )

    lines.append("# HELP gateway_request_duration_seconds_max Max request duration observed by the gateway.")
    lines.append("# TYPE gateway_request_duration_seconds_max gauge")
    lines.append(
        prometheus_metric_line(
            "gateway_request_duration_seconds_max",
            round(gateway_metrics["max_duration_seconds"], 6)
        )
    )

    lines.append("# HELP gateway_requests_by_method_total Requests grouped by HTTP method.")
    lines.append("# TYPE gateway_requests_by_method_total counter")
    for method, count in gateway_metrics["requests_by_method"].items():
        lines.append(
            prometheus_metric_line(
                "gateway_requests_by_method_total",
                count,
                method=method
            )
        )

    lines.append("# HELP gateway_requests_by_status_code_total Requests grouped by HTTP status code.")
    lines.append("# TYPE gateway_requests_by_status_code_total counter")
    for status_code, count in gateway_metrics["requests_by_status_code"].items():
        lines.append(
            prometheus_metric_line(
                "gateway_requests_by_status_code_total",
                count,
                status_code=status_code
            )
        )

    lines.append("# HELP gateway_requests_by_service_total Requests grouped by gateway service name.")
    lines.append("# TYPE gateway_requests_by_service_total counter")
    for service, count in gateway_metrics["requests_by_service"].items():
        lines.append(
            prometheus_metric_line(
                "gateway_requests_by_service_total",
                count,
                service=service
            )
        )

    lines.append("# HELP gateway_requests_by_rate_limit_rule_total Requests grouped by rate-limit rule.")
    lines.append("# TYPE gateway_requests_by_rate_limit_rule_total counter")
    for rule, count in gateway_metrics["requests_by_rate_limit_rule"].items():
        lines.append(
            prometheus_metric_line(
                "gateway_requests_by_rate_limit_rule_total",
                count,
                rule=rule
            )
        )
    
    lines.append("# HELP gateway_request_body_too_large_total Total requests rejected because the body was too large.")
    lines.append("# TYPE gateway_request_body_too_large_total counter")
    lines.append(
            prometheus_metric_line(
            "gateway_request_body_too_large_total",
            gateway_metrics["request_body_too_large"]
        )
    )
    lines.append("# HELP gateway_retry_attempts_total Total downstream retry attempts.")
    lines.append("# TYPE gateway_retry_attempts_total counter")
    lines.append(
        prometheus_metric_line(
            "gateway_retry_attempts_total",
            gateway_metrics["retry_attempts"]
        )
    )

    lines.append("# HELP gateway_requests_retried_total Total requests that were retried at least once.")
    lines.append("# TYPE gateway_requests_retried_total counter")
    lines.append(
        prometheus_metric_line(
            "gateway_requests_retried_total",
            gateway_metrics["requests_retried"]
        )
    )

    lines.append("# HELP gateway_circuit_opened_total Total times a service circuit was opened.")
    lines.append("# TYPE gateway_circuit_opened_total counter")
    lines.append(
        prometheus_metric_line(
            "gateway_circuit_opened_total",
            gateway_metrics["circuit_opened_total"]
        )
    )

    lines.append("# HELP gateway_circuit_rejected_requests_total Total requests rejected because a circuit was open.")
    lines.append("# TYPE gateway_circuit_rejected_requests_total counter")
    lines.append(
        prometheus_metric_line(
            "gateway_circuit_rejected_requests_total",
            gateway_metrics["circuit_rejected_requests"]
        )
    )

    lines.append("# HELP gateway_circuit_state Current circuit state by service. 0=closed, 1=half_open, 2=open.")
    lines.append("# TYPE gateway_circuit_state gauge")

    state_values = {
        "closed": 0,
        "half_open": 1,
        "open": 2
    }

    for service_name, breaker in circuit_breakers.items():
        lines.append(
            prometheus_metric_line(
                "gateway_circuit_state",
                state_values.get(breaker["state"], -1),
                service=service_name
            )
        )
    # Prometheus text format should end with a newline.
    return "\n".join(lines) + "\n"
# ============================================================
# 18. MAIN REQUEST MIDDLEWARE
# ============================================================

def check_content_length_limit(request: Request):
    """
    Check Content-Length before doing expensive gateway work.

    Why this exists:
    If the client clearly tells us the body is too large through
    Content-Length, the gateway should reject it immediately before:

    - JWT validation
    - rate limiting
    - reading the request body
    - forwarding to downstream services

    Returns:
        allowed: bool
        status_code: int | None
        response: Response | None
    """

    content_length = request.headers.get("content-length")

    # Some requests have no body, such as GET /health.
    # If there is no Content-Length, we allow it for now.
    if content_length is None:
        return True, None, None

    try:
        content_length_value = int(content_length)

    except ValueError:
        response = gateway_error_response(
            status_code=400,
            detail="Content-Length header must be a valid integer.",
            request_id=request.state.request_id
        )

        return False, 400, response

    if content_length_value > MAX_REQUEST_BODY_SIZE_BYTES:
        response = gateway_error_response(
            status_code=413,
            detail="Request body is too large.",
            request_id=request.state.request_id,
            extra_headers={
                "X-Max-Request-Body-Size-Bytes": str(MAX_REQUEST_BODY_SIZE_BYTES)
            }
        )

        return False, 413, response

    return True, None, None

@app.middleware("http")
async def auth_rate_limit_and_logging_middleware(request: Request, call_next):
    """
    Main gateway request pipeline.

    Order:
    1. Assign request ID.
    2. Log request start.
    3. Allow OPTIONS preflight.
    4. Reject oversized requests early.
    5. Route classification & Authentication (Public / Protected / 404 Unknown).
    6. Apply rate limiting.
    7. Forward to endpoint handler.
    8. Add response headers.
    9. Record metrics.
    10. Log request end.
    """

    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id

    start_time = time.perf_counter()

    service_name = get_service_name_from_path(request.url.path)
    client_ip = request.client.host if request.client else "unknown"

    log_event(
        "request_start",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        service=service_name,
        client_ip=client_ip
    )

    # ------------------------------------------------------------
    # 1. OPTIONS preflight
    # ------------------------------------------------------------
    if request.method == "OPTIONS":
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id

        duration = time.perf_counter() - start_time

        record_request_metrics(
            request=request,
            status_code=response.status_code,
            duration=duration
        )

        log_event(
            "request_end",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            service=service_name,
            client_ip=client_ip,
            status_code=response.status_code,
            duration_seconds=round(duration, 6)
        )

        return response

    # ------------------------------------------------------------
    # 2. Request size protection
    # ------------------------------------------------------------
    body_size_allowed, body_size_status_code, body_size_response = (
        check_content_length_limit(request)
    )

    if not body_size_allowed:
        duration = time.perf_counter() - start_time

        if body_size_status_code == 413:
            gateway_metrics["request_body_too_large"] += 1

        record_request_metrics(
            request=request,
            status_code=body_size_status_code,
            duration=duration,
            was_gateway_error=True
        )

        log_event(
            "request_body_rejected",
            level="warning",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            service=service_name,
            client_ip=client_ip,
            status_code=body_size_status_code,
            max_size_bytes=MAX_REQUEST_BODY_SIZE_BYTES,
            duration_seconds=round(duration, 6)
        )

        return body_size_response

    # ------------------------------------------------------------
    # 3. Route classification & Authentication
    # ------------------------------------------------------------
    route_type = classify_route(request.method, request.url.path)

    if route_type == "unknown":
        duration = time.perf_counter() - start_time

        record_request_metrics(
            request=request,
            status_code=404,
            duration=duration,
            was_gateway_error=True
        )

        log_event(
            "route_not_found",
            level="warning",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            service=service_name,
            client_ip=client_ip,
            status_code=404,
            duration_seconds=round(duration, 6)
        )

        return gateway_error_response(
            status_code=404,
            detail="route not found",
            request_id=request_id
        )

    if route_type == "protected":
        try:
            payload = verify_gateway_token(
                request.headers.get("Authorization")
            )

            request.state.user_id = payload["sub"]
            request.state.user_email = payload.get("email")

        except HTTPException as error:
            duration = time.perf_counter() - start_time

            record_request_metrics(
                request=request,
                status_code=error.status_code,
                duration=duration,
                was_auth_failure=True,
                was_gateway_error=True
            )

            log_event(
                "auth_failed",
                level="warning",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                service=service_name,
                client_ip=client_ip,
                status_code=error.status_code,
                detail=error.detail,
                duration_seconds=round(duration, 6)
            )

            return gateway_error_response(
                status_code=error.status_code,
                detail=error.detail,
                request_id=request_id
            )

    # ------------------------------------------------------------
    # 4. Rate limiting
    # ------------------------------------------------------------
    allowed, retry_after, rate_limit_rule = await check_rate_limit(request)

    if not allowed:
        duration = time.perf_counter() - start_time

        record_request_metrics(
            request=request,
            status_code=429,
            duration=duration,
            rate_limit_rule=rate_limit_rule,
            was_rate_limited=True,
            was_gateway_error=True
        )

        log_event(
            "rate_limited",
            level="warning",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            service=service_name,
            client_ip=client_ip,
            status_code=429,
            rate_limit_rule=rate_limit_rule["name"] if rate_limit_rule else "none",
            retry_after=retry_after,
            duration_seconds=round(duration, 6)
        )

        return gateway_error_response(
            status_code=429,
            detail="rate limit exceeded",
            request_id=request_id,
            extra_headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Rule": (
                    rate_limit_rule["name"] if rate_limit_rule else "none"
                )
            }
        )

    # ------------------------------------------------------------
    # 5. Forward to endpoint handler
    # ------------------------------------------------------------
    response = await call_next(request)

    if rate_limit_rule is not None:
        response.headers["X-RateLimit-Rule"] = rate_limit_rule["name"]

    response.headers["X-Request-ID"] = request_id

    duration = time.perf_counter() - start_time

    was_gateway_error = response.headers.get("X-Gateway-Error") == "true"

    record_request_metrics(
        request=request,
        status_code=response.status_code,
        duration=duration,
        rate_limit_rule=rate_limit_rule,
        was_gateway_error=was_gateway_error
    )

    log_event(
        "request_end",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        service=service_name,
        client_ip=client_ip,
        status_code=response.status_code,
        rate_limit_rule=rate_limit_rule["name"] if rate_limit_rule else "none",
        gateway_error=was_gateway_error,
        duration_seconds=round(duration, 6)
    )

    return response

# ============================================================
# 19. HEALTH CHECKS
# ============================================================

async def check_service_health(
    client: httpx.AsyncClient,
    service_name: str,
    base_url: str
):
    """
    Check whether one downstream service responds to /health.

    The gateway uses this to report whether each internal service is healthy.
    """

    try:
        response = await client.get(f"{base_url}/health")

        return service_name, {
            "healthy": response.status_code == 200,
            "status_code": response.status_code
        }

    except httpx.RequestError:
        return service_name, {
            "healthy": False,
            "status_code": None
        }


@app.get("/health")
async def health(request: Request):
    """
    Gateway health endpoint.

    This checks:
    1. The gateway itself is running.
    2. Each downstream service responds to /health.

    This endpoint is public and skipped by rate limiting.
    """

    client = request.app.state.http_client

    tasks = [
        check_service_health(
            client,
            service_name,
            service["base_url"]
        )
        for service_name, service in SERVICE_MAP.items()
    ]

    results_list = await asyncio.gather(*tasks)
    results = dict(results_list)

    return {
        "gateway": "ok",
        "all_services_healthy": all(
            service["healthy"] for service in results.values()
        ),
        "services": results
    }

# ============================================================
# 20. METRICS ENDPOINT
# ============================================================

@app.get("/metrics/json")
async def metrics_json_endpoint():
    """
    Basic JSON metrics endpoint.
    """

    uptime_seconds = time.monotonic() - gateway_metrics["started_at_monotonic"]

    total_requests = gateway_metrics["total_requests"]

    if total_requests == 0:
        average_duration_seconds = 0
    else:
        average_duration_seconds = (
            gateway_metrics["total_duration_seconds"] / total_requests
        )

    return {
        "gateway": "ok",
        "uptime_seconds": round(uptime_seconds, 4),

        "rate_limit_backend": RATE_LIMIT_BACKEND,
        "redis_enabled": RATE_LIMIT_BACKEND == "redis",

        "total_requests": total_requests,
        "rate_limited_requests": gateway_metrics["rate_limited_requests"],
        "auth_failed_requests": gateway_metrics["auth_failed_requests"],
        "gateway_error_requests": gateway_metrics["gateway_error_requests"],
        "retry_attempts": gateway_metrics["retry_attempts"],
        "requests_retried": gateway_metrics["requests_retried"],
        "request_body_too_large": gateway_metrics["request_body_too_large"],
        "circuit_opened_total": gateway_metrics["circuit_opened_total"],
        "circuit_rejected_requests": gateway_metrics["circuit_rejected_requests"],
        "circuit_breakers": circuit_breakers,

        "average_duration_seconds": round(average_duration_seconds, 6),
        "max_duration_seconds": round(
            gateway_metrics["max_duration_seconds"],
            6
        ),

        "requests_by_method": gateway_metrics["requests_by_method"],
        "requests_by_status_code": gateway_metrics["requests_by_status_code"],
        "requests_by_service": gateway_metrics["requests_by_service"],
        "requests_by_rate_limit_rule": gateway_metrics[
            "requests_by_rate_limit_rule"
        ],
    }

@app.get("/metrics")
async def prometheus_metrics_endpoint():
    """
    Prometheus metrics endpoint.

    This returns metrics in Prometheus text format.

    Prometheus will scrape this endpoint repeatedly using the
    prometheus.yml scrape configuration.
    """

    return PlainTextResponse(
        content=build_prometheus_metrics(),
        media_type="text/plain; version=0.0.4"
    )


# ============================================================
# 21. TARGET URL BUILDING
# ============================================================

def build_target_url(
    service_name: str,
    path: str,
    method: str,
):
    """
    Convert an external gateway path into an internal service URL.

    Examples:

        GET /api/posts
            -> http://post-service:8000/posts

        POST /api/posts
            -> http://post-service:8000/posts/me

        GET /api/posts/me
            -> http://post-service:8000/posts/me

        GET /api/users/profiles/me/avatar
            -> http://user-service:8000/profiles/me/avatar
    """

    service = SERVICE_MAP[service_name]

    base_url = service["base_url"].rstrip("/")
    prefix = service["prefix"].rstrip("/")

    path = path.strip("/")

    # ------------------------------------------------------------
    # Special route translations
    # ------------------------------------------------------------

    # Public API:
    #   POST /api/posts
    #
    # Internal service:
    #   POST /posts/me
    #
    # Creating a post belongs to the authenticated user,
    # so the post service uses its /posts/me endpoint.
    if (
        service_name == "posts"
        and method == "POST"
        and path == ""
    ):
        return f"{base_url}/posts/me"

    # ------------------------------------------------------------
    # Remove duplicated internal prefix from incoming path
    # ------------------------------------------------------------

    prefix_without_slash = prefix.strip("/")

    if prefix_without_slash:
        if path.startswith(prefix_without_slash + "/"):
            path = path[len(prefix_without_slash) + 1:]

        elif path == prefix_without_slash:
            path = ""

    # ------------------------------------------------------------
    # Rebuild internal service URL
    # ------------------------------------------------------------

    if prefix == "":
        if path == "":
            return f"{base_url}/"

        return f"{base_url}/{path}"

    if path == "":
        return f"{base_url}{prefix}"

    return f"{base_url}{prefix}/{path}"


# ============================================================
# 22. REQUEST FORWARDING
# ============================================================

import json


async def get_user_profile(request: Request, user_id: int):
    client: httpx.AsyncClient = request.app.state.http_client

    response = await client.get(
        f"http://user-service:8000/profiles/user/{user_id}"
    )

    if response.status_code != 200:
        return None

    return response.json()


async def enrich_posts(request: Request, posts: list):
    profile_cache = {}

    for post in posts:
        user_id = post.get("user_id")

        if user_id is None:
            continue

        if user_id not in profile_cache:
            profile_cache[user_id] = await get_user_profile(
                request,
                user_id,
            )

        profile = profile_cache[user_id]

        if profile:
            post["username"] = profile["username"]
            post["display_name"] = profile["display_name"]
            post["avatar_url"] = profile["avatar_url"]

    return posts


async def enrich_comments(request: Request, comments: list):
    """
    Attach username/display_name/avatar_url to each comment, the same way
    enrich_posts() does for posts. The comment-service only knows a
    comment's user_id; it doesn't know about profiles, so the gateway
    resolves that here instead of duplicating profile data/logic inside
    the comment service.
    """
    profile_cache = {}

    for comment in comments:
        user_id = comment.get("user_id")

        if user_id is None:
            continue

        if user_id not in profile_cache:
            profile_cache[user_id] = await get_user_profile(
                request,
                user_id,
            )

        profile = profile_cache[user_id]

        if profile:
            comment["username"] = profile["username"]
            comment["display_name"] = profile["display_name"]
            comment["avatar_url"] = profile["avatar_url"]

    return comments

async def forward_request(service_name: str, path: str, request: Request):
    """
    Forward request from gateway to downstream service.

    This function handles:
    - service lookup
    - circuit breaker protection
    - target URL building
    - safe header forwarding
    - backup body-size validation
    - retrying safe methods
    - downstream timeout/unavailable handling
    - returning the downstream response
    """

    request_id = request.state.request_id

    if service_name not in SERVICE_MAP:
        log_event(
            "service_not_found",
            level="warning",
            request_id=request_id,
            service=service_name,
            path=request.url.path,
            status_code=404
        )

        return gateway_error_response(
            status_code=404,
            detail="service not found",
            request_id=request_id,
            service_name=service_name
        )

    # ------------------------------------------------------------
    # 1. Circuit breaker fast-fail check
    # ------------------------------------------------------------
    circuit_allowed, circuit_retry_after = should_allow_service_request(
        service_name
    )

    if not circuit_allowed:
        gateway_metrics["circuit_rejected_requests"] += 1

        log_event(
            "circuit_request_rejected",
            level="warning",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            service=service_name,
            circuit_state=get_circuit_breaker(service_name)["state"],
            retry_after=circuit_retry_after,
            status_code=503
        )

        return gateway_error_response(
            status_code=503,
            detail=f"{service_name} service circuit is open",
            request_id=request_id,
            service_name=service_name,
            extra_headers={
                "Retry-After": str(circuit_retry_after),
                "X-Circuit-State": "open"
            }
        )

    target_url = build_target_url(
        service_name=service_name,
        path=path,
        method=request.method,
    )
    headers = build_forward_headers(request)

    # ------------------------------------------------------------
    # 2. Read request body and backup body-size check
    # ------------------------------------------------------------
    # The middleware already checks Content-Length early.
    # This backup check catches cases where:
    # - Content-Length is missing
    # - Content-Length is wrong
    # - the client sends a body anyway
    body = await request.body()

    if len(body) > MAX_REQUEST_BODY_SIZE_BYTES:
        gateway_metrics["request_body_too_large"] += 1

        log_event(
            "request_body_rejected_after_read",
            level="warning",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            service=service_name,
            target_url=target_url,
            actual_size_bytes=len(body),
            max_size_bytes=MAX_REQUEST_BODY_SIZE_BYTES,
            status_code=413
        )

        return gateway_error_response(
            status_code=413,
            detail="Request body is too large.",
            request_id=request_id,
            service_name=service_name,
            extra_headers={
                "X-Max-Request-Body-Size-Bytes": str(MAX_REQUEST_BODY_SIZE_BYTES)
            }
        )

    log_event(
        "forward_request",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        service=service_name,
        target_url=target_url,
        circuit_state=get_circuit_breaker(service_name)["state"]
    )

    try:
        client: httpx.AsyncClient = request.app.state.http_client

        request_was_retried = False
        service_response = None

        for attempt_number in range(1, RETRY_ATTEMPTS + 1):
            try:
                service_response = await client.request(
                    method=request.method,
                    url=target_url,
                    headers=headers,
                    content=body,
                    params=request.query_params
                )

                should_retry_status_code = (
                    request.method in RETRYABLE_METHODS
                    and service_response.status_code in RETRYABLE_STATUS_CODES
                    and attempt_number < RETRY_ATTEMPTS
                )

                if should_retry_status_code:
                    request_was_retried = True
                    gateway_metrics["retry_attempts"] += 1

                    log_event(
                        "retrying_downstream_response",
                        level="warning",
                        request_id=request_id,
                        method=request.method,
                        path=request.url.path,
                        service=service_name,
                        target_url=target_url,
                        attempt_number=attempt_number,
                        next_attempt_number=attempt_number + 1,
                        status_code=service_response.status_code,
                        backoff_seconds=RETRY_BACKOFF_SECONDS
                    )

                    await asyncio.sleep(RETRY_BACKOFF_SECONDS)
                    continue

                break

            except (httpx.TimeoutException, httpx.RequestError) as error:
                should_retry_exception = (
                    request.method in RETRYABLE_METHODS
                    and attempt_number < RETRY_ATTEMPTS
                )

                if should_retry_exception:
                    request_was_retried = True
                    gateway_metrics["retry_attempts"] += 1

                    log_event(
                        "retrying_downstream_exception",
                        level="warning",
                        request_id=request_id,
                        method=request.method,
                        path=request.url.path,
                        service=service_name,
                        target_url=target_url,
                        attempt_number=attempt_number,
                        next_attempt_number=attempt_number + 1,
                        error_type=type(error).__name__,
                        backoff_seconds=RETRY_BACKOFF_SECONDS
                    )

                    await asyncio.sleep(RETRY_BACKOFF_SECONDS)
                    continue

                raise

        if request_was_retried:
            gateway_metrics["requests_retried"] += 1

        if service_response is None:
            record_service_failure(
                service_name=service_name,
                request_id=request_id,
                reason="no_downstream_response"
            )

            return gateway_error_response(
                status_code=503,
                detail=f"{service_name} service unavailable",
                request_id=request_id,
                service_name=service_name
            )

    except httpx.TimeoutException as error:
        record_service_failure(
            service_name=service_name,
            request_id=request_id,
            reason="timeout",
            status_code=504,
            error_type=type(error).__name__
        )

        log_event(
            "service_timeout",
            level="error",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            service=service_name,
            target_url=target_url,
            error_type=type(error).__name__,
            status_code=504
        )

        return gateway_error_response(
            status_code=504,
            detail=f"{service_name} service timed out",
            request_id=request_id,
            service_name=service_name
        )

    except httpx.RequestError as error:
        record_service_failure(
            service_name=service_name,
            request_id=request_id,
            reason="request_error",
            status_code=503,
            error_type=type(error).__name__
        )

        log_event(
            "service_unavailable",
            level="error",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            service=service_name,
            target_url=target_url,
            error_type=type(error).__name__,
            status_code=503
        )

        return gateway_error_response(
            status_code=503,
            detail=f"{service_name} service unavailable",
            request_id=request_id,
            service_name=service_name
        )

    # ------------------------------------------------------------
    # 3. Record circuit breaker result
    # ------------------------------------------------------------
    if service_response.status_code in CIRCUIT_FAILURE_STATUS_CODES:
        record_service_failure(
            service_name=service_name,
            request_id=request_id,
            reason="bad_downstream_status_code",
            status_code=service_response.status_code
        )
    else:
        record_service_success(
            service_name=service_name,
            request_id=request_id
        )

    log_event(
        "service_response",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        service=service_name,
        target_url=target_url,
        status_code=service_response.status_code,
        circuit_state=get_circuit_breaker(service_name)["state"]
    )

    response_content = service_response.content

    if (
        service_name == "posts"
        and request.method == "GET"
        and path == ""
        and service_response.status_code == 200
    ):
        posts = service_response.json()

        posts = await enrich_posts(
            request,
            posts,
        )

        response_content = json.dumps(posts).encode()

    normalized_comment_path = path.strip("/")
    is_comment_list_route = (
        service_name == "comments"
        and request.method == "GET"
        and service_response.status_code == 200
        and (
            normalized_comment_path.startswith("post/")
            or normalized_comment_path == "user/me"
        )
    )

    if is_comment_list_route:
        payload = service_response.json()
        comments = payload.get("comments") if isinstance(payload, dict) else payload

        if isinstance(comments, list):
            comments = await enrich_comments(request, comments)

            if isinstance(payload, dict):
                payload["comments"] = comments
                response_content = json.dumps(payload).encode()
            else:
                response_content = json.dumps(comments).encode()

    return Response(
        content=response_content,
        status_code=service_response.status_code,
        headers=build_response_headers(
            service_response,
            request_id,
        ),
        media_type=service_response.headers.get("content-type"),
    )

# ============================================================
# 22.5 ORCHESTRATION ROUTES
# ============================================================

async def cleanup_likes_for_comments(request: Request, comment_ids: list[int]):
    """Background task to cascade deletions to the like-service."""
    client: httpx.AsyncClient = request.app.state.http_client
    target_url = build_target_url("likes", "comments", "DELETE")
    
    headers = {
        "x-internal-service-secret": os.getenv("INTERNAL_SERVICE_SECRET", "super-secret"),
        "Content-Type": "application/json"
    }

    try:
        await client.request(
            method="DELETE",
            url=target_url,
            headers=headers,
            json=comment_ids
        )
    except Exception as e:
        log_event(
            "background_like_cleanup_failed",
            level="error",
            error=str(e)
        )

@app.delete("/api/comments/{comment_id}")
async def delete_comment_orchestration(
    comment_id: int,
    request: Request,
    background_tasks: BackgroundTasks
):
    """
    Specific route to intercept comment deletions before the catch-all.
    Reuses the gateway's forward_request for circuit breakers and metrics.
    """
    # 1. Forward the request to the comment-service
    response = await forward_request(
        service_name="comments",
        path=str(comment_id),
        request=request
    )

    # 2. If deletion succeeded, schedule the background cleanup
    if response.status_code == 200:
        try:
            # Parse the bytes response returned by forward_request
            data = json.loads(response.body)
            deleted_ids = data.get("deleted_ids", [])
            
            if deleted_ids:
                background_tasks.add_task(
                    cleanup_likes_for_comments, 
                    request, 
                    deleted_ids
                )
        except json.JSONDecodeError:
            pass

    return response

# ============================================================
# 23. CATCH-ALL GATEWAY ROUTES
# ============================================================

@app.api_route(
    "/api/{service_name}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH"]
)
@app.api_route(
    "/api/{service_name}/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH"]
)
async def gateway_route(
    service_name: str,
    request: Request,
    path: str = ""
):
    return await forward_request(
        service_name=service_name,
        path=path,
        request=request
    )
