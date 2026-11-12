"""Run a solution against test cases.

This file is the single source of truth for judging code. The browser downloads it from
GET /api/v1/practice/runtime and runs it inside Pyodide; the backend tests import it to check
every reference solution. Keep it standard-library only and free of app imports.
"""

import contextlib
import copy
import io
import json
import sqlite3
import time
import traceback
from typing import Any

MAX_STDOUT = 2000
MAX_ROWS = 500  # rows of a SQL result kept for display and comparison
MAX_NODES = 10_000  # a returned list longer than this almost certainly has a cycle

COMPARES = ("exact", "unordered", "unordered_nested")
# How a case's JSON argument becomes a Python value, and how a return value becomes JSON:
#   plain       as is
#   list        [1, 2, 3]               <-> ListNode chain 1 -> 2 -> 3
#   cycle_list  {"values": [...], "pos": i}: a ListNode chain whose tail links back to
#               node i (pos -1 means no cycle)
#   tree        level order [3, 9, 20, null, null, 15, 7] <-> TreeNode
ARG_TYPES = ("plain", "list", "cycle_list", "tree")
RETURN_TYPES = ("plain", "list", "tree")


class ListNode:
    """A singly linked list node. Your code can use it directly."""

    def __init__(self, val: Any = 0, next: "ListNode | None" = None) -> None:
        self.val = val
        self.next = next

    def __repr__(self) -> str:
        return f"ListNode({self.val!r})"


class TreeNode:
    """A binary tree node. Your code can use it directly."""

    def __init__(
        self, val: Any = 0, left: "TreeNode | None" = None, right: "TreeNode | None" = None
    ) -> None:
        self.val = val
        self.left = left
        self.right = right

    def __repr__(self) -> str:
        return f"TreeNode({self.val!r})"


def build_list(values: list[Any], pos: int = -1) -> ListNode | None:
    nodes = [ListNode(v) for v in values]
    for a, b in zip(nodes, nodes[1:], strict=False):
        a.next = b
    if nodes and 0 <= pos < len(nodes):
        nodes[-1].next = nodes[pos]
    return nodes[0] if nodes else None


def list_values(head: Any) -> list[Any]:
    out: list[Any] = []
    while head is not None:
        if len(out) >= MAX_NODES:
            raise ValueError("The list you returned never ends (it has a cycle)")
        out.append(head.val)
        head = head.next
    return out


def build_tree(level: list[Any]) -> TreeNode | None:
    if not level or level[0] is None:
        return None
    root = TreeNode(level[0])
    queue, i = [root], 1
    for node in queue:
        if i >= len(level):
            break
        for side in ("left", "right"):
            if i < len(level) and level[i] is not None:
                child = TreeNode(level[i])
                setattr(node, side, child)
                queue.append(child)
            i += 1
    return root


def tree_values(root: Any) -> list[Any]:
    out: list[Any] = []
    queue = [root]
    for node in queue:
        if len(queue) > MAX_NODES:
            raise ValueError("The tree you returned is too big (does it loop back on itself?)")
        if node is None:
            out.append(None)
            continue
        out.append(node.val)
        queue.extend([node.left, node.right])
    while out and out[-1] is None:
        out.pop()
    return out


def _to_arg(value: Any, kind: str) -> Any:
    if kind == "list":
        return build_list(value)
    if kind == "cycle_list":
        return build_list(value["values"], value.get("pos", -1))
    if kind == "tree":
        return build_tree(value)
    return copy.deepcopy(value)


def _from_result(value: Any, kind: str) -> Any:
    if kind == "list":
        return list_values(value)
    if kind == "tree":
        return tree_values(value)
    return value


def _jsonable(value: Any) -> Any:
    """Tuples and sets become lists so results can be shown and compared like JSON."""
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, (set, frozenset)):
        return sorted((_jsonable(v) for v in value), key=repr)
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    return value


def _canonical(value: Any, compare: str) -> Any:
    value = _jsonable(value)
    if compare == "unordered" and isinstance(value, list):
        return sorted(value, key=repr)
    if compare == "unordered_nested" and isinstance(value, list):
        inner = [sorted(v, key=repr) if isinstance(v, list) else v for v in value]
        return sorted(inner, key=repr)
    return value


def matches(actual: Any, expected: Any, compare: str = "exact") -> bool:
    return bool(_canonical(actual, compare) == _canonical(expected, compare))


def _short_error(exc: BaseException, filename: str) -> str:
    """The exception plus the last line of *your* code it came from."""
    frames = [f for f in traceback.extract_tb(exc.__traceback__) if f.filename == filename]
    where = f" (line {frames[-1].lineno})" if frames else ""
    return f"{type(exc).__name__}: {exc}{where}"


def run_cases(
    source: str,
    function: str,
    cases: list[dict[str, Any]],
    compare: str = "exact",
    arg_types: list[str] | None = None,
    returns: str = "plain",
) -> dict[str, Any]:
    """Define the user's code, then call `function` once per case.

    Returns {"compile_error": str | None, "stdout": str, "results": [...]}, where each result is
    {"passed", "output", "error", "stdout", "ms"}.
    """
    filename = "<solution>"
    namespace: dict[str, Any] = {"__name__": "solution", "ListNode": ListNode, "TreeNode": TreeNode}
    top_out = io.StringIO()
    try:
        code = compile(source, filename, "exec")
        with contextlib.redirect_stdout(top_out):
            exec(code, namespace)
    except SyntaxError as exc:
        return {
            "compile_error": f"SyntaxError: {exc.msg} (line {exc.lineno})",
            "stdout": top_out.getvalue()[:MAX_STDOUT],
            "results": [],
        }
    except Exception as exc:
        return {
            "compile_error": _short_error(exc, filename),
            "stdout": top_out.getvalue()[:MAX_STDOUT],
            "results": [],
        }

    fn = namespace.get(function)
    if not callable(fn):
        return {
            "compile_error": f"Define a function called {function}()",
            "stdout": top_out.getvalue()[:MAX_STDOUT],
            "results": [],
        }

    results = []
    for case in cases:
        out = io.StringIO()
        start = time.perf_counter()
        output: Any = None
        error = None
        try:
            kinds = arg_types or ["plain"] * len(case["args"])
            args = [_to_arg(a, k) for a, k in zip(case["args"], kinds, strict=True)]
            with contextlib.redirect_stdout(out):
                result = fn(*args)
            output = _jsonable(_from_result(result, returns))
            passed = matches(output, case["expected"], compare)
        except Exception as exc:
            error = _short_error(exc, filename)
            passed = False
        try:
            json.dumps(output)
        except (TypeError, ValueError):
            output = repr(output)
        results.append(
            {
                "passed": passed,
                "output": output,
                "error": error,
                "stdout": out.getvalue()[:MAX_STDOUT],
                "ms": round((time.perf_counter() - start) * 1000, 2),
            }
        )
    return {"compile_error": None, "stdout": top_out.getvalue()[:MAX_STDOUT], "results": results}


def _only_comments(query: str) -> bool:
    lines = [line.strip() for line in query.splitlines()]
    return all(not line or line.startswith("--") for line in lines)


def run_sql(
    source: str, setup: str, cases: list[dict[str, Any]], compare: str = "exact"
) -> dict[str, Any]:
    """Run one SQL query against each case's tables in a fresh in-memory SQLite database.

    A case's single argument maps table name -> list of rows; `setup` creates the tables.
    Each result also carries the query's column names.
    """
    query = source.strip()
    if not query.rstrip(";").strip() or _only_comments(query):
        return {"compile_error": "Write a SELECT statement", "stdout": "", "results": []}

    results = []
    for case in cases:
        start = time.perf_counter()
        output: Any = None
        columns: list[str] = []
        error = None
        con = sqlite3.connect(":memory:")
        try:
            con.executescript(setup)
            for table, rows in case["args"][0].items():
                if rows:
                    marks = ", ".join("?" * len(rows[0]))
                    con.executemany(f'INSERT INTO "{table}" VALUES ({marks})', rows)
            try:
                cur = con.execute(query)
                output = [list(row) for row in cur.fetchmany(MAX_ROWS)]
                columns = [d[0] for d in cur.description or []]
            except sqlite3.ProgrammingError as exc:
                error = (
                    "Run one statement at a time"
                    if "one statement" in str(exc)
                    else f"{type(exc).__name__}: {exc}"
                )
            except sqlite3.Error as exc:
                error = f"{type(exc).__name__}: {exc}"
        finally:
            con.close()
        results.append(
            {
                "passed": error is None and matches(output, case["expected"], compare),
                "output": output,
                "columns": columns,
                "error": error,
                "stdout": "",
                "ms": round((time.perf_counter() - start) * 1000, 2),
            }
        )
    return {"compile_error": None, "stdout": "", "results": results}


def run_cases_json(payload: str) -> str:
    """Entry point for the browser: JSON in, JSON out."""
    p = json.loads(payload)
    if p.get("language") == "sql":
        return json.dumps(run_sql(p["code"], p["setup"], p["cases"], p.get("compare", "exact")))
    return json.dumps(
        run_cases(
            p["code"],
            p["function"],
            p["cases"],
            p.get("compare", "exact"),
            p.get("arg_types"),
            p.get("returns", "plain"),
        )
    )
