from pydantic_settings import BaseSettings
from pydantic import Field
import os
import json

_SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "settings.json")


def _default_jianying_path() -> str:
    home = os.path.expanduser("~")
    return os.path.join(home, "Movies", "JianyingPro", "User Data", "Projects", "com.lveditor.draft")


class Settings(BaseSettings):
    app_title: str = "AutoClip API"
    app_version: str = "1.0.0"
    data_dir: str = Field(default_factory=lambda: os.path.join(os.getcwd(), "data"))
    jianying_draft_path: str = Field(default_factory=_default_jianying_path)
    yt_dlp_path: str = "yt-dlp"
    max_search_rows: int = 10
    results_per_platform: int = 3
    download_format: str = "bestvideo+bestaudio/best"
    asr_method: str = "bcut"
    whisper_model: str = "base"
    language: str = "zh"
    ffmpeg_path: str = "ffmpeg"

    class Config:
        env_file = ".env"
        env_prefix = "AUTOCLIP_"


def _load_persisted() -> dict:
    path = os.path.abspath(_SETTINGS_FILE)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_persisted(data: dict):
    path = os.path.abspath(_SETTINGS_FILE)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# Load persisted settings on startup
_persisted = _load_persisted()
settings = Settings(**{k: v for k, v in _persisted.items() if v})
