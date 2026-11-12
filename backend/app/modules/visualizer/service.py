"""Visualizer service: pure Python, no database. Runs an algorithm and returns its frames."""

from typing import Any

from pydantic import ValidationError

from app.core.errors import NotFound, ValidationFailed
from app.modules.visualizer import tracers  # noqa: F401  (registers all algorithms)
from app.modules.visualizer.schemas import AlgorithmOut, FrameOut, TraceOut
from app.modules.visualizer.tracer import REGISTRY, AlgorithmSpec, FrameLimitExceeded, Tracer


def _spec(key: str) -> AlgorithmSpec:
    spec = REGISTRY.get(key)
    if spec is None:
        raise NotFound(f"No algorithm called '{key}'", code="algorithm_not_found")
    return spec


def _describe(spec: AlgorithmSpec) -> AlgorithmOut:
    return AlgorithmOut(
        key=spec.key,
        title=spec.title,
        topic_id=spec.topic_id,
        view=spec.view,
        kind=spec.kind,
        description=spec.description,
        complexity=spec.complexity,
        source=spec.source.strip("\n").splitlines(),
        example=spec.example,
        input_schema=spec.input_model.model_json_schema(),
    )


def list_algorithms() -> list[AlgorithmOut]:
    return [_describe(s) for s in REGISTRY.values()]


def trace(key: str, raw_input: dict[str, Any]) -> TraceOut:
    spec = _spec(key)
    try:
        inp = spec.input_model.model_validate(raw_input)
    except ValidationError as exc:
        details = [{"loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors()]
        raise ValidationFailed("Input is not valid for this algorithm", details=details) from exc

    t = Tracer(spec.source)
    try:
        result = spec.run(inp, t)
    except FrameLimitExceeded as exc:
        raise ValidationFailed(str(exc), code="too_many_steps") from exc

    return TraceOut(
        algorithm=spec.key,
        view=spec.view,
        source=t.source_lines,
        input=inp.model_dump(mode="json"),
        frames=[FrameOut(**f) for f in t.frames],
        result=result,
        stats={**t.counters, "steps": len(t.frames)},
    )
