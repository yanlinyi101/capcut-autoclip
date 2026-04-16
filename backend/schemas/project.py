from pydantic import BaseModel
from datetime import datetime


class ProjectInitRequest(BaseModel):
    project_path: str


class ProjectResponse(BaseModel):
    project_id: str
    project_path: str
    srt_path: str
    video_path: str = ""
    has_draft_content: bool
    has_srt: bool
    has_video: bool = False
    status: str
    current_step: int
    created_at: datetime
