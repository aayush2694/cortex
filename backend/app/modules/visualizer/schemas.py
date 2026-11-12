from typing import Any

from pydantic import BaseModel

from app.modules.visualizer.tracer import Kind, View


class AlgorithmOut(BaseModel):
    key: str
    title: str
    topic_id: str
    view: View
    kind: Kind
    description: str
    complexity: str
    source: list[str]
    example: dict[str, Any]
    input_schema: dict[str, Any]


class AlgorithmListOut(BaseModel):
    items: list[AlgorithmOut]


class TraceIn(BaseModel):
    input: dict[str, Any]


class FrameOut(BaseModel):
    line: int
    action: str
    message: str
    state: dict[str, Any]
    highlight: list[Any]
    counters: dict[str, int]


class TraceOut(BaseModel):
    algorithm: str
    view: View
    source: list[str]
    input: dict[str, Any]
    frames: list[FrameOut]
    result: dict[str, Any]
    stats: dict[str, int]
