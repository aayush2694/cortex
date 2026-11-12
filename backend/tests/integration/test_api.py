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
