import os
import time
import uuid
import json
import httpx
import asyncio
import logging
from datetime import datetime, UTC
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from jose import jwt, JWTError

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse

# ============================================================
# 1. ENVIRONMENT / CONFIGURATION
# ============================================================

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")

if SECRET_KEY is None:
    raise RuntimeError("SECRET_KEY is missing. Add it to your .env file.")

ALGORITHM = "HS256"

# ============================================================
# 2. LOGGING CONFIGURATION
# ============================================================

MAX_REQUEST_BODY_SIZE_BYTES = int(
    os.getenv("MAX_REQUEST_BODY_SIZE_BYTES", str(1024 * 1024))
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

    log_event(
    "gateway_startup",
    shared_http_client_created=True,
    timeout_seconds=10.0
)

    yield

    await app.state.http_client.aclose()

    log_event(
    "gateway_shutdown",
    shared_http_client_closed=True
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
}


# ============================================================
# 7. PUBLIC ROUTE CONFIGURATION
# ============================================================
# We use two styles:
#
# 1. Exact routes:
#    Used when the path must match exactly.
#
# 2. Pattern routes:
#    Used when the path has parameters.
#

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
        "pattern": ["api", "users", "{str}"]
    },
    {
        "method": "GET",
        "pattern": ["api", "comments", "post", "{int}"]
    },
    {
        "method": "GET",
        "pattern": ["api", "likes", "posts", "{int}", "count"]
    },
    {
        "method": "GET",
        "pattern": ["api", "follows", "users", "{int}", "followers"]
    },
    {
        "method": "GET",
        "pattern": ["api", "follows", "users", "{int}", "following"]
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

    "rate_limited_requests": 0,
    "auth_failed_requests": 0,
    "gateway_error_requests": 0,
    "request_body_too_large": 0,

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

def public_pattern_route_matches(method: str, path: str, route: dict):
    """
    Check one public pattern route.

    Example route:
        {
            "method": "GET",
            "pattern": ["api", "comments", "post", "{int}"]
        }

    This matches:
        GET /api/comments/post/1

    It does not match:
        GET /api/comments/post/me
        POST /api/comments/post/1
    """

    return (
        route["method"] == method
        and path_matches_pattern(path, route["pattern"])
    )


def is_public_path(method: str, path: str):
    """
    Decide whether a route is public.

    Public means:
        The request does not need a JWT.

    This version is data-driven:
        - exact public routes are stored in PUBLIC_EXACT_ROUTES
        - parameterized public routes are stored in PUBLIC_PATTERN_ROUTES
    """

    if (method, path) in PUBLIC_EXACT_ROUTES:
        return True

    for route in PUBLIC_PATTERN_ROUTES:
        if public_pattern_route_matches(method, path, route):
            return True

    return False


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


def check_rate_limit(request: Request):
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


# ============================================================
# 15. HEADER BUILDING
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
# 16. METRICS HELPERS
# ============================================================

def increment_counter(counter: dict, key: str, amount: int = 1):
    key = str(key)
    counter[key] = counter.get(key, 0) + amount


def get_service_name_from_path(path: str):
    if path in {"/health", "/metrics"}:
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

    # Prometheus text format should end with a newline.
    return "\n".join(lines) + "\n"
# ============================================================
# 17. MAIN REQUEST MIDDLEWARE
# ============================================================
@app.middleware("http")
async def auth_rate_limit_and_logging_middleware(request: Request, call_next):
    """
    Main gateway request pipeline.

    Order:
    1. Assign request ID.
    2. Log request start.
    3. Allow OPTIONS preflight.
    4. Authenticate protected routes.
    5. Apply rate limiting.
    6. Forward to endpoint handler.
    7. Add response headers.
    8. Record metrics.
    9. Log request end.
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
            status_code=response.status_code,
            duration_seconds=round(duration, 6)
        )

        return response

    if not is_public_path(request.method, request.url.path):
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
                status_code=error.status_code,
                detail=error.detail,
                duration_seconds=round(duration, 6)
            )

            return gateway_error_response(
                status_code=error.status_code,
                detail=error.detail,
                request_id=request_id
            )

    allowed, retry_after, rate_limit_rule = check_rate_limit(request)

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
# 18. HEALTH CHECKS
# ============================================================

async def check_service_health(
    client: httpx.AsyncClient,
    service_name: str,
    base_url: str
):
    """
    Check whether one downstream service responds to /health.
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

    Checks:
    - gateway is running
    - downstream services are reachable
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
# 19. METRICS ENDPOINT
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

        "total_requests": total_requests,
        "rate_limited_requests": gateway_metrics["rate_limited_requests"],
        "auth_failed_requests": gateway_metrics["auth_failed_requests"],
        "gateway_error_requests": gateway_metrics["gateway_error_requests"],
        "request_body_too_large": gateway_metrics["request_body_too_large"],

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
# 20. TARGET URL BUILDING
# ============================================================

def build_target_url(service_name: str, path: str):
    """
    Convert external gateway path into internal service URL.

    Example:
        /api/posts/me
        -> http://post-service:8000/posts/me
    """

    service = SERVICE_MAP[service_name]

    base_url = service["base_url"]
    prefix = service["prefix"]

    path = path.strip("/")

    if prefix == "":
        if path == "":
            return f"{base_url}/"

        return f"{base_url}/{path}"

    if path == "":
        return f"{base_url}{prefix}"

    return f"{base_url}{prefix}/{path}"


# ============================================================
# 21. REQUEST FORWARDING
# ============================================================

async def forward_request(service_name: str, path: str, request: Request):
    """
    Forward request from gateway to downstream service.
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

    target_url = build_target_url(service_name, path)
    headers = build_forward_headers(request)
    content_length = request.headers.get("content-length")

    if content_length is not None:
        try:
            content_length_value = int(content_length)
        except ValueError:
            gateway_metrics["gateway_error_requests"] += 1
            return JSONResponse(
                status_code=400,
                content={
                    "error": "invalid_content_length",
                    "message": "Content-Length header must be a valid integer."
                }
            )

        if content_length_value > MAX_REQUEST_BODY_SIZE_BYTES:
            gateway_metrics["request_body_too_large"] += 1
            gateway_metrics["gateway_error_requests"] += 1

            return JSONResponse(
                status_code=413,
                content={
                    "error": "payload_too_large",
                    "message": "Request body is too large.",
                    "max_size_bytes": MAX_REQUEST_BODY_SIZE_BYTES
                }
            )
        
    body = await request.body()

    log_event(
        "forward_request",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        service=service_name,
        target_url=target_url
    )

    try:
        client: httpx.AsyncClient = request.app.state.http_client

        service_response = await client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=body,
            params=request.query_params
        )

    except httpx.TimeoutException as error:
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

    log_event(
        "service_response",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        service=service_name,
        target_url=target_url,
        status_code=service_response.status_code
    )

    return Response(
        content=service_response.content,
        status_code=service_response.status_code,
        headers=build_response_headers(
            service_response,
            request_id
        ),
        media_type=service_response.headers.get("content-type")
    )

# ============================================================
# 22. CATCH-ALL GATEWAY ROUTES
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