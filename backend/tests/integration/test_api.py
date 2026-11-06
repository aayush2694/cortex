import json
from typing import Any

import httpx

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
