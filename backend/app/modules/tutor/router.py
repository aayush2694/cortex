import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from fastapi.responses import StreamingResponse

from app.clients.llm import LLMClient, get_llm
from app.core.auth import CurrentUser, DbSession
from app.modules.tutor.schemas import (
    MessageIn,
    SessionCreateIn,
    SessionDetailOut,
    SessionListOut,
    SessionOut,
)
from app.modules.tutor.service import TutorService, stream_reply

router = APIRouter(prefix="/tutor", tags=["tutor"])


@router.post(
    "/sessions",
    response_model=SessionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Start a chat, optionally about a topic",
)
async def create_session(
    body: SessionCreateIn, user: CurrentUser, session: DbSession
) -> SessionOut:
    return await TutorService(session).create_session(user, body.topic_id)


@router.get("/sessions", response_model=SessionListOut, summary="Your recent chats")
async def list_sessions(user: CurrentUser, session: DbSession) -> SessionListOut:
    return SessionListOut(items=await TutorService(session).list_sessions(user))


@router.get("/sessions/{session_id}", response_model=SessionDetailOut, summary="A chat's history")
async def get_session(
    session_id: uuid.UUID, user: CurrentUser, session: DbSession
) -> SessionDetailOut:
    return await TutorService(session).get_session(user, session_id)


@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a chat and its messages",
)
async def delete_session(session_id: uuid.UUID, user: CurrentUser, session: DbSession) -> Response:
    await TutorService(session).delete_session(user, session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/sessions/{session_id}/messages",
    summary="Send a message; the reply streams back as Server-Sent Events",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/event-stream": {}}}},
)
async def send_message(
    session_id: uuid.UUID,
    body: MessageIn,
    user: CurrentUser,
    session: DbSession,
    llm: Annotated[LLMClient, Depends(get_llm)],
) -> StreamingResponse:
    system, messages = await TutorService(session).prepare_turn(user, session_id, body.text)
    await session.commit()  # save the user's message before streaming starts
    return StreamingResponse(
        stream_reply(llm, user.id, session_id, system, messages),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
