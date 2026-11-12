"""Run a solution against test cases.

This file is the single source of truth for judging code. The browser downloads it from
GET /api/v1/practice/runtime and runs it inside Pyodide; the backend tests import it to check
every reference solution. Keep it standard-library only and free of app imports.
"""

import contextlib
import copy
import io
import json
import time
import traceback
from typing import Any

MAX_STDOUT = 2000

COMPARES = ("exact", "unordered", "unordered_nested")


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
    source: str, function: str, cases: list[dict[str, Any]], compare: str = "exact"
) -> dict[str, Any]:
    """Define the user's code, then call `function` once per case.

    Returns {"compile_error": str | None, "stdout": str, "results": [...]}, where each result is
    {"passed", "output", "error", "stdout", "ms"}.
    """
    filename = "<solution>"
    namespace: dict[str, Any] = {"__name__": "solution"}
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
            with contextlib.redirect_stdout(out):
                output = _jsonable(fn(*copy.deepcopy(case["args"])))
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


def run_cases_json(payload: str) -> str:
    """Entry point for the browser: JSON in, JSON out."""
    p = json.loads(payload)
    return json.dumps(run_cases(p["code"], p["function"], p["cases"], p.get("compare", "exact")))
