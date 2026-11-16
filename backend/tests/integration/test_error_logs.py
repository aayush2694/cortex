"""Error logs: one ERROR line with a traceback per crash, WARNING for 4xx, no private data."""

import logging
import re
from collections.abc import Iterator

import httpx
import pytest
from sqlalchemy.exc import IntegrityError

from app.core.auth import CurrentUser, DbSession
from app.core.db import get_sessionmaker
from app.main import app
from app.modules.users.models import User
from tests.integration.conftest import SignedIn

API = "/api/v1"
BOOM = "/test-only/boom"


@pytest.fixture
def boom_route() -> Iterator[None]:
    """A route that crashes after it knows who the user is."""

    async def boom(user: CurrentUser) -> None:
        raise RuntimeError("route crashed")

    app.add_api_route(BOOM, boom)
    added = app.router.routes[-1]
    yield
    app.router.routes.remove(added)


DB_BOOM = "/test-only/db-boom"
LEAKY_EMAIL = "leaky.person@x.com"


@pytest.fixture
def db_boom_route() -> Iterator[None]:
    """A route whose INSERT fails (duplicate primary key) with an email among its parameters."""

    async def db_boom(db: DbSession) -> None:
        async with get_sessionmaker()() as other:
            taken = User(display_name="First", email="first@x.com")
            other.add(taken)
            await other.commit()
        db.add(User(id=taken.id, display_name="Second", email=LEAKY_EMAIL))
        await db.flush()

    app.add_api_route(DB_BOOM, db_boom)
    added = app.router.routes[-1]
    yield
    app.router.routes.remove(added)


def app_log(caplog: pytest.LogCaptureFixture) -> list[logging.LogRecord]:
    # httpx logs the test client's own request URL; only the API's records matter here.
    return [r for r in caplog.records if not r.name.startswith("httpx")]


def as_text(records: list[logging.LogRecord]) -> str:
    formatter = logging.Formatter("%(levelname)s %(name)s: %(message)s")
    return "\n".join(formatter.format(r) for r in records)


async def test_unhandled_error_is_logged_once_with_context_and_no_private_data(
    client: httpx.AsyncClient,
    signed_in: SignedIn,
    boom_route: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    headers = await signed_in(email="private.person@x.com")
    me = (await client.get(f"{API}/me", headers=headers)).json()
    token = headers["Authorization"].removeprefix("Bearer ")
    caplog.clear()
    caplog.set_level(logging.DEBUG)

    r = await client.get(
        f"{BOOM}?q=private-query-text",
        headers={**headers, "x-request-id": "req-boom", "cookie": "cortex_login=cookie-value-x"},
    )

    assert r.status_code == 500
    assert r.json() == {
        "error": {
            "code": "internal_error",
            "message": "Something went wrong on our side",
            "request_id": "req-boom",
        }
    }
    errors = [rec for rec in app_log(caplog) if rec.levelno >= logging.ERROR]
    assert len(errors) == 1
    [error] = errors
    assert error.exc_info is not None and error.exc_info[0] is RuntimeError
    message = error.getMessage()
    for part in ("req-boom", "GET", BOOM, "500", f"user={me['id']}"):
        assert part in message

    logged = as_text(app_log(caplog))
    assert "route crashed" in logged  # the traceback is there
    for private in (token, "cookie-value-x", "private.person@x.com", "private-query-text"):
        assert private not in logged


async def test_client_errors_are_warnings_without_traceback(
    client: httpx.AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    r = await client.get(f"{API}/topics/no-such-topic?q=private-query-text")
    assert r.status_code == 404

    [record] = [rec for rec in app_log(caplog) if rec.levelno >= logging.WARNING]
    assert record.levelno == logging.WARNING and not record.exc_info
    assert "404" in record.getMessage() and "/api/v1/topics/no-such-topic" in record.getMessage()
    assert "private-query-text" not in as_text(app_log(caplog))


async def test_database_errors_do_not_log_statement_parameters(
    client: httpx.AsyncClient, db_boom_route: None, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    r = await client.get(DB_BOOM)

    assert r.status_code == 500
    [error] = [rec for rec in app_log(caplog) if rec.levelno >= logging.ERROR]
    assert error.exc_info is not None and error.exc_info[0] is IntegrityError
    logged = as_text(app_log(caplog))
    assert "INSERT INTO users" in logged  # the statement is there, its values are not
    assert LEAKY_EMAIL not in logged


@pytest.mark.parametrize("sent", ["req-OK-123", "a" * 64, "0f3c9e2d"])
async def test_a_well_formed_client_request_id_is_kept(
    client: httpx.AsyncClient, sent: str
) -> None:
    r = await client.get("/api/v1/topics/no-such-topic", headers={"x-request-id": sent})
    assert r.headers["x-request-id"] == sent
    assert r.json()["error"]["request_id"] == sent


@pytest.mark.parametrize("sent", ["a" * 65, "has space", "under_score", "<script>", "a.b", ""])
async def test_a_malformed_client_request_id_is_replaced(
    client: httpx.AsyncClient, sent: str, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    r = await client.get("/api/v1/topics/no-such-topic", headers={"x-request-id": sent})
    request_id = r.headers["x-request-id"]
    assert request_id != sent and re.fullmatch(r"[0-9a-f]{16}", request_id)
    assert r.json()["error"]["request_id"] == request_id
    if sent:
        assert sent not in as_text(app_log(caplog))
