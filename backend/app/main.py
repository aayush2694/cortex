"""Create the FastAPI app: middleware, error handlers, routers, and startup tasks."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.core.auth import CurrentUser
from app.core.config import get_settings
from app.core.db import dispose_engine, get_sessionmaker
from app.core.errors import register_error_handlers
from app.core.logging import RequestContextMiddleware, setup_logging
from app.modules.practice.catalog import get_practice, validate_practice
from app.modules.practice.router import router as practice_router
from app.modules.progress.router import router as progress_router
from app.modules.topics.catalog import load_catalog
from app.modules.topics.repository import TopicRepository
from app.modules.topics.router import router as topics_router
from app.modules.tutor.router import router as tutor_router
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
    return len(catalog.topics)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    count = await sync_topics()
    log.info("Loaded %d topics from the catalogue", count)
    yield
    await dispose_engine()


def create_app() -> FastAPI:
    setup_logging()
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Backend for Cortex, an interactive learning platform.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
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

    api = APIRouter(prefix="/api/v1")

    @api.get("/me", tags=["meta"], summary="The current user")
    async def me(user: CurrentUser) -> dict[str, str]:
        return {"id": str(user.id), "display_name": user.display_name}

    api.include_router(topics_router)
    api.include_router(progress_router)
    api.include_router(practice_router)
    api.include_router(visualizer_router)
    api.include_router(tutor_router)
    app.include_router(api)
    return app


app = create_app()
