from pydantic import BaseModel, Field


class Transform(BaseModel):
    x: float = 0.0
    y: float = 0.0
    scale: float = 1.0


class BrollSegment(BaseModel):
    segment_id: str
    row_index: int | None = None
    start: float
    end: float
    duration: float
    text: str
    keywords: list[str] = []
    all_keywords: list[str] = []
    reason: str
    confidence: float


class DetectResponse(BaseModel):
    project_id: str
    total: int
    segments: list[BrollSegment]


class FrameMeta(BaseModel):
    material_id: int | None = None
    scene_idx: int
    timestamp: float
    scene_start: float
    scene_end: float
    frame_path: str


class KeyframesResponse(BaseModel):
    project_id: str
    total_videos: int
    index: dict[str, list[FrameMeta]]


class PlanItem(BaseModel):
    segment_id: str
    start: float
    end: float
    material_id: int
    source_offset: float = 0.0
    preset: str = "hide_speaker"
    transform: Transform = Field(default_factory=Transform)


class PlanRequest(BaseModel):
    plan: list[PlanItem]
    canvas_width: int = 1920
    canvas_height: int = 1080


class RenderTaskResponse(BaseModel):
    task_id: str
    total_items: int
    status: str


class OutputItem(BaseModel):
    segment_id: str
    clip_path: str
    clip_rel: str
    duration: float
    preset: str
    transform: Transform
    timeline_start: float
    timeline_end: float
    source_material_id: int | None = None


class OutputResponse(BaseModel):
    project_id: str
    output_dir: str
    plan_path: str | None = None
    readme_path: str | None = None
    clips: list[OutputItem] = []
