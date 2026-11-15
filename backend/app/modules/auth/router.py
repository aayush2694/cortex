from collections.abc import AsyncIterator, Callable
from datetime import datetime
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Cookie, Depends, Response
from fastapi.responses import RedirectResponse

from app.core.auth import DbSession, get_clock
from app.core.config import get_settings
from app.modules.auth.providers import OAuthProvider, configured_providers
from app.modules.auth.schemas import ProvidersOut, RefreshIn, TokenIn, TokenPair
from app.modules.auth.service import (
    NONCE_COOKIE,
    NONCE_COOKIE_PATH,
    STATE_TTL,
    AuthService,
    nonce_cookie_secure,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def get_providers() -> dict[str, OAuthProvider]:
    settings = get_settings()
    # Sign-in exists only in jwt mode; dev mode has one local user and no providers.
    return configured_providers(settings) if settings.auth_mode == "jwt" else {}


async def get_http_client() -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(timeout=10) as client:
        yield client


Providers = Annotated[dict[str, OAuthProvider], Depends(get_providers)]
HttpClient = Annotated[httpx.AsyncClient, Depends(get_http_client)]
Clock = Annotated[Callable[[], datetime], Depends(get_clock)]
# The browser-binding nonce set by /start (see service.NONCE_COOKIE).
Nonce = Annotated[str | None, Cookie(alias=NONCE_COOKIE)]


def _cookie_options() -> dict[str, Any]:
    return {
        "path": NONCE_COOKIE_PATH,
        "httponly": True,
        "secure": nonce_cookie_secure(get_settings().frontend_url),
        "samesite": "lax",  # sent on the provider's top-level redirect back to the callback
    }


def _service(session: DbSession, clock: Clock) -> AuthService:
    return AuthService(session, get_settings(), clock)


Service = Annotated[AuthService, Depends(_service)]


@router.get("/providers", response_model=ProvidersOut, summary="Sign-in mode and methods")
async def providers(available: Providers) -> ProvidersOut:
    return ProvidersOut(mode=get_settings().auth_mode, providers=list(available))


@router.get("/{provider}/start", status_code=302, summary="Go to the provider to sign in")
async def start(provider: str, available: Providers, service: Service) -> RedirectResponse:
    url, nonce = await service.start(provider, available)
    response = RedirectResponse(url, status_code=302)
    response.set_cookie(
        NONCE_COOKIE, nonce, max_age=int(STATE_TTL.total_seconds()), **_cookie_options()
    )
    return response


@router.get("/{provider}/callback", status_code=302, summary="Where the provider sends you back")
async def callback(
    provider: str,
    available: Providers,
    client: HttpClient,
    service: Service,
    nonce: Nonce = None,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    url = await service.callback(provider, code, state, error, nonce, available, client)
    return RedirectResponse(url, status_code=302)


@router.post("/token", response_model=TokenPair, summary="Swap a one-time login code for tokens")
async def token(
    body: TokenIn, service: Service, response: Response, nonce: Nonce = None
) -> TokenPair:
    response.headers["Cache-Control"] = "no-store"
    pair = await service.exchange_code(body.code, nonce)
    response.delete_cookie(NONCE_COOKIE, **_cookie_options())  # the nonce is spent
    return pair


@router.post("/refresh", response_model=TokenPair, summary="Swap a refresh token for a new pair")
async def refresh(body: RefreshIn, service: Service, response: Response) -> TokenPair:
    response.headers["Cache-Control"] = "no-store"
    return await service.refresh(body.refresh_token)


@router.post("/logout", status_code=204, summary="Sign out this session everywhere it refreshed")
async def logout(body: RefreshIn, service: Service) -> Response:
    await service.logout(body.refresh_token)
    return Response(status_code=204)
