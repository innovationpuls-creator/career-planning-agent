from pydantic import BaseModel


class JobRequirementGraphNode(BaseModel):
    id: str
    type: str
    title: str
    description: str
    icon: str
    keywords: list[str] = []
    profile_count: int = 0
    non_default_count: int = 0
    coverage_ratio: float = 0
    group_key: str | None = None


class JobRequirementGraphEdge(BaseModel):
    source: str
    target: str
    type: str


class JobRequirementGraphPayload(BaseModel):
    nodes: list[JobRequirementGraphNode]
    edges: list[JobRequirementGraphEdge]
    meta: dict[str, str | int]


class JobRequirementGraphResponse(BaseModel):
    success: bool = True
    data: JobRequirementGraphPayload
