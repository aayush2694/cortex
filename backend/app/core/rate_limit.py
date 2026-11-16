"""Per-minute request limits, kept in memory.

One API instance runs, so in-process counters are correct. They reset on restart and are not
shared between instances. Each key gets a fixed one-minute window that starts at its first
request. A fixed window lets a client send up to about twice the limit in a short burst that
spans the end of one window and the start of the next.

Signed-in users are keyed by their user id (except on sign-in routes). Everyone else is keyed
by address, and only when PROXY_SHARED_SECRET is set: without it every visitor through the
Cloudflare Worker has the same peer address, and one shared bucket would let a single client
lock everyone out. So without the secret, address-keyed requests are not limited at all.
"""

import hmac
import ipaddress
import math
import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Depends, Request

from app.core.auth import get_clock
from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.modules.auth.tokens import decode_access_token

WINDOW = timedelta(minutes=1)
TUTOR_MESSAGES = re.compile(r"/api/v1/tutor/sessions/[^/]+/messages")
PROVIDERS = "/api/v1/auth/providers"  # a config read, not a sign-in attempt


class RateLimited(AppError):
    status_code = 429
    code = "rate_limited"

    def __init__(self, retry_after: int) -> None:
        super().__init__(f"Too many requests. Try again in {retry_after} seconds.")
        self.headers = {"Retry-After": str(retry_after)}


@dataclass
class _Window:
    start: datetime
    count: int = 0


class RateLimiter:
    def __init__(self) -> None:
        self._windows: dict[str, _Window] = {}
        self._last_sweep: datetime | None = None

    def __len__(self) -> int:
        return len(self._windows)

    def reset(self) -> None:
        self._windows.clear()
        self._last_sweep = None

    def hit(self, key: str, limit: int, now: datetime) -> int | None:
        """Count one request. Returns the seconds to wait if it is over the limit, else None."""
        self._sweep(now)
        window = self._windows.get(key)
        if window is None or now - window.start >= WINDOW:
            window = self._windows[key] = _Window(now)
        if window.count >= limit:
            return max(1, math.ceil((window.start + WINDOW - now).total_seconds()))
        window.count += 1
        return None

    def _sweep(self, now: datetime) -> None:
        """Once a minute, drop windows that have ended, so memory stays bounded."""
        if self._last_sweep is not None and now - self._last_sweep < WINDOW:
            return
        self._last_sweep = now
        self._windows = {k: w for k, w in self._windows.items() if now - w.start < WINDOW}


limiter = RateLimiter()


def _user_id(request: Request, settings: Settings, now: datetime) -> str | None:
    """The signed-in user's id from a valid access token, without a database lookup."""
    if settings.auth_mode != "jwt" or not settings.jwt_secret:
        return None
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    try:
        return str(decode_access_token(token.strip(), settings.jwt_secret, now))
    except AppError:  # expired or invalid: the route itself will answer 401
        return None


def client_ip(request: Request, settings: Settings) -> str:
    """The client's address, never taken from a header the client could set itself.

    The Cloudflare Worker's X-Client-IP counts only with the shared secret. Otherwise use the
    address Render's proxy saw, which it appends as the rightmost X-Forwarded-For entry.
    """
    secret = settings.proxy_shared_secret
    sent = request.headers.get("x-proxy-secret")
    worker_ip = request.headers.get("x-client-ip", "").strip()
    if secret and sent and worker_ip and hmac.compare_digest(sent.encode(), secret.encode()):
        return worker_ip
    forwarded = request.headers.get("x-forwarded-for", "").rsplit(",", 1)[-1].strip()
    if forwarded:
        return forwarded
    return request.client.host if request.client else "unknown"


def address_key(address: str) -> str:
    """The bucket for an address: IPv4 as it is, IPv6 by its /64 network.

    One IPv6 subscriber usually gets a whole /64, so keying single addresses would give them
    unlimited buckets. An address that does not parse is used as an opaque string.
    """
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return address
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped is not None:
            return str(ip.ipv4_mapped)
        return str(ipaddress.IPv6Network((ip, 64), strict=False))
    return str(ip)


async def rate_limit(
    request: Request, clock: Annotated[Callable[[], datetime], Depends(get_clock)]
) -> None:
    settings = get_settings()
    now = clock()
    path = request.url.path
    if path.startswith("/api/v1/auth/") and path != PROVIDERS:
        group, limit = "auth", settings.rate_limit_auth_per_minute
    elif request.method == "POST" and TUTOR_MESSAGES.fullmatch(path):
        group, limit = "tutor", settings.rate_limit_tutor_per_minute
    else:
        group, limit = "default", settings.rate_limit_default_per_minute
    # Sign-in routes are limited per address, even for a caller who sends a token.
    user_id = None if group == "auth" else _user_id(request, settings, now)
    if user_id:
        who = f"user:{user_id}"
    elif settings.proxy_shared_secret:
        who = f"ip:{address_key(client_ip(request, settings))}"
    else:
        return  # per-IP limits are off until the secret is set (see the module docstring)
    wait = limiter.hit(f"{group}:{who}", limit, now)
    if wait is not None:
        request.state.rate_limit = group  # named in the request log
        raise RateLimited(wait)
