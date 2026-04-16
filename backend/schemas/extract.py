from pydantic import BaseModel


class KeywordRow(BaseModel):
    index: int
    start_time: str
    end_time: str
    text: str
    keywords: list[str]


class ExtractResponse(BaseModel):
    project_id: str
    total_rows: int
    keywords: list[KeywordRow]
