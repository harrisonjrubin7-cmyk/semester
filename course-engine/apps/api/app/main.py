from importlib import import_module

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

runtime_readiness = settings.runtime_readiness()
app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Citation-first course knowledge and study API",
    docs_url="/docs" if runtime_readiness.ready else None,
    openapi_url="/openapi.json" if runtime_readiness.ready else None,
    redoc_url="/redoc" if runtime_readiness.ready else None,
)
if runtime_readiness.ready:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins.split(","),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
def ready():
    if not runtime_readiness.ready:
        raise HTTPException(503, "Service unavailable")
    return {"status": "ready"}


if runtime_readiness.ready:
    router = import_module("app.api.routes").router
    app.include_router(router, prefix=settings.api_prefix)
else:
    @app.api_route(
        f"{settings.api_prefix}/{{path:path}}",
        methods=["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"],
    )
    def unavailable(path: str):
        raise HTTPException(503, "Service unavailable")
