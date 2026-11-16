"""Create the FastAPI app: middleware, error handlers, routers, and startup tasks."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.core.config import get_settings, validate_auth_settings
from app.core.db import dispose_engine, get_sessionmaker
from app.core.errors import register_error_handlers
from app.core.logging import RequestContextMiddleware, setup_logging
from app.core.rate_limit import rate_limit
from app.modules.auth.router import router as auth_router
from app.modules.jobs.content import get_questions, get_skills
from app.modules.jobs.router import router as jobs_router
from app.modules.practice.catalog import get_practice, validate_practice
from app.modules.practice.router import router as practice_router
from app.modules.progress.router import router as progress_router
from app.modules.study.router import router as study_router
from app.modules.topics.catalog import load_catalog
from app.modules.topics.guides import get_guides
from app.modules.topics.repository import TopicRepository
from app.modules.topics.router import router as topics_router
from app.modules.tutor.router import router as tutor_router
from app.modules.users.export import router as export_router
from app.modules.users.router import router as me_router
from app.modules.visualizer.router import router as visualizer_router

log = logging.getLogger(__name__)


async def sync_topics() -> int:
    """Load content/topics.yaml into the database (fails fast if the catalogue is invalid)."""
    catalog = load_catalog(get_settings().content_dir)
    async with get_sessionmaker()() as session:
        await TopicRepository(session).sync_from_catalog(catalog)
        await session.commit()
    # Coding problems must point at real topics; fail fast at startup if not.
    validate_practice(get_practice(), {t.id for t in catalog.topics})
    get_skills(), get_questions()  # load (and validate) the job-search content now
    get_guides()  # a broken guide stops startup
    return len(catalog.topics)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    validate_auth_settings(settings)  # a misconfigured jwt deploy must not start
    if not settings.proxy_shared_secret:
        log.warning(
            "PROXY_SHARED_SECRET is not set: per-IP rate limits are off until it is "
            "(signed-in users are still limited)"
        )
    count = await sync_topics()
    log.info("Loaded %d topics from the catalogue", count)
    yield
    await dispose_engine()


def create_app() -> FastAPI:
    setup_logging()
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.2.0",
        description="Backend for Cortex, an interactive learning platform.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(dict.fromkeys([*settings.cors_origins, settings.frontend_url])),
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["x-request-id"],
    )
    app.add_middleware(RequestContextMiddleware)
    register_error_handlers(app)

    @app.get("/", include_in_schema=False)
    async def root() -> RedirectResponse:
        return RedirectResponse("/docs")

    @app.get("/health", tags=["meta"], summary="Liveness check")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    # Every API route is rate limited; /health and / are not.
    api = APIRouter(prefix="/api/v1", dependencies=[Depends(rate_limit)])

    api.include_router(me_router)
    api.include_router(auth_router)
    api.include_router(topics_router)
    api.include_router(progress_router)
    api.include_router(practice_router)
    api.include_router(study_router)
    api.include_router(jobs_router)
    api.include_router(visualizer_router)
    api.include_router(tutor_router)
    api.include_router(export_router)
    app.include_router(api)
    return app


app = create_app()
