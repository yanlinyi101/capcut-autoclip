from pydantic import BaseModel


class KeywordRow(BaseModel):
    index: int
    start_time: str
    end_time: str
    text: str
    keywords: list[str]
    needs_broll: bool = False
    broll_reason: str = ""


class ExtractResponse(BaseModel):
    project_id: str
    total_rows: int
    keywords: list[KeywordRow]
