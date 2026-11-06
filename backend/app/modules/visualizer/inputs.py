"""Input shapes and size limits for each kind of visualization."""

from typing import Annotated, Self

from pydantic import BaseModel, Field, model_validator

Value = Annotated[int, Field(ge=-999, le=999)]
Cell = tuple[int, int]


class ArrayInput(BaseModel):
    array: list[Value] = Field(min_length=1, max_length=32)


class SearchInput(BaseModel):
    array: list[Value] = Field(min_length=1, max_length=32)
    target: Value


class GridInput(BaseModel):
    rows: int = Field(ge=2, le=20)
    cols: int = Field(ge=2, le=20)
    walls: list[Cell] = Field(default_factory=list, max_length=300)
    start: Cell
    end: Cell

    @model_validator(mode="after")
    def check_cells(self) -> Self:
        def inside(c: Cell) -> bool:
            return 0 <= c[0] < self.rows and 0 <= c[1] < self.cols

        for name, cell in (("start", self.start), ("end", self.end)):
            if not inside(cell):
                raise ValueError(f"{name} {list(cell)} is outside the grid")
        walls = set(self.walls)
        if any(not inside(w) for w in walls):
            raise ValueError("Every wall must be inside the grid")
        if self.start in walls or self.end in walls:
            raise ValueError("start and end can't be walls")
        return self


class Edge(BaseModel):
    source: str
    target: str
    weight: int = Field(ge=0, le=99)


class GraphInput(BaseModel):
    nodes: list[Annotated[str, Field(min_length=1, max_length=12)]] = Field(
        min_length=2, max_length=15
    )
    edges: list[Edge] = Field(max_length=60)
    start: str
    directed: bool = False

    @model_validator(mode="after")
    def check_graph(self) -> Self:
        if len(set(self.nodes)) != len(self.nodes):
            raise ValueError("Node names must be unique")
        known = set(self.nodes)
        if self.start not in known:
            raise ValueError(f"start node '{self.start}' is not in nodes")
        for e in self.edges:
            if e.source not in known or e.target not in known:
                raise ValueError(f"Edge {e.source}->{e.target} uses an unknown node")
        return self
