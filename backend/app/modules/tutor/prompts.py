"""Prompt text for the tutor, and helpers that turn stored chat history into API messages."""

from typing import Any

TUTOR_RULES = """\
You are the Cortex tutor: a patient, encouraging teacher on a learning platform for \
software engineers who are preparing to switch jobs. Learners study data structures and \
algorithms, programming languages, frameworks such as Django, AI, and system design.

How you teach:
- Lead with understanding, not answers. When someone asks how to solve a problem, first \
give a hint or ask a guiding question. Give the full solution when they ask for it \
directly, or after they've had a real attempt.
- Check understanding. End explanations with a short question the learner can answer to \
test themselves, when it fits.
- Keep replies short and focused: a few short paragraphs at most. Use a small example \
before a big one.
- Use Python for code examples unless the learner asks for another language. Keep code \
blocks small and runnable.
- Connect ideas to what the learner already knows (see the learner context below), and \
mention when a prerequisite would help.
- Relate topics to interviews and real jobs when it helps: what interviewers look for, \
common mistakes, trade-offs.
- If you're not sure about something, say so rather than guessing.

Format replies in Markdown. Use `inline code` for names and fenced code blocks for code.\
"""


def session_context(topic: dict[str, Any] | None, confident: list[str], learning: list[str]) -> str:
    lines = ["<learner_context>"]
    if topic:
        lines.append(f"Current topic: {topic['title']} ({topic['track']})")
        lines.append(f"Topic summary: {topic['summary']}")
        if topic["requires"]:
            lines.append("Prerequisites: " + ", ".join(topic["requires"]))
    else:
        lines.append("Current topic: none (general question)")
    lines.append("Topics the learner is confident in: " + (", ".join(confident) or "none yet"))
    lines.append("Topics the learner is currently learning: " + (", ".join(learning) or "none"))
    lines.append("</learner_context>")
    return "\n".join(lines)


def build_system(context: str) -> list[dict[str, Any]]:
    # The rules never change, so they're marked for prompt caching (cheaper repeat calls).
    return [
        {"type": "text", "text": TUTOR_RULES, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": context},
    ]


def to_api_messages(history: list[tuple[str, list[dict[str, Any]]]]) -> list[dict[str, Any]]:
    """Turn stored (role, content blocks) into API messages.

    Only text blocks are replayed: earlier turns' thinking is not needed for a chat tutor.
    Consecutive messages with the same role (e.g. after a failed reply) are merged so
    roles always alternate.
    """
    out: list[dict[str, Any]] = []
    for role, blocks in history:
        texts = [
            {"type": "text", "text": b["text"]}
            for b in blocks
            if b.get("type") == "text" and b.get("text")
        ]
        if not texts:
            continue
        if out and out[-1]["role"] == role:
            out[-1]["content"].extend(texts)
        else:
            out.append({"role": role, "content": texts})
    while out and out[0]["role"] != "user":
        out.pop(0)
    return out
