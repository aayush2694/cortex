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


# ---------------------------------------------------------------- pattern inputs


class TextInput(BaseModel):
    text: str = Field(min_length=1, max_length=24, pattern=r"^[a-z]+$")


class SumInput(BaseModel):
    array: list[Annotated[int, Field(ge=-99, le=99)]] = Field(min_length=1, max_length=16)
    k: Annotated[int, Field(ge=-999, le=999)]


class TargetInput(BaseModel):
    array: list[Value] = Field(min_length=2, max_length=16)
    target: Annotated[int, Field(ge=-1998, le=1998)]


class RotatedInput(BaseModel):
    """A sorted array of distinct numbers, rotated at some point (e.g. [4, 5, 6, 0, 1, 2])."""

    array: list[Value] = Field(min_length=1, max_length=16)
    target: Value

    @model_validator(mode="after")
    def check_rotated(self) -> Self:
        a = self.array
        if len(set(a)) != len(a):
            raise ValueError("Numbers must be distinct")
        drops = sum(1 for i in range(len(a) - 1) if a[i] > a[i + 1])
        if drops > 1 or (drops == 1 and a[-1] > a[0]):
            raise ValueError("Array must be a sorted array rotated at one point")
        return self


class OneToNInput(BaseModel):
    """n numbers, each between 1 and n (duplicates allowed)."""

    array: list[int] = Field(min_length=1, max_length=16)

    @model_validator(mode="after")
    def check_range(self) -> Self:
        n = len(self.array)
        if any(not 1 <= x <= n for x in self.array):
            raise ValueError(f"Every number must be between 1 and {n}")
        return self


class LinkedListInput(BaseModel):
    """A linked list; cycle_at is the index the last node points back to (-1 = no cycle)."""

    values: list[Annotated[int, Field(ge=-99, le=99)]] = Field(min_length=1, max_length=10)
    cycle_at: int = -1

    @model_validator(mode="after")
    def check_cycle(self) -> Self:
        if not -1 <= self.cycle_at < len(self.values):
            raise ValueError(
                f"cycle_at must be -1 (no cycle) or between 0 and {len(self.values) - 1}"
            )
        return self


class ListInput(BaseModel):
    values: list[Annotated[int, Field(ge=-99, le=99)]] = Field(min_length=1, max_length=10)


class TempsInput(BaseModel):
    array: list[Annotated[int, Field(ge=-99, le=199)]] = Field(min_length=1, max_length=14)


class IntervalsInput(BaseModel):
    intervals: list[tuple[int, int]] = Field(min_length=1, max_length=12)

    @model_validator(mode="after")
    def check_intervals(self) -> Self:
        for s, e in self.intervals:
            if not 0 <= s <= e <= 60:
                raise ValueError("Each interval needs 0 <= start <= end <= 60")
        return self


TreeValues = list[Annotated[int, Field(ge=-99, le=99)] | None]


def _check_level_order(values: TreeValues) -> None:
    if not values or values[0] is None:
        raise ValueError("The tree needs a root value first")
    if sum(v is not None for v in values) > 15:
        raise ValueError("Use at most 15 nodes")


class TreeInput(BaseModel):
    """A binary tree in LeetCode's level order, with null for missing children."""

    tree: TreeValues = Field(min_length=1, max_length=31)

    @model_validator(mode="after")
    def check_tree(self) -> Self:
        _check_level_order(self.tree)
        return self


class PathSumInput(TreeInput):
    target: Annotated[int, Field(ge=-999, le=999)]


class MatrixInput(BaseModel):
    """A grid of 1 (land) and 0 (water)."""

    grid: list[list[Annotated[int, Field(ge=0, le=1)]]] = Field(min_length=1, max_length=8)

    @model_validator(mode="after")
    def check_grid(self) -> Self:
        cols = len(self.grid[0])
        if not 1 <= cols <= 10 or any(len(r) != cols for r in self.grid):
            raise ValueError("Every row needs the same number of cells (1 to 10)")
        return self


Name = Annotated[str, Field(min_length=1, max_length=12)]


class DirectedGraphInput(BaseModel):
    """Tasks and 'a must come before b' edges."""

    nodes: list[Name] = Field(min_length=1, max_length=10)
    edges: list[tuple[Name, Name]] = Field(default_factory=list, max_length=24)

    @model_validator(mode="after")
    def check_edges(self) -> Self:
        if len(set(self.nodes)) != len(self.nodes):
            raise ValueError("Node names must be unique")
        known = set(self.nodes)
        for a, b in self.edges:
            if a not in known or b not in known:
                raise ValueError(f"Edge {a}->{b} uses an unknown node")
            if a == b:
                raise ValueError(f"{a} can't depend on itself")
        return self


class UndirectedGraphInput(DirectedGraphInput):
    pass


class TopKInput(BaseModel):
    array: list[Annotated[int, Field(ge=-99, le=99)]] = Field(min_length=1, max_length=12)
    k: int = Field(ge=1)

    @model_validator(mode="after")
    def check_k(self) -> Self:
        if self.k > len(self.array):
            raise ValueError("k can't be larger than the number of values")
        return self


class SubsetsInput(BaseModel):
    array: list[Annotated[int, Field(ge=-9, le=99)]] = Field(min_length=1, max_length=4)

    @model_validator(mode="after")
    def check_distinct(self) -> Self:
        if len(set(self.array)) != len(self.array):
            raise ValueError("Numbers must be distinct")
        return self


class TwoStringsInput(BaseModel):
    a: str = Field(min_length=1, max_length=8, pattern=r"^[a-z]+$")
    b: str = Field(min_length=1, max_length=8, pattern=r"^[a-z]+$")
