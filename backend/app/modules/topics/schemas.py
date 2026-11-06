from pydantic import BaseModel, ConfigDict


class ResourceOut(BaseModel):
    label: str
    url: str


class TopicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    track: str
    title: str
    summary: str
    difficulty: int
    phase: int
    visualizer: str | None
    resources: list[ResourceOut] = []


class EdgeOut(BaseModel):
    source: str  # prerequisite
    target: str  # topic that needs it


class KnowledgeMapOut(BaseModel):
    topics: list[TopicOut]
    edges: list[EdgeOut]


class TopicDetailOut(TopicOut):
    requires: list[TopicOut]
    unlocks: list[TopicOut]
