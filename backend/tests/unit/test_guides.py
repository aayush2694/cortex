from pathlib import Path

import pytest

from app.modules.topics.catalog import load_catalog
from app.modules.topics.guides import (
    SECTIONS,
    GuideError,
    load_guides,
    parse_guide,
    validate_guide,
)
from app.modules.topics.links import is_allowed

PROSE = " ".join(["word"] * 650)
RUN = "```python run\nassert 1 + 1 == 2\n```"
BASIC = ["In short", "The idea", "How it works", "Code", "Common mistakes", "In interviews"]


def doc(sections: dict[str, str]) -> str:
    return "\n\n".join(f"## {title}\n\n{body}" for title, body in sections.items())


def full(titles: list[str], code: str = RUN) -> str:
    bodies = {t: "" for t in titles}
    bodies[titles[0]] = PROSE
    if "Code" in bodies:
        bodies["Code"] = code
    return doc(bodies)


def test_parses_sections_in_order() -> None:
    guide = parse_guide("x", doc({"In short": "a", "The idea": "b"}))
    assert guide.sections == ("In short", "The idea")
    assert guide.topic_id == "x"


def test_hash_comment_in_code_block_is_not_a_heading() -> None:
    guide = parse_guide("x", doc({"Code": "```python run\n## step 2\nassert True\n```"}))
    assert guide.sections == ("Code",)
    assert len(guide.blocks) == 1
    assert guide.blocks[0].lang == "python"
    assert guide.blocks[0].run is True
    assert "## step 2" in guide.blocks[0].code


def test_display_only_block_is_not_run() -> None:
    guide = parse_guide("x", doc({"Code": "```ts\nconst a = 1;\n```"}))
    assert guide.blocks[0].lang == "ts"
    assert guide.blocks[0].run is False


def test_wrong_case_heading_is_rejected() -> None:
    with pytest.raises(GuideError, match=r"x\.md.*In Short"):
        parse_guide("x", doc({"In Short": "a"}))


def test_out_of_order_rejected() -> None:
    with pytest.raises(GuideError, match="order"):
        parse_guide("x", doc({"The idea": "a", "In short": "b"}))


def test_duplicate_rejected() -> None:
    with pytest.raises(GuideError, match="twice"):
        parse_guide("x", "## In short\n\na\n\n## In short\n\nb")


def test_text_before_first_heading_rejected() -> None:
    with pytest.raises(GuideError, match="before"):
        parse_guide("x", "Intro text\n\n## In short\n\na")


def test_valid_dsa_guide_passes() -> None:
    validate_guide(parse_guide("x", full(BASIC)), "dsa")


def test_missing_required_for_track() -> None:
    guide = parse_guide(
        "x", full(["In short", "The idea", "How it works", "Common mistakes", "In interviews"])
    )
    with pytest.raises(GuideError, match="Trade-offs"):
        validate_guide(guide, "system-design")


def test_trade_offs_optional_for_dsa() -> None:
    validate_guide(parse_guide("x", full(BASIC)), "dsa")
    with_trade_offs = BASIC[:4] + ["Trade-offs"] + BASIC[4:]
    validate_guide(parse_guide("x", full(with_trade_offs)), "dsa")


def test_words_exclude_code() -> None:
    code = "```python\n" + " ".join(["x"] * 1000) + "\n```"
    sections = {t: "" for t in SECTIONS}
    sections["In short"] = " ".join(["word"] * 100)
    sections["Code"] = code
    guide = parse_guide("x", doc(sections))
    assert guide.words == 100
    with pytest.raises(GuideError, match="600"):
        validate_guide(guide, "frameworks")


def test_dsa_needs_a_python_run_block() -> None:
    guide = parse_guide("x", full(BASIC, code="```python\nx = 1\n```"))
    with pytest.raises(GuideError, match="python run"):
        validate_guide(guide, "dsa")


def test_sql_topic_needs_a_sql_run_block() -> None:
    guide = parse_guide("sql-joins", full(BASIC, code="```sql\nSELECT 1;\n```"))
    with pytest.raises(GuideError, match="sql run"):
        validate_guide(guide, "languages")
    ok = parse_guide("sql-joins", full(BASIC, code="```sql run\nSELECT 1;\n```"))
    validate_guide(ok, "languages")


# ---------------------------------------------------------------- links


def test_allowed_host_and_www_prefix() -> None:
    assert is_allowed("https://www.postgresql.org/docs/")
    assert is_allowed("https://docs.python.org/3/library/bisect.html")


def test_lookalike_and_unknown_hosts_rejected() -> None:
    assert not is_allowed("https://evil-postgresql.org/")
    assert not is_allowed("https://postgresql.org.evil.com/")
    assert not is_allowed("https://medium.com/x")


def test_every_catalog_link_is_allowed() -> None:
    catalog = load_catalog("content")
    bad = [
        f"{t.id}: {r.url}"
        for t in catalog.topics
        for r in t.resources
        if not is_allowed(str(r.url))
    ]
    assert bad == []


# ---------------------------------------------------------------- loading


def test_orphan_guide_file_rejected(tmp_path: Path) -> None:
    (tmp_path / "guides").mkdir()
    (tmp_path / "guides" / "nope.md").write_text("## In short\n\na\n", encoding="utf-8")
    with pytest.raises(GuideError, match="Unknown topic 'nope'"):
        load_guides(tmp_path, {"arrays": "dsa"})


def test_load_guides_without_folder_returns_empty(tmp_path: Path) -> None:
    assert load_guides(tmp_path, {"arrays": "dsa"}) == {}


def test_load_guides_validates_each_file(tmp_path: Path) -> None:
    (tmp_path / "guides").mkdir()
    (tmp_path / "guides" / "arrays.md").write_text(full(BASIC), encoding="utf-8")
    guides = load_guides(tmp_path, {"arrays": "dsa"})
    assert guides["arrays"].sections == tuple(BASIC)
    (tmp_path / "guides" / "arrays.md").write_text("## In short\n\nshort\n", encoding="utf-8")
    with pytest.raises(GuideError, match="missing"):
        load_guides(tmp_path, {"arrays": "dsa"})


def test_list_markers_are_not_words() -> None:
    guide = parse_guide("x", doc({"In short": "- one\n- two\n1. three\n* four — five"}))
    assert guide.words == 5
