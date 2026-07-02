import os
import time
import uuid
import httpx
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from jose import jwt, JWTError
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import JSONResponse

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")

if SECRET_KEY is None:
    raise RuntimeError("SECRET_KEY is missing. Add it to your .env file.")

ALGORITHM = "HS256"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

logger = logging.getLogger("api-gateway")

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

    yield

    await app.state.http_client.aclose()


app = FastAPI(lifespan=lifespan)
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

PUBLIC_EXACT_ROUTES = {
    ("GET", "/health"),
    ("POST", "/api/auth/register"),
    ("POST", "/api/auth/login"),
    ("GET", "/api/posts"),
}

PUBLIC_PREFIX_ROUTES = [
    ("GET", "/api/users/"),
    ("GET", "/api/comments/post/"),
    ("GET", "/api/likes/posts/"),
    ("GET", "/api/follows/users/"),
]

RATE_LIMIT_CAPACITY = 60
RATE_LIMIT_REFILL_RATE = 1.0
RATE_LIMIT_SKIP_PATHS = {
    "/health"
}

rate_limit_buckets = {}

def get_rate_limit_key(request: Request):
    if hasattr(request.state, "user_id"):
        return f"user:{request.state.user_id}"

    if request.client:
        return f"ip:{request.client.host}"

    return "ip:unknown"

def check_rate_limit(request: Request):
    path = request.url.path

    if path in RATE_LIMIT_SKIP_PATHS:
        return True, 0

    key = get_rate_limit_key(request)
    now = time.monotonic()

    bucket = rate_limit_buckets.get(key)

    if bucket is None:
        rate_limit_buckets[key] = {
            "tokens": RATE_LIMIT_CAPACITY - 1,
            "last_refill": now
        }

        return True, 0

    elapsed = now - bucket["last_refill"]

    refill_amount = elapsed * RATE_LIMIT_REFILL_RATE

    bucket["tokens"] = min(
        RATE_LIMIT_CAPACITY,
        bucket["tokens"] + refill_amount
    )

    bucket["last_refill"] = now

    if bucket["tokens"] >= 1:
        bucket["tokens"] -= 1
        return True, 0

    retry_after = int((1 - bucket["tokens"]) / RATE_LIMIT_REFILL_RATE) + 1

    return False, retry_after

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

    headers = {}

    if request_id is not None:
        headers["X-Request-ID"] = request_id

    if extra_headers:
        headers.update(extra_headers)

    return JSONResponse(
        status_code=status_code,
        content=content,
        headers=headers
    )

def build_forward_headers(request: Request):
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

def is_public_path(method: str, path: str):
    if (method, path) in PUBLIC_EXACT_ROUTES:
        return True

    for public_method, public_prefix in PUBLIC_PREFIX_ROUTES:
        if method == public_method and path.startswith(public_prefix):
            return True

    return False


def verify_gateway_token(authorization: str | None):
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

@app.middleware("http")
async def auth_and_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id

    start_time = time.perf_counter()

    logger.info(
        f"request_start | request_id={request_id} | "
        f"method={request.method} | path={request.url.path}"
    )

    if not is_public_path(request.method, request.url.path):
        try:
            payload = verify_gateway_token(
                request.headers.get("Authorization")
            )

            request.state.user_id = payload["sub"]
            request.state.user_email = payload.get("email")

        except HTTPException as error:
            duration = time.perf_counter() - start_time

            logger.info(
                f"request_end | request_id={request_id} | "
                f"method={request.method} | path={request.url.path} | "
                f"status_code={error.status_code} | duration={duration:.4f}s"
            )

            return gateway_error_response(
                status_code=error.status_code,
                detail=error.detail,
                request_id=request_id
            )

    allowed, retry_after = check_rate_limit(request)

    if not allowed:
        duration = time.perf_counter() - start_time

        logger.info(
            f"rate_limited | request_id={request_id} | "
            f"method={request.method} | path={request.url.path} | "
            f"duration={duration:.4f}s"
        )

        return gateway_error_response(
            status_code=429,
            detail="rate limit exceeded",
            request_id=request_id,
            extra_headers={
                "Retry-After": str(retry_after)
            }
        )

    response = await call_next(request)

    duration = time.perf_counter() - start_time
    response.headers["X-Request-ID"] = request_id

    logger.info(
        f"request_end | request_id={request_id} | "
        f"method={request.method} | path={request.url.path} | "
        f"status_code={response.status_code} | duration={duration:.4f}s"
    )

    return response


async def check_service_health(client, service_name, base_url):
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


def build_target_url(service_name: str, path: str):
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


async def forward_request(service_name: str, path: str, request: Request):
    if service_name not in SERVICE_MAP:
        return gateway_error_response(
            status_code=404,
            detail="service not found",
            request_id=request.state.request_id,
            service_name=service_name
        )

    target_url = build_target_url(service_name, path)

    headers = build_forward_headers(request)

    body = await request.body()

    logger.info(
        f"forward_request | request_id={request.state.request_id} | "
        f"service={service_name} | target_url={target_url}"
    )
    try:
        client = request.app.state.http_client

        service_response = await client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=body,
            params=request.query_params
        )

    except httpx.TimeoutException:
        return gateway_error_response(
            status_code=504,
            detail=f"{service_name} service timed out",
            request_id=request.state.request_id,
            service_name=service_name
        )

    except httpx.RequestError:
        return gateway_error_response(
            status_code=503,
            detail=f"{service_name} service unavailable",
            request_id=request.state.request_id,
            service_name=service_name
        )

    logger.info(
        f"service_response | request_id={request.state.request_id} | "
        f"service={service_name} | status_code={service_response.status_code}"
    )

    return Response(
        content=service_response.content,
        status_code=service_response.status_code,
        headers=build_response_headers(
        service_response,
        request.state.request_id),
        media_type=service_response.headers.get("content-type")
    )


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

# You already added:

# Routing
# Docker internal service routing
# Request ID
# Logging
# Concurrent health checks
# JWT validation
# Forwarding trusted user headers
# Timeout/service unavailable errors

# The main missing gateway topics are:

# 1. CORS
# 2. Better public/protected route rules
# 3. Rate limiting
# 4. Metrics endpoint
# 5. Tracing/OpenTelemetry
# 6. Retry policy
# 7. Circuit breaker 
# 8. Central error formatting
# 9. Request size limits
# 10. API versioning
# 11. OpenAPI/docs aggregation
# 12. Security headers