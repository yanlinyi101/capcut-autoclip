from pydantic import BaseModel


class DownloadRequest(BaseModel):
    material_ids: list[int]


class DownloadStatus(BaseModel):
    material_id: int
    title: str
    status: str  # waiting / downloading / completed / failed
    percent: float = 0
    file_path: str | None = None
    file_size: str | None = None
    error: str | None = None


class DownloadTaskResponse(BaseModel):
    task_id: str
    total_items: int
    status: str
