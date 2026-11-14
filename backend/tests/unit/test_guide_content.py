"""The real guides in content/guides/: every runnable example runs."""

import sqlite3
import subprocess
import sys
import time
from contextlib import closing

import pytest

from app.modules.topics.catalog import load_catalog
from app.modules.topics.guides import CodeBlock, get_guides


def run_python(code: str, timeout: float = 10) -> None:
    """Run a snippet in a fresh, isolated interpreter; fail on an error or a failed assert."""
    result = subprocess.run(
        [sys.executable, "-I", "-c", code], capture_output=True, text=True, timeout=timeout
    )
    if result.returncode != 0:
        raise AssertionError(result.stderr.strip())


def run_sql(code: str, timeout: float = 10) -> None:
    """Run a SQL script against an empty in-memory SQLite database; abort after `timeout` s."""
    deadline = time.monotonic() + timeout
    with closing(sqlite3.connect(":memory:")) as db:
        # SQLite calls this every 10,000 steps; returning True interrupts the query.
        db.set_progress_handler(lambda: time.monotonic() > deadline, 10_000)
        db.executescript(code)


RUN_BLOCKS: list[tuple[str, CodeBlock]] = [
    (topic_id, block)
    for topic_id, guide in sorted(get_guides().items())
    for block in guide.blocks
    if block.run
]


def test_run_python_times_out() -> None:
    with pytest.raises(subprocess.TimeoutExpired):
        run_python("while True: pass", timeout=1)


def test_run_python_reports_failed_assert() -> None:
    with pytest.raises(AssertionError, match="AssertionError"):
        run_python("assert 1 == 2")


def test_run_sql_times_out() -> None:
    endless = (
        "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n) SELECT count(*) FROM n;"
    )
    with pytest.raises(sqlite3.OperationalError, match="interrupted"):
        run_sql(endless, timeout=0.5)


def test_run_sql_reports_errors() -> None:
    with pytest.raises(sqlite3.OperationalError):
        run_sql("SELECT * FROM missing;")


@pytest.mark.parametrize(
    ("topic_id", "block"), RUN_BLOCKS, ids=[f"{t}-{i}" for i, (t, _) in enumerate(RUN_BLOCKS)]
)
def test_guide_blocks_run(topic_id: str, block: CodeBlock) -> None:
    if block.lang == "python":
        assert "assert" in block.code, f"{topic_id}: a python run block needs an assert"
        run_python(block.code)
    elif block.lang == "sql":
        run_sql(block.code)
    else:
        pytest.fail(f"{topic_id}: '{block.lang} run' is not runnable; use python or sql")


def test_every_topic_has_a_guide() -> None:
    topic_ids = {t.id for t in load_catalog("content").topics}
    assert sorted(topic_ids - set(get_guides())) == []


def test_every_topic_has_key_ideas_and_links() -> None:
    for t in load_catalog("content").topics:
        assert t.concepts, f"{t.id} has no key ideas"
        assert 2 <= len(t.resources) <= 4, f"{t.id} has {len(t.resources)} links"
