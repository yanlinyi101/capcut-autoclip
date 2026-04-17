import os
from fastapi import APIRouter
from pydantic import BaseModel
from backend.core.config import settings, _save_persisted

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsModel(BaseModel):
    jianying_draft_path: str
    yt_dlp_path: str
    max_search_rows: int
    results_per_platform: int
    download_format: str
    asr_method: str = "bcut"
    whisper_model: str = "base"
    language: str = "zh"
    ffmpeg_path: str = "ffmpeg"
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    llm_enabled: bool = True
    proxy_url: str = ""


@router.get("/", response_model=SettingsModel)
async def get_settings():
    return SettingsModel(
        jianying_draft_path=settings.jianying_draft_path,
        yt_dlp_path=settings.yt_dlp_path,
        max_search_rows=settings.max_search_rows,
        results_per_platform=settings.results_per_platform,
        download_format=settings.download_format,
        asr_method=settings.asr_method,
        whisper_model=settings.whisper_model,
        language=settings.language,
        ffmpeg_path=settings.ffmpeg_path,
        deepseek_api_key=settings.deepseek_api_key,
        deepseek_base_url=settings.deepseek_base_url,
        deepseek_model=settings.deepseek_model,
        llm_enabled=settings.llm_enabled,
        proxy_url=settings.proxy_url,
    )


@router.put("/", response_model=SettingsModel)
async def update_settings(req: SettingsModel):
    settings.jianying_draft_path = req.jianying_draft_path
    settings.yt_dlp_path = req.yt_dlp_path
    settings.max_search_rows = req.max_search_rows
    settings.results_per_platform = req.results_per_platform
    settings.download_format = req.download_format
    settings.asr_method = req.asr_method
    settings.whisper_model = req.whisper_model
    settings.language = req.language
    settings.ffmpeg_path = req.ffmpeg_path
    settings.deepseek_api_key = req.deepseek_api_key
    settings.deepseek_base_url = req.deepseek_base_url
    settings.deepseek_model = req.deepseek_model
    settings.llm_enabled = req.llm_enabled
    settings.proxy_url = req.proxy_url

    _save_persisted(req.model_dump())

    return req


@router.post("/validate-path")
async def validate_path(path: str = ""):
    """Check if a path is a valid JianYing draft directory."""
    if not path:
        return {"valid": False, "error": "路径为空"}
    if not os.path.isdir(path):
        return {"valid": False, "error": "目录不存在"}
    meta = os.path.join(path, "root_meta_info.json")
    if not os.path.exists(meta):
        return {"valid": False, "error": "未找到 root_meta_info.json"}
    return {"valid": True}
