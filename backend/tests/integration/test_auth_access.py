"""The API in jwt mode: tokens required, users isolated, tutor invite-only, account deletion."""

import uuid
from datetime import timedelta

import httpx
import pytest
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from app.clients.llm import LLMEvent
from app.core.config import Settings, get_settings
from app.core.db import get_sessionmaker
from app.main import app, create_app, lifespan
from app.models import Base
from app.modules.auth.models import RefreshToken
from app.modules.auth.tokens import create_access_token, hash_secret
from app.modules.tutor.models import ChatMessage
from app.modules.users.models import User
from tests.integration.conftest import INVITED_EMAIL, TEST_JWT_SECRET, Clock, FakeLLM, SignedIn
from tests.integration.test_auth import refresh

API = "/api/v1"
DONE = LLMEvent(
    "done",
    data={
        "content": [{"type": "text", "text": "Hi"}],
        "stop_reason": "end_turn",
        "model": "fake",
        "input_tokens": 1,
        "output_tokens": 1,
    },
)


@pytest.mark.parametrize("path", ["/me", "/progress", "/study/notes", "/jobs/applications"])
async def test_requests_without_token_are_401(
    client: httpx.AsyncClient, auth_settings: Settings, path: str
) -> None:
    r = await client.get(f"{API}{path}")
    assert r.status_code == 401 and r.json()["error"]["code"] == "not_signed_in"


@pytest.mark.parametrize("header", ["Basic abc", "Bearer", "token abc"])
async def test_malformed_authorization_header_is_401(
    client: httpx.AsyncClient, auth_settings: Settings, header: str
) -> None:
    r = await client.get(f"{API}/me", headers={"Authorization": header})
    assert r.status_code == 401 and r.json()["error"]["code"] == "not_signed_in"


async def test_bad_tokens(client: httpx.AsyncClient, clock: Clock, signed_in: SignedIn) -> None:
    headers = await signed_in()
    assert (await client.get(f"{API}/me", headers=headers)).status_code == 200

    junk = await client.get(f"{API}/me", headers={"Authorization": "Bearer junk"})
    assert junk.status_code == 401 and junk.json()["error"]["code"] == "token_invalid"

    ghost = create_access_token(uuid.uuid4(), TEST_JWT_SECRET, clock())
    r = await client.get(f"{API}/me", headers={"Authorization": f"Bearer {ghost}"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "token_invalid"

    clock.advance(15 * 60 + 1)
    r = await client.get(f"{API}/me", headers=headers)
    assert r.status_code == 401 and r.json()["error"]["code"] == "token_expired"


async def test_me_shape(client: httpx.AsyncClient, signed_in: SignedIn) -> None:
    headers = await signed_in(email="ada@x.com", name="Ada")
    body = (await client.get(f"{API}/me", headers=headers)).json()
    assert set(body) == {"id", "display_name", "email", "avatar_url", "tutor_access"}
    assert body["display_name"] == "Ada" and body["email"] == "ada@x.com"
    assert body["avatar_url"] is None and body["tutor_access"] is False


async def test_dev_mode_unchanged(client: httpx.AsyncClient) -> None:
    assert get_settings().auth_mode == "dev"
    body = (await client.get(f"{API}/me")).json()
    assert body["display_name"] == "Dev User" and body["tutor_access"] is True


async def test_startup_refuses_bad_jwt_config(
    monkeypatch: pytest.MonkeyPatch, auth_settings: Settings
) -> None:
    monkeypatch.setenv("JWT_SECRET", "short")
    get_settings.cache_clear()
    with pytest.raises(ValueError, match="JWT_SECRET"):
        async with lifespan(app):
            pass


async def test_cors_allows_frontend_url_once(auth_settings: Settings) -> None:
    cors = next(m for m in create_app().user_middleware if m.cls is CORSMiddleware)
    assert cors.kwargs["allow_origins"] == ["http://localhost:4200", "http://web.test"]


# ---------------------------------------------------------------- isolation


async def test_users_cannot_see_each_other(
    client: httpx.AsyncClient, signed_in: SignedIn, fake_llm: FakeLLM
) -> None:
    a = await signed_in(email=INVITED_EMAIL)
    b = await signed_in(email=INVITED_EMAIL)
    fake_llm.events = [DONE]

    # user A creates one of everything
    await client.put(f"{API}/study/notes/two-pointers", json={"body": "A secret"}, headers=a)
    card = (
        await client.post(f"{API}/study/cards", json={"front": "Q", "back": "A"}, headers=a)
    ).json()
    job = (
        await client.post(
            f"{API}/jobs/applications", json={"company": "Zoho", "role": "SDE"}, headers=a
        )
    ).json()
    chat = (await client.post(f"{API}/tutor/sessions", json={}, headers=a)).json()
    pid = "best-k-day-total"
    total = len((await client.get(f"{API}/practice/problems/{pid}", headers=a)).json()["cases"])
    sub = f"{API}/practice/problems/{pid}/submissions"
    await client.post(
        sub, json={"code": "x", "passed": total, "total": total, "runtime_ms": 1}, headers=a
    )

    # user B sees none of it
    assert (await client.get(f"{API}/study/notes", headers=b)).json()["items"] == []
    assert (await client.get(f"{API}/study/notes/two-pointers", headers=b)).json()["body"] == ""
    assert (await client.get(f"{API}/study/cards", headers=b)).json()["items"] == []
    assert (await client.get(f"{API}/jobs/applications", headers=b)).json()["items"] == []
    assert (await client.get(f"{API}/tutor/sessions", headers=b)).json()["items"] == []
    assert (await client.get(sub, headers=b)).json()["items"] == []
    summary = (await client.get(f"{API}/practice/problems/{pid}", headers=b)).json()
    assert summary["solved"] is False and summary["attempts"] == 0

    # ... and cannot touch A's rows by id
    cid, aid, sid = card["id"], job["id"], chat["id"]
    cross = [
        client.post(f"{API}/study/cards/{cid}/review", json={"grade": "good"}, headers=b),
        client.patch(f"{API}/study/cards/{cid}", json={"front": "hack"}, headers=b),
        client.delete(f"{API}/study/cards/{cid}", headers=b),
        client.patch(f"{API}/jobs/applications/{aid}", json={"role": "hack"}, headers=b),
        client.delete(f"{API}/jobs/applications/{aid}", headers=b),
        client.get(f"{API}/tutor/sessions/{sid}", headers=b),
        client.post(f"{API}/tutor/sessions/{sid}/messages", json={"text": "hi"}, headers=b),
        client.delete(f"{API}/tutor/sessions/{sid}", headers=b),
    ]
    for request in cross:
        r = await request
        assert r.status_code == 404, r.text

    # B writing to the same note key does not change A's note
    await client.put(f"{API}/study/notes/two-pointers", json={"body": "B text"}, headers=b)
    assert (await client.get(f"{API}/study/notes/two-pointers", headers=a)).json()[
        "body"
    ] == "A secret"

    # A's data is intact
    assert len((await client.get(f"{API}/study/cards", headers=a)).json()["items"]) == 1
    assert (await client.get(f"{API}/jobs/applications", headers=a)).status_code == 200
    detail = (await client.get(f"{API}/tutor/sessions/{sid}", headers=a)).json()
    assert detail["messages"] == []
    assert len((await client.get(sub, headers=a)).json()["items"]) == 1


# ---------------------------------------------------------------- tutor invite


async def test_tutor_invite(
    client: httpx.AsyncClient, signed_in: SignedIn, fake_llm: FakeLLM
) -> None:
    fake_llm.events = [LLMEvent("delta", "Hi"), DONE]

    invited = await signed_in(email=INVITED_EMAIL)  # settings hold it upper-case: still matches
    assert (await client.get(f"{API}/me", headers=invited)).json()["tutor_access"] is True
    chat = (await client.post(f"{API}/tutor/sessions", json={}, headers=invited)).json()
    r = await client.post(
        f"{API}/tutor/sessions/{chat['id']}/messages", json={"text": "hello"}, headers=invited
    )
    assert r.status_code == 200 and "event: done" in r.text

    for who in (
        await signed_in(email="other@x.com"),
        await signed_in(email=INVITED_EMAIL, verified=False),
        await signed_in(email=None, verified=False),
    ):
        assert (await client.get(f"{API}/me", headers=who)).json()["tutor_access"] is False
        mine = (await client.post(f"{API}/tutor/sessions", json={}, headers=who)).json()
        r = await client.post(
            f"{API}/tutor/sessions/{mine['id']}/messages", json={"text": "hi"}, headers=who
        )
        assert r.status_code == 403 and r.json()["error"]["code"] == "tutor_not_invited"

    async with get_sessionmaker()() as db:
        assert await db.scalar(select(func.count()).select_from(ChatMessage)) == 2  # only invited
    assert len(fake_llm.calls) == 1


async def test_stale_user_email_does_not_grant_tutor(
    client: httpx.AsyncClient, signed_in: SignedIn
) -> None:
    headers = await signed_in(email="other@x.com")
    async with get_sessionmaker()() as db:
        user = await db.scalar(select(User))
        assert user is not None
        user.email = INVITED_EMAIL  # stale or hand-edited; identities are what count
        await db.commit()
    assert (await client.get(f"{API}/me", headers=headers)).json()["tutor_access"] is False


# ---------------------------------------------------------------- account deletion


async def test_delete_account_removes_everything(
    client: httpx.AsyncClient, signed_in: SignedIn, fake_llm: FakeLLM, clock: Clock
) -> None:
    headers = await signed_in(email=INVITED_EMAIL)
    fake_llm.events = [DONE]
    await client.put(f"{API}/study/notes/two-pointers", json={"body": "x"}, headers=headers)
    await client.post(f"{API}/study/cards", json={"front": "Q", "back": "A"}, headers=headers)
    await client.post(
        f"{API}/jobs/applications", json={"company": "Z", "role": "R"}, headers=headers
    )
    chat = (await client.post(f"{API}/tutor/sessions", json={}, headers=headers)).json()
    await client.post(
        f"{API}/tutor/sessions/{chat['id']}/messages", json={"text": "hi"}, headers=headers
    )
    await client.put(f"{API}/progress/arrays", json={"status": "confident"}, headers=headers)
    me = (await client.get(f"{API}/me", headers=headers)).json()

    # a real refresh token for the same user
    async with get_sessionmaker()() as db:
        db.add(
            RefreshToken(
                user_id=uuid.UUID(me["id"]),
                family_id=uuid.uuid4(),
                token_hash=hash_secret("old-refresh"),
                expires_at=clock() + timedelta(days=1),
            )
        )
        await db.commit()
    assert (await refresh(client, "old-refresh")).status_code == 200

    other = await signed_in(email="keep@x.com")
    await client.put(f"{API}/study/notes/two-pointers", json={"body": "keep"}, headers=other)

    r = await client.delete(f"{API}/me", headers=headers)
    assert r.status_code == 204

    async with get_sessionmaker()() as db:
        for table in Base.metadata.sorted_tables:
            if "user_id" in table.c:
                n = await db.scalar(
                    select(func.count()).select_from(table).where(table.c.user_id == me["id"])
                )
                assert n == 0, table.name
        assert await db.get(User, uuid.UUID(me["id"])) is None
        assert await db.scalar(select(func.count()).select_from(User)) == 1  # the other user

    assert (await refresh(client, "old-refresh")).status_code == 401
    r = await client.get(f"{API}/me", headers=headers)
    assert r.status_code == 401 and r.json()["error"]["code"] == "token_invalid"
    assert len((await client.get(f"{API}/study/notes", headers=other)).json()["items"]) == 1
