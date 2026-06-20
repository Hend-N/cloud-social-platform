import os
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response, HTTPException

load_dotenv()

app = FastAPI()

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
        raise HTTPException(status_code=404, detail="service not found")

    target_url = build_target_url(service_name, path)

    headers = dict(request.headers)

    headers.pop("host", None)
    headers.pop("content-length", None)

    body = await request.body()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            service_response = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
                params=request.query_params
            )

    except httpx.RequestError:
        raise HTTPException(
            status_code=503,
            detail=f"{service_name} service unavailable"
        )

    return Response(
        content=service_response.content,
        status_code=service_response.status_code,
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
    return await forward_request(service_name, path, request)


@app.get("/health")
async def health():
    results = {}

    async with httpx.AsyncClient(timeout=2.0) as client:
        for service_name, service in SERVICE_MAP.items():
            try:
                response = await client.get(f"{service['base_url']}/health")

                results[service_name] = {
                    "healthy": response.status_code == 200,
                    "status_code": response.status_code
                }

            except httpx.RequestError:
                results[service_name] = {
                    "healthy": False,
                    "status_code": None
                }

    return {
        "gateway": "ok",
        "all_services_healthy": all(
            service["healthy"] for service in results.values()
        ),
        "services": results
    }
