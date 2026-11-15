"""The signed-in user: who they are, and deleting their account."""

import uuid

from fastapi import APIRouter, Response
from pydantic import BaseModel
from sqlalchemy import delete

from app.core.auth import CurrentUser, DbSession
from app.core.config import get_settings
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import tutor_allowed
from app.modules.users.models import User

router = APIRouter(tags=["meta"])


class MeOut(BaseModel):
    id: uuid.UUID
    display_name: str
    email: str | None
    avatar_url: str | None
    tutor_access: bool


@router.get("/me", response_model=MeOut, summary="The current user")
async def me(user: CurrentUser, session: DbSession) -> MeOut:
    emails = await AuthRepository(session).verified_emails(user.id)
    return MeOut(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        avatar_url=user.avatar_url,
        tutor_access=tutor_allowed(user, emails, get_settings()),
    )


@router.delete("/me", status_code=204, summary="Delete your account and everything in it")
async def delete_me(user: CurrentUser, session: DbSession) -> Response:
    # Every user table references users.id with ON DELETE CASCADE.
    await session.execute(delete(User).where(User.id == user.id))
    return Response(status_code=204)
