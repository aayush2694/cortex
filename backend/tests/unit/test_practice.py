"""The coding problems and the harness that judges them (the same file runs in the browser)."""

import json

import pytest

from app.core.config import get_settings
from app.modules.practice.catalog import (
    PracticeCatalog,
    PracticeCatalogError,
    load_practice,
    validate_practice,
)
from app.modules.practice.harness import matches, run_cases, run_cases_json, run_sql
from app.modules.topics.catalog import load_catalog

CONTENT = get_settings().content_dir
PRACTICE = load_practice(CONTENT)
CASES = [pytest.param(p, id=p.id) for p in PRACTICE.problems]


def test_problems_point_at_real_pattern_topics() -> None:
    topics = {t.id: t for t in load_catalog(CONTENT).topics}
    validate_practice(PRACTICE, set(topics))
    for p in PRACTICE.problems:
        if p.language == "sql":
            assert p.topic_id.startswith("sql-"), f"{p.id} should belong to a SQL topic"
        else:
            assert topics[p.topic_id].pattern is not None, f"{p.id} should belong to a pattern"


def judge(problem, code):  # type: ignore[no-untyped-def]
    cases = [c.model_dump() for c in problem.cases]
    if problem.language == "sql":
        return run_sql(code, problem.setup, cases, problem.compare)
    return run_cases(
        code, problem.function, cases, problem.compare, problem.arg_types, problem.returns
    )


@pytest.mark.parametrize("problem", CASES)
def test_reference_solution_passes_every_case(problem) -> None:  # type: ignore[no-untyped-def]
    run = judge(problem, problem.solution)
    assert run["compile_error"] is None
    failed = [i for i, r in enumerate(run["results"]) if not r["passed"]]
    assert not failed, f"{problem.id}: cases {failed} fail: {run['results']}"


@pytest.mark.parametrize("problem", CASES)
def test_starter_code_does_not_pass(problem) -> None:  # type: ignore[no-untyped-def]
    run = judge(problem, problem.starter)
    assert run["compile_error"] is None
    assert not all(r["passed"] for r in run["results"])


def test_catalog_rejects_bad_problems() -> None:
    raw = PRACTICE.model_dump()
    dupe = PracticeCatalog.model_validate({"problems": raw["problems"][:1] * 2})
    with pytest.raises(PracticeCatalogError, match="Duplicate"):
        validate_practice(dupe)
    no_hidden = raw["problems"][0] | {
        "cases": [c | {"hidden": False} for c in raw["problems"][0]["cases"]]
    }
    with pytest.raises(PracticeCatalogError, match="hidden"):
        validate_practice(PracticeCatalog.model_validate({"problems": [no_hidden]}))
    with pytest.raises(PracticeCatalogError, match="unknown topic"):
        validate_practice(PRACTICE, {"arrays"})


# ---------------------------------------------------------------- harness


def test_harness_reports_syntax_and_runtime_errors_with_your_line() -> None:
    run = run_cases("def f(x)\n    return x", "f", [{"args": [1], "expected": 1}])
    assert run["compile_error"] == "SyntaxError: expected ':' (line 1)"

    src = "def f(x):\n    y = 1\n    return x[5]\n"
    run = run_cases(src, "f", [{"args": [[1]], "expected": 1}])
    result = run["results"][0]
    assert not result["passed"]
    assert result["error"] == "IndexError: list index out of range (line 3)"

    run = run_cases("def g(x):\n    return x", "f", [{"args": [1], "expected": 1}])
    assert run["compile_error"] == "Define a function called f()"


def test_harness_captures_print_and_isolates_inputs() -> None:
    src = "def f(xs):\n    print('len', len(xs))\n    xs.append(0)\n    return tuple(xs)\n"
    shared = [1, 2]
    run = run_cases(src, "f", [{"args": [shared], "expected": [1, 2, 0]}] * 2)
    assert [r["passed"] for r in run["results"]] == [True, True]  # tuple == list, no leakage
    assert run["results"][0]["stdout"] == "len 2\n"
    assert shared == [1, 2]


def test_compare_modes() -> None:
    assert matches([3, 1, 2], [1, 2, 3], "unordered")
    assert not matches([3, 1, 2], [1, 2, 3], "exact")
    assert matches([["b", "a"], ["c"]], [["c"], ["a", "b"]], "unordered_nested")
    assert not matches([1, 2], [1, 2, 2], "unordered")


def test_json_entry_point_round_trips() -> None:
    payload = {
        "code": "def f(a, b):\n    return a + b",
        "function": "f",
        "cases": [{"args": [2, 3], "expected": 5}],
    }
    out = json.loads(run_cases_json(json.dumps(payload)))
    assert out["results"][0]["passed"] is True


def test_harness_builds_linked_lists_and_trees() -> None:
    reverse = (
        "def f(head):\n    prev = None\n    while head:\n"
        "        head.next, prev, head = prev, head, head.next\n    return prev\n"
    )
    run = run_cases(
        reverse, "f", [{"args": [[1, 2, 3]], "expected": [3, 2, 1]}], "exact", ["list"], "list"
    )
    assert run["results"][0]["passed"]

    has_cycle = (
        "def f(head):\n    seen = set()\n    while head:\n"
        "        if head in seen:\n            return True\n"
        "        seen.add(head)\n        head = head.next\n    return False\n"
    )
    cases = [
        {"args": [{"values": [1, 2, 3], "pos": 0}], "expected": True},
        {"args": [{"values": [1, 2], "pos": -1}], "expected": False},
    ]
    run = run_cases(has_cycle, "f", cases, "exact", ["cycle_list"])
    assert [r["passed"] for r in run["results"]] == [True, True]

    mirror = (
        "def f(root):\n    if root:\n        root.left, root.right = f(root.right), f(root.left)\n"
        "    return root\n"
    )
    case = {"args": [[1, 2, 3, None, 4]], "expected": [1, 3, 2, None, None, 4]}
    run = run_cases(mirror, "f", [case], "exact", ["tree"], "tree")
    assert run["results"][0]["passed"], run

    # A returned list with a cycle fails cleanly instead of hanging.
    loop = "def f(head):\n    head.next = head\n    return head\n"
    run = run_cases(loop, "f", [{"args": [[1, 2]], "expected": [1]}], "exact", ["list"], "list")
    assert "never ends" in run["results"][0]["error"]

    # ListNode and TreeNode are ready to use in your code.
    make = "def f(n):\n    return TreeNode(n, TreeNode(n - 1))\n"
    run = run_cases(make, "f", [{"args": [5], "expected": [5, 4]}], "exact", None, "tree")
    assert run["results"][0]["passed"]


# ---------------------------------------------------------------- SQL

SQL_SETUP = "CREATE TABLE t (id INTEGER, name TEXT);"
SQL_CASE = {"args": [{"t": [[1, "a"], [2, None]]}], "expected": [["a"]]}


def test_sql_runs_a_query_per_case_and_reports_columns() -> None:
    run = run_sql("SELECT name AS who FROM t WHERE name IS NOT NULL;", SQL_SETUP, [SQL_CASE])
    result = run["results"][0]
    assert result["passed"] and result["columns"] == ["who"]


def test_sql_errors_are_readable() -> None:
    assert run_sql("-- nothing yet\n", SQL_SETUP, [SQL_CASE])["compile_error"]
    run = run_sql("SELEC name FROM t", SQL_SETUP, [SQL_CASE])
    assert run["results"][0]["error"].startswith("OperationalError")
    run = run_sql("SELECT 1; SELECT 2;", SQL_SETUP, [SQL_CASE])
    assert run["results"][0]["error"] == "Run one statement at a time"


def test_sql_cases_are_isolated() -> None:
    # Deleting rows in one case can't affect the next: each case gets a fresh database.
    run = run_sql("DELETE FROM t", SQL_SETUP, [SQL_CASE, SQL_CASE])
    assert [r["output"] for r in run["results"]] == [[], []]
    run = run_sql("SELECT name FROM t WHERE name = 'a'", SQL_SETUP, [SQL_CASE, SQL_CASE])
    assert all(r["passed"] for r in run["results"])


def test_sql_problems_know_their_tables() -> None:
    sql = [p for p in PRACTICE.problems if p.language == "sql"]
    assert len(sql) >= 10
    employees = next(p for p in sql if p.id == "who-is-the-manager").tables
    assert employees == {"employees": ["id", "name", "manager_id"]}
