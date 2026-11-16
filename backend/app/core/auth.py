"""Who is making the request.

"dev" mode: everyone is the same local user, no login needed.
"jwt" mode: requests carry a signed access token issued by the sign-in flow.
"""

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.core.errors import AppError
from app.modules.auth.models import Identity
from app.modules.auth.tokens import TokenInvalid, decode_access_token
from app.modules.users.models import User

DEV_USER_NAME = "Dev User"


class AuthNotConfigured(AppError):
    status_code = 501
    code = "auth_not_configured"


async def get_dev_user(session: AsyncSession) -> User:
    user = await session.scalar(
        select(User)
        .where(~select(Identity.id).where(Identity.user_id == User.id).exists())
        .order_by(User.created_at)
        .limit(1)
    )
    if user is None:
        user = User(display_name=DEV_USER_NAME)
        session.add(user)
        await session.flush()
    return user


class NotSignedIn(AppError):
    status_code = 401
    code = "not_signed_in"


def get_clock() -> Callable[[], datetime]:
    return lambda: datetime.now(UTC)


def _bearer_token(request: Request) -> str:
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    token = token.strip()
    if scheme.lower() != "bearer" or not token:
        raise NotSignedIn("Sign in to continue")
    return token


async def current_user(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    clock: Annotated[Callable[[], datetime], Depends(get_clock)],
) -> User:
    settings = get_settings()
    if settings.auth_mode == "dev":
        dev_user = await get_dev_user(session)
        request.state.user_id = dev_user.id  # for the request log
        return dev_user
    if not settings.jwt_secret:
        raise AuthNotConfigured("Sign-in is not configured")
    user_id = decode_access_token(_bearer_token(request), settings.jwt_secret, clock())
    user = await session.get(User, user_id)
    if user is None:  # a valid token for an account that has since been deleted
        raise TokenInvalid("Access token is not valid")
    request.state.user_id = user.id  # for the request log
    return user


CurrentUser = Annotated[User, Depends(current_user)]
DbSession = Annotated[AsyncSession, Depends(get_session)]
