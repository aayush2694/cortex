import json
from typing import Any

import httpx
import pytest

from app.clients.llm import LLMEvent
from tests.integration.conftest import FakeLLM

API = "/api/v1"


def parse_sse(body: str) -> list[tuple[str, dict[str, Any]]]:
    events = []
    for chunk in body.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in chunk.splitlines())
        events.append((lines["event"], json.loads(lines["data"])))
    return events


# ---------------------------------------------------------------- basics


async def test_health(client: httpx.AsyncClient) -> None:
    r = await client.get("/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}
    assert r.headers["x-request-id"]


async def test_me_creates_dev_user_once(client: httpx.AsyncClient) -> None:
    a = (await client.get(f"{API}/me")).json()
    b = (await client.get(f"{API}/me")).json()
    assert a["display_name"] == "Dev User" and a["id"] == b["id"]


async def test_unknown_route_uses_error_shape(client: httpx.AsyncClient) -> None:
    r = await client.get(f"{API}/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


# ---------------------------------------------------------------- topics


async def test_knowledge_map(client: httpx.AsyncClient) -> None:
    data = (await client.get(f"{API}/topics")).json()
    ids = {t["id"] for t in data["topics"]}
    assert {"arrays", "binary-search", "dijkstra", "rag"} <= ids
    assert {"source": "arrays", "target": "binary-search"} in data["edges"]
    dsa = (await client.get(f"{API}/topics", params={"track": "dsa"})).json()
    assert all(t["track"] == "dsa" for t in dsa["topics"])


async def test_topic_resources(client: httpx.AsyncClient) -> None:
    d = (await client.get(f"{API}/topics/django-models-orm")).json()
    assert d["track"] == "frameworks"
    assert {
        "label": "Models",
        "url": "https://docs.djangoproject.com/en/stable/topics/db/models/",
    } in d["resources"]
    assert {t["id"] for t in d["requires"]} == {"django-basics"}
    frameworks = (await client.get(f"{API}/topics", params={"track": "frameworks"})).json()
    assert len(frameworks["topics"]) >= 10


async def test_topic_concepts(client: httpx.AsyncClient) -> None:
    d = (await client.get(f"{API}/topics/caching")).json()
    assert d["track"] == "system-design"
    assert len(d["concepts"]) >= 3
    assert any("Cache-aside" in c for c in d["concepts"])
    sd = (await client.get(f"{API}/topics", params={"track": "system-design"})).json()
    assert len(sd["topics"]) >= 20


async def test_topic_detail_and_404(client: httpx.AsyncClient) -> None:
    d = (await client.get(f"{API}/topics/dijkstra")).json()
    assert {t["id"] for t in d["requires"]} == {"bfs", "heaps"}
    r = await client.get(f"{API}/topics/heapsortt")
    assert r.status_code == 404 and r.json()["error"]["code"] == "topic_not_found"


# ---------------------------------------------------------------- progress


async def test_progress_flow(client: httpx.AsyncClient) -> None:
    items = (await client.get(f"{API}/progress")).json()["items"]
    assert all(i["status"] == "not_started" for i in items)

    r = await client.put(f"{API}/progress/arrays", json={"status": "confident"})
    assert r.status_code == 200 and r.json()["mastery"] == 0.7

    r = await client.post(
        f"{API}/progress/binary-search/events", json={"kind": "visualizer_completed"}
    )
    assert r.json() == {**r.json(), "status": "learning", "mastery": 0.4}

    by_id = {i["topic_id"]: i for i in (await client.get(f"{API}/progress")).json()["items"]}
    assert by_id["arrays"]["status"] == "confident"
    assert by_id["binary-search"]["mastery"] == 0.4


async def test_progress_validation(client: httpx.AsyncClient) -> None:
    r = await client.put(f"{API}/progress/arrays", json={"status": "expert"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_failed"
    r = await client.put(f"{API}/progress/not-a-topic", json={"status": "learning"})
    assert r.status_code == 404


async def test_next_follows_prerequisites(client: httpx.AsyncClient) -> None:
    first = [i["topic"]["id"] for i in (await client.get(f"{API}/progress/next")).json()["items"]]
    assert "arrays" not in first  # needs big-o first
    for t in ("big-o", "arrays"):
        await client.put(f"{API}/progress/{t}", json={"status": "confident"})
    nxt = (await client.get(f"{API}/progress/next", params={"limit": 10})).json()["items"]
    ids = [i["topic"]["id"] for i in nxt]
    assert "binary-search" in ids and "arrays" not in ids


# ---------------------------------------------------------------- visualizer


async def test_visualizer_list_and_trace(client: httpx.AsyncClient) -> None:
    algos = (await client.get(f"{API}/visualizer/algorithms")).json()["items"]
    assert [a["key"] for a in algos][:4] == [
        "bubble_sort",
        "insertion_sort",
        "merge_sort",
        "quick_sort",
    ]
    r = await client.post(
        f"{API}/visualizer/merge_sort/trace", json={"input": {"array": [3, 1, 2]}}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["result"]["array"] == [1, 2, 3] and body["view"] == "array"


async def test_visualizer_errors(client: httpx.AsyncClient) -> None:
    r = await client.post(f"{API}/visualizer/bogo_sort/trace", json={"input": {"array": [1]}})
    assert r.status_code == 404 and r.json()["error"]["code"] == "algorithm_not_found"
    r = await client.post(f"{API}/visualizer/bubble_sort/trace", json={"input": {"array": []}})
    assert r.status_code == 422 and r.json()["error"]["details"]


# ---------------------------------------------------------------- tutor


async def test_tutor_streams_and_saves(client: httpx.AsyncClient, fake_llm: FakeLLM) -> None:
    await client.put(f"{API}/progress/arrays", json={"status": "confident"})
    s = (await client.post(f"{API}/tutor/sessions", json={"topic_id": "binary-search"})).json()
    assert s["title"] == "Binary Search"

    fake_llm.events = [
        LLMEvent("delta", "What happens "),
        LLMEvent("delta", "to the range?"),
        LLMEvent(
            "done",
            data={
                "content": [{"type": "text", "text": "What happens to the range?"}],
                "stop_reason": "end_turn",
                "model": "fake",
                "input_tokens": 10,
                "output_tokens": 5,
            },
        ),
    ]
    r = await client.post(
        f"{API}/tutor/sessions/{s['id']}/messages", json={"text": "Why is it log n?"}
    )
    assert r.headers["content-type"].startswith("text/event-stream")
    events = parse_sse(r.text)
    assert [e for e, _ in events] == ["delta", "delta", "done"]

    # The prompt included the topic and the learner's progress.
    context = fake_llm.calls[0]["system"][1]["text"]
    assert "Current topic: Binary Search" in context and "Arrays" in context
    assert fake_llm.calls[0]["messages"] == [
        {"role": "user", "content": [{"type": "text", "text": "Why is it log n?"}]}
    ]

    detail = (await client.get(f"{API}/tutor/sessions/{s['id']}")).json()
    assert [(m["role"], m["text"]) for m in detail["messages"]] == [
        ("user", "Why is it log n?"),
        ("assistant", "What happens to the range?"),
    ]

    # Second turn replays history.
    await client.post(f"{API}/tutor/sessions/{s['id']}/messages", json={"text": "It halves"})
    assert [m["role"] for m in fake_llm.calls[1]["messages"]] == ["user", "assistant", "user"]


async def test_tutor_refusal_and_error(client: httpx.AsyncClient, fake_llm: FakeLLM) -> None:
    s = (await client.post(f"{API}/tutor/sessions", json={})).json()
    fake_llm.events = [LLMEvent("delta", "partial"), LLMEvent("refused", data={"message": "no"})]
    events = parse_sse(
        (await client.post(f"{API}/tutor/sessions/{s['id']}/messages", json={"text": "hi"})).text
    )
    assert events[-1][0] == "refused"

    fake_llm.events = [LLMEvent("error", data={"code": "ai_not_configured", "message": "x"})]
    events = parse_sse(
        (
            await client.post(f"{API}/tutor/sessions/{s['id']}/messages", json={"text": "hi again"})
        ).text
    )
    assert events == [("error", {"code": "ai_not_configured", "message": "x"})]

    # Neither failed reply was saved; both user messages were.
    detail = (await client.get(f"{API}/tutor/sessions/{s['id']}")).json()
    assert [m["role"] for m in detail["messages"]] == ["user", "user"]


async def test_tutor_unknown_session(client: httpx.AsyncClient, fake_llm: FakeLLM) -> None:
    r = await client.post(
        f"{API}/tutor/sessions/00000000-0000-0000-0000-000000000000/messages", json={"text": "hi"}
    )
    assert r.status_code == 404 and r.json()["error"]["code"] == "session_not_found"
    assert fake_llm.calls == []


async def test_tutor_stream_crash_still_ends_with_error(
    client: httpx.AsyncClient, fake_llm: FakeLLM
) -> None:
    async def crashing_stream(*_: Any) -> Any:
        yield LLMEvent("delta", "partial")
        raise RuntimeError("boom")

    fake_llm.stream = crashing_stream  # type: ignore[method-assign]
    s = (await client.post(f"{API}/tutor/sessions", json={})).json()
    r = await client.post(f"{API}/tutor/sessions/{s['id']}/messages", json={"text": "hi"})
    events = parse_sse(r.text)
    assert [e for e, _ in events] == ["delta", "error"]
    assert events[-1][1]["code"] == "internal_error"


# ---------------------------------------------------------------- patterns


async def test_pattern_topic_and_solved_problems(client: httpx.AsyncClient) -> None:
    t = (await client.get(f"{API}/topics/sliding-window")).json()
    assert t["pattern"]["group"] == "Arrays and strings"
    assert t["visualizer"] == "sliding_window"
    slug = t["pattern"]["problems"][0]["slug"]
    coding = (await client.get(f"{API}/practice/problems?topic_id=sliding-window")).json()
    total = len(t["pattern"]["problems"]) + len(coding["items"])  # LeetCode + Cortex problems

    r = await client.put(f"{API}/progress/sliding-window/problems/{slug}", json={"solved": True})
    assert r.status_code == 200
    item = r.json()
    assert item["status"] == "learning"  # solving a problem starts the topic
    assert item["mastery"] == pytest.approx(0.3 + 0.2 / total, abs=1e-3)

    solved = (await client.get(f"{API}/progress/problems")).json()["items"]
    assert [(s["topic_id"], s["slug"]) for s in solved] == [("sliding-window", slug)]

    r = await client.put(f"{API}/progress/sliding-window/problems/{slug}", json={"solved": False})
    assert r.json()["mastery"] == pytest.approx(0.3, abs=1e-3)
    assert (await client.get(f"{API}/progress/problems")).json()["items"] == []


async def test_unknown_problem_rejected(client: httpx.AsyncClient) -> None:
    r = await client.put(f"{API}/progress/sliding-window/problems/two-sum", json={"solved": True})
    assert r.status_code == 422 and r.json()["error"]["code"] == "unknown_problem"
    r = await client.put(f"{API}/progress/arrays/problems/two-sum", json={"solved": True})
    assert r.status_code == 422


async def test_pattern_walkthrough_is_listed(client: httpx.AsyncClient) -> None:
    algos = (await client.get(f"{API}/visualizer/algorithms")).json()["items"]
    kinds = {a["key"]: a["kind"] for a in algos}
    assert kinds["bubble_sort"] == "algorithm" and kinds["sliding_window"] == "pattern"
    r = await client.post(
        f"{API}/visualizer/sliding_window/trace", json={"input": {"text": "pwwkew"}}
    )
    assert r.status_code == 200 and r.json()["result"]["best"] == 3


# ---------------------------------------------------------------- practice (code runner)


async def test_practice_list_detail_solution_and_runtime(client: httpx.AsyncClient) -> None:
    items = (await client.get(f"{API}/practice/problems")).json()["items"]
    assert len(items) >= 12
    assert all(not i["solved"] and i["attempts"] == 0 for i in items)
    mine = (await client.get(f"{API}/practice/problems?topic_id=sliding-window")).json()["items"]
    assert {i["topic_id"] for i in mine} == {"sliding-window"}

    detail = (await client.get(f"{API}/practice/problems/best-k-day-total")).json()
    assert detail["function"] == "best_k_day_total"
    assert any(c["hidden"] for c in detail["cases"]) and "solution" not in detail

    sol = (await client.get(f"{API}/practice/problems/best-k-day-total/solution")).json()
    assert "def best_k_day_total" in sol["code"]

    r = await client.get(f"{API}/practice/runtime")
    assert r.status_code == 200 and "def run_cases_json" in r.text

    r = await client.get(f"{API}/practice/problems/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "problem_not_found"


async def test_practice_submission_solves_and_raises_mastery(client: httpx.AsyncClient) -> None:
    pid = "best-k-day-total"
    total = len((await client.get(f"{API}/practice/problems/{pid}")).json()["cases"])
    url = f"{API}/practice/problems/{pid}/submissions"

    r = await client.post(url, json={"code": "x", "passed": 1, "total": total + 1, "runtime_ms": 1})
    assert r.status_code == 422 and r.json()["error"]["code"] == "wrong_case_count"

    r = await client.post(url, json={"code": "x", "passed": 2, "total": total, "runtime_ms": 3})
    assert r.status_code == 201 and r.json()["accepted"] is False
    r = await client.post(url, json={"code": "y", "passed": total, "total": total, "runtime_ms": 2})
    assert r.status_code == 201 and r.json()["accepted"] is True

    history = (await client.get(url)).json()["items"]
    assert [h["accepted"] for h in history] == [True, False]  # newest first
    summary = (await client.get(f"{API}/practice/problems/{pid}")).json()
    assert summary["solved"] is True and summary["attempts"] == 2

    progress = (await client.get(f"{API}/progress")).json()["items"]
    sw = next(p for p in progress if p["topic_id"] == "sliding-window")
    assert sw["status"] == "learning" and sw["mastery"] > 0.3  # base 0.3 + practice share


# ---------------------------------------------------------------- study tools


async def test_topic_cards_review_and_due(client: httpx.AsyncClient) -> None:
    r = await client.post(f"{API}/study/topics/sliding-window/cards")
    assert r.status_code == 200
    kinds = sorted(c["kind"] for c in r.json()["items"])
    assert kinds == ["ideas", "signals", "template"]
    # Adding again doesn't duplicate.
    assert (await client.post(f"{API}/study/topics/sliding-window/cards")).json()["added"] == 0

    due = (await client.get(f"{API}/study/cards/due")).json()["items"]
    assert len(due) == 3
    card = due[0]
    assert card["next"]["good"] == 1.0

    r = await client.post(f"{API}/study/cards/{card['id']}/review", json={"grade": "good"})
    assert r.status_code == 200 and r.json()["reps"] == 1
    assert len((await client.get(f"{API}/study/cards/due")).json()["items"]) == 2

    r = await client.post(f"{API}/study/cards/{card['id']}/review", json={"grade": "meh"})
    assert r.status_code == 422


async def test_custom_cards_and_errors(client: httpx.AsyncClient) -> None:
    r = await client.post(f"{API}/study/cards", json={"front": "GIL?", "back": "One thread"})
    assert r.status_code == 201 and r.json()["kind"] == "custom" and r.json()["topic_id"] is None
    cid = r.json()["id"]
    r = await client.post(
        f"{API}/study/cards", json={"topic_id": "nope", "front": "a", "back": "b"}
    )
    assert r.status_code == 404
    assert (await client.delete(f"{API}/study/cards/{cid}")).status_code == 204
    assert (await client.delete(f"{API}/study/cards/{cid}")).status_code == 404
    # Topics without key ideas can't make cards.
    topics = (await client.get(f"{API}/topics")).json()["topics"]
    bare = next((t["id"] for t in topics if not t.get("concepts") and not t.get("pattern")), None)
    if bare:
        r = await client.post(f"{API}/study/topics/{bare}/cards")
        assert r.status_code == 422 and r.json()["error"]["code"] == "nothing_to_review"


async def test_notes_save_list_and_clear(client: httpx.AsyncClient) -> None:
    assert (await client.get(f"{API}/study/notes/two-pointers")).json()["body"] == ""
    r = await client.put(f"{API}/study/notes/two-pointers", json={"body": "# Sorted?\nUse ends"})
    assert r.status_code == 200 and r.json()["updated_at"]
    notes = (await client.get(f"{API}/study/notes")).json()["items"]
    assert notes == [
        {"topic_id": "two-pointers", "preview": "Sorted?", "updated_at": notes[0]["updated_at"]}
    ]
    await client.put(f"{API}/study/notes/two-pointers", json={"body": "  "})
    assert (await client.get(f"{API}/study/notes")).json()["items"] == []


async def test_activity_streak_and_today(client: httpx.AsyncClient) -> None:
    await client.put(f"{API}/progress/two-pointers", json={"status": "learning"})
    act = (await client.get(f"{API}/study/activity?tz=Asia/Kolkata")).json()
    assert act["streak"] == 1 and act["active_days"] == 1 and act["total"] >= 1
    r = await client.get(f"{API}/study/activity?tz=Mars/Olympus")
    assert r.status_code == 422 and r.json()["error"]["code"] == "bad_time_zone"

    today = (await client.get(f"{API}/study/today?tz=Asia/Kolkata")).json()
    # Two Pointers is the only topic in progress, so today's problem comes from it.
    assert today["problem"]["topic_id"] == "two-pointers"
    assert today["problem"]["difficulty"] == "easy"
    assert today["days_left"] is None and today["pace"] is None

    r = await client.put(
        f"{API}/study/plan", json={"target_date": today["date"], "daily_problems": 2}
    )
    assert r.status_code == 200 and r.json()["daily_problems"] == 2
    today = (await client.get(f"{API}/study/today?tz=Asia/Kolkata")).json()
    assert today["days_left"] == 0 and today["pace"] == today["remaining_problems"]


# ---------------------------------------------------------------- job search tools


async def test_application_board_flow(client: httpx.AsyncClient) -> None:
    url = f"{API}/jobs/applications"
    a = (await client.post(url, json={"company": "Zoho", "role": "Backend"})).json()
    assert a["status"] == "wishlist" and a["applied_on"] is None and a["position"] == 1
    b = (await client.post(url, json={"company": "Postman", "role": "SDE 2"})).json()
    assert b["position"] == 2

    # Moving to "applied" stamps the date and puts the card at the end of that column.
    r = await client.patch(f"{url}/{a['id']}", json={"status": "applied"})
    assert r.status_code == 200
    moved = r.json()
    assert moved["applied_on"] is not None and moved["position"] == 1

    r = await client.patch(
        f"{url}/{b['id']}",
        json={"status": "offer", "fixed": 16, "variable": 2, "next_step": None},
    )
    assert r.json()["fixed"] == 16 and r.json()["status"] == "offer"
    # Required fields can't be cleared with null.
    r = await client.patch(f"{url}/{b['id']}", json={"company": None, "notes": None})
    assert r.json()["company"] == "Postman" and r.json()["notes"] == ""

    assert len((await client.get(url)).json()["items"]) == 2
    assert (await client.patch(f"{url}/{a['id']}", json={"status": "ghosted"})).status_code == 422
    assert (await client.delete(f"{url}/{a['id']}")).status_code == 204
    assert (await client.delete(f"{url}/{a['id']}")).status_code == 404


async def test_profile_match_and_questions(client: httpx.AsyncClient) -> None:
    assert (await client.get(f"{API}/jobs/profile")).json()["current_ctc"] is None
    r = await client.put(f"{API}/jobs/profile", json={"current_ctc": 11})
    assert r.json()["current_ctc"] == 11

    r = await client.post(
        f"{API}/jobs/match", json={"resume": "Python and Django", "job": "Python, Redis"}
    )
    assert r.json()["score"] == 50
    assert [s["name"] for s in r.json()["missing"]] == ["Redis"]

    bank = (await client.get(f"{API}/jobs/questions")).json()
    assert {c["id"] for c in bank["categories"]} >= {"python", "django", "behavioral"}
    qid = bank["items"][0]["id"]
    r = await client.put(f"{API}/jobs/questions/{qid}", json={"practised": True})
    assert r.json()["practised"] is True and r.json()["my_answer"] == ""
    r = await client.put(f"{API}/jobs/questions/{qid}", json={"my_answer": "My take"})
    assert r.json()["practised"] is True and r.json()["my_answer"] == "My take"
    assert (await client.put(f"{API}/jobs/questions/nope", json={})).status_code == 404


# ---------------------------------------------------------------- tutor daily limit


@pytest.fixture
def tutor_limit() -> Any:
    """Lower the daily limit for a test, then put it back."""
    from app.core.config import get_settings

    settings = get_settings()
    original = settings.tutor_daily_limit
    settings.tutor_daily_limit = 2
    yield 2
    settings.tutor_daily_limit = original


def done_event() -> list[LLMEvent]:
    return [
        LLMEvent(
            "done",
            data={
                "content": [{"type": "text", "text": "ok"}],
                "stop_reason": "end_turn",
                "model": "fake",
                "input_tokens": 1,
                "output_tokens": 1,
            },
        )
    ]


async def test_tutor_refuses_messages_over_the_daily_limit(
    client: httpx.AsyncClient, fake_llm: FakeLLM, tutor_limit: int
) -> None:
    fake_llm.events = done_event()
    s = (await client.post(f"{API}/tutor/sessions", json={})).json()
    url = f"{API}/tutor/sessions/{s['id']}/messages"
    for i in range(tutor_limit):
        assert (await client.post(url, json={"text": f"q{i}"})).status_code == 200

    r = await client.post(url, json={"text": "one too many"})
    assert r.status_code == 429
    err = r.json()["error"]
    assert err["code"] == "tutor_limit_reached"
    assert err["details"]["limit"] == tutor_limit and err["details"]["reset_at"]
    # Claude was not called and the refused message was not saved.
    assert len(fake_llm.calls) == tutor_limit
    detail = (await client.get(f"{API}/tutor/sessions/{s['id']}")).json()
    assert "one too many" not in [m["text"] for m in detail["messages"]]


async def test_tutor_limit_resets_the_next_day(
    client: httpx.AsyncClient, fake_llm: FakeLLM, tutor_limit: int
) -> None:
    from sqlalchemy import text

    from app.core.db import get_engine

    fake_llm.events = done_event()
    s = (await client.post(f"{API}/tutor/sessions", json={})).json()
    url = f"{API}/tutor/sessions/{s['id']}/messages"
    for i in range(tutor_limit):
        await client.post(url, json={"text": f"q{i}"})

    # Yesterday's messages don't count against today.
    async with get_engine().begin() as conn:
        await conn.execute(
            text("UPDATE chat_messages SET created_at = created_at - interval '1 day'")
        )
    assert (await client.post(url, json={"text": "new day"})).status_code == 200
