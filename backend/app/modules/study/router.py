from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.core.auth import CurrentUser, DbSession
from app.modules.study.schemas import (
    ActivityOut,
    AddedCards,
    CardIn,
    CardList,
    CardOut,
    NoteIn,
    NoteList,
    NoteOut,
    PlanIn,
    PlanOut,
    ReviewIn,
    TodayOut,
)
from app.modules.study.service import StudyService

router = APIRouter(prefix="/study", tags=["study"])

# IANA time zone from the browser (Intl.DateTimeFormat().resolvedOptions().timeZone), so
# "today" and the heatmap follow your calendar, not the server's.
TimeZone = Annotated[str, Query(max_length=64)]


@router.get("/today", response_model=TodayOut, summary="Today's problem, due cards and plan")
async def today(user: CurrentUser, session: DbSession, tz: TimeZone = "UTC") -> TodayOut:
    return await StudyService(session).today(user, tz)


@router.get("/activity", response_model=ActivityOut, summary="Activity per day and your streak")
async def activity(
    user: CurrentUser,
    session: DbSession,
    tz: TimeZone = "UTC",
    days: Annotated[int, Query(ge=7, le=400)] = 182,
) -> ActivityOut:
    return await StudyService(session).activity(user, days, tz)


@router.get("/plan", response_model=PlanOut, summary="Your interview prep plan")
async def get_plan(user: CurrentUser, session: DbSession) -> PlanOut:
    return await StudyService(session).plan(user)


@router.put("/plan", response_model=PlanOut, summary="Set your target date and daily goals")
async def set_plan(body: PlanIn, user: CurrentUser, session: DbSession) -> PlanOut:
    return await StudyService(session).save_plan(user, body)


@router.get("/cards", response_model=CardList, summary="All your flashcards")
async def cards(user: CurrentUser, session: DbSession, topic_id: str | None = None) -> CardList:
    return await StudyService(session).cards(user, topic_id)


@router.get("/cards/due", response_model=CardList, summary="Cards due for review now")
async def due(
    user: CurrentUser, session: DbSession, limit: Annotated[int, Query(ge=1, le=200)] = 50
) -> CardList:
    return await StudyService(session).due(user, limit)


@router.post("/cards", response_model=CardOut, status_code=201, summary="Write your own card")
async def add_card(body: CardIn, user: CurrentUser, session: DbSession) -> CardOut:
    return await StudyService(session).add_card(user, body)


@router.post(
    "/topics/{topic_id}/cards",
    response_model=AddedCards,
    summary="Add a topic's key ideas (and a pattern's signals and template) as cards",
)
async def add_topic_cards(topic_id: str, user: CurrentUser, session: DbSession) -> AddedCards:
    return await StudyService(session).add_topic_cards(user, topic_id)


@router.post("/cards/{card_id}/review", response_model=CardOut, summary="Grade a review")
async def review(card_id: int, body: ReviewIn, user: CurrentUser, session: DbSession) -> CardOut:
    return await StudyService(session).review(user, card_id, body.grade)


@router.delete("/cards/{card_id}", status_code=204, summary="Delete a card")
async def delete_card(card_id: int, user: CurrentUser, session: DbSession) -> Response:
    await StudyService(session).delete_card(user, card_id)
    return Response(status_code=204)


@router.get("/notes", response_model=NoteList, summary="All topics you've written notes for")
async def notes(user: CurrentUser, session: DbSession) -> NoteList:
    return await StudyService(session).notes(user)


@router.get("/notes/{topic_id}", response_model=NoteOut, summary="Your note for a topic")
async def get_note(topic_id: str, user: CurrentUser, session: DbSession) -> NoteOut:
    return await StudyService(session).note(user, topic_id)


@router.put("/notes/{topic_id}", response_model=NoteOut, summary="Save (or clear) a note")
async def save_note(topic_id: str, body: NoteIn, user: CurrentUser, session: DbSession) -> NoteOut:
    return await StudyService(session).save_note(user, topic_id, body.body)
