"""Topic guides: one Markdown file per topic in content/guides/ (pure Python, no database)."""

import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings
from app.modules.topics.catalog import Track, load_catalog

SECTIONS: tuple[str, ...] = (
    "In short",
    "The idea",
    "How it works",
    "Code",
    "Trade-offs",
    "Common mistakes",
    "In interviews",
)

_CORE = frozenset({"In short", "The idea", "How it works", "Common mistakes", "In interviews"})

# Which sections each track must have; the others are optional.
REQUIRED: dict[Track, frozenset[str]] = {
    "dsa": _CORE | {"Code"},
    "languages": _CORE | {"Code"},
    "frameworks": _CORE | {"Code", "Trade-offs"},
    "system-design": _CORE | {"Trade-offs"},
    "ai": _CORE | {"Trade-offs"},
}

MIN_WORDS = 600
LIST_MARKER = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+")  # "- ", "* ", "1. ", "2) " are not words


@dataclass(frozen=True)
class CodeBlock:
    lang: str
    run: bool
    code: str


@dataclass(frozen=True)
class Guide:
    topic_id: str
    markdown: str
    sections: tuple[str, ...]
    words: int  # prose only: code, headings and bare symbols (list markers, dashes) not counted
    blocks: tuple[CodeBlock, ...]


class GuideError(ValueError):
    pass


def parse_guide(topic_id: str, text: str) -> Guide:
    """Split a guide into sections and code blocks; fail on unknown, repeated or misordered ones."""
    where = f"{topic_id}.md"
    sections: list[str] = []
    blocks: list[CodeBlock] = []
    words = 0
    fence: tuple[str, bool] | None = None  # (lang, run) while inside a ``` block
    code: list[str] = []

    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("```"):
            if fence is None:
                info = stripped[3:].split()
                fence = (info[0] if info else "", "run" in info[1:])
                code = []
            else:
                blocks.append(CodeBlock(lang=fence[0], run=fence[1], code="\n".join(code)))
                fence = None
            continue
        if fence is not None:
            code.append(line)
            continue
        if line.startswith("## "):
            title = line[3:]
            if title not in SECTIONS:
                raise GuideError(f"{where}: unknown section '{title}'")
            if title in sections:
                raise GuideError(f"{where}: section '{title}' appears twice")
            if sections and SECTIONS.index(title) < SECTIONS.index(sections[-1]):
                raise GuideError(f"{where}: section '{title}' is out of order")
            sections.append(title)
            continue
        if stripped and not sections:
            raise GuideError(f"{where}: text before the first section")
        prose = LIST_MARKER.sub("", line)
        words += sum(1 for token in prose.split() if any(ch.isalnum() for ch in token))

    if fence is not None:
        raise GuideError(f"{where}: a code block is not closed")
    return Guide(topic_id, text, tuple(sections), words, tuple(blocks))


def validate_guide(guide: Guide, track: Track) -> None:
    """Check the rules that depend on the topic: required sections, length, runnable code."""
    where = f"{guide.topic_id}.md"
    missing = [s for s in SECTIONS if s in REQUIRED[track] and s not in guide.sections]
    if missing:
        raise GuideError(f"{where}: missing section(s) {', '.join(missing)}")
    if guide.words < MIN_WORDS:
        raise GuideError(f"{where}: {guide.words} words, needs at least {MIN_WORDS}")
    if track == "dsa" and not any(b.run and b.lang == "python" for b in guide.blocks):
        raise GuideError(f"{where}: needs at least one ```python run block")
    if guide.topic_id.startswith("sql-") and not any(
        b.run and b.lang == "sql" for b in guide.blocks
    ):
        raise GuideError(f"{where}: needs at least one ```sql run block")


def load_guides(content_dir: str | Path, tracks: dict[str, Track]) -> dict[str, Guide]:
    """Read and check every content/guides/<topic-id>.md. `tracks` maps topic id to track."""
    folder = Path(content_dir) / "guides"
    if not folder.is_dir():
        return {}
    guides: dict[str, Guide] = {}
    for path in sorted(folder.glob("*.md")):
        topic_id = path.stem
        if topic_id not in tracks:
            raise GuideError(f"Unknown topic '{topic_id}' ({path.name} has no topic)")
        guide = parse_guide(topic_id, path.read_text(encoding="utf-8"))
        validate_guide(guide, tracks[topic_id])
        guides[topic_id] = guide
    return guides


@lru_cache
def get_guides() -> dict[str, Guide]:
    content_dir = get_settings().content_dir
    tracks = {t.id: t.track for t in load_catalog(content_dir).topics}
    return load_guides(content_dir, tracks)
