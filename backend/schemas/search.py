from typing import Literal
from pydantic import BaseModel


class MaterialItem(BaseModel):
    id: int | None = None
    title: str
    url: str
    duration: str | None = None
    platform: str


class SearchGroupResult(BaseModel):
    keyword: str
    row_index: int
    start_time: str
    original_text: str
    youtube_results: list[MaterialItem]
    bilibili_results: list[MaterialItem]


class SearchRequest(BaseModel):
    max_rows: int = 0  # deprecated — ignored; scope is controlled by row selection on the Extract page
    results_per_platform: int = 3
    platforms: list[Literal["youtube", "bilibili"]] = ["youtube", "bilibili"]


class SearchTaskResponse(BaseModel):
    task_id: str
    status: str
    message: str


class MaterialsResponse(BaseModel):
    materials: list[SearchGroupResult]
    total_youtube: int
    total_bilibili: int
