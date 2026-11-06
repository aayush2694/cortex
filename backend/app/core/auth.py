"""Who is making the request.

Phase 1 runs in "dev" mode: everyone is the same local user, no login needed.
Phase 2 adds "entra" mode, which validates Microsoft Entra ID tokens.
"""

from typing import Annotated

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.core.errors import AppError
from app.modules.users.models import User

DEV_USER_NAME = "Dev User"


class AuthNotConfigured(AppError):
    status_code = 501
    code = "auth_not_configured"


async def get_dev_user(session: AsyncSession) -> User:
    user = await session.scalar(
        select(User).where(User.external_id.is_(None)).order_by(User.created_at).limit(1)
    )
    if user is None:
        user = User(display_name=DEV_USER_NAME)
        session.add(user)
        await session.flush()
    return user


async def current_user(session: Annotated[AsyncSession, Depends(get_session)]) -> User:
    if get_settings().auth_mode == "dev":
        return await get_dev_user(session)
    raise AuthNotConfigured("Entra ID sign-in arrives in Phase 2")


CurrentUser = Annotated[User, Depends(current_user)]
DbSession = Annotated[AsyncSession, Depends(get_session)]
