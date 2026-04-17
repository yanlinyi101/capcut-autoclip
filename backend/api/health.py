import shutil
import subprocess
from fastapi import APIRouter
from backend.core.config import settings

router = APIRouter(prefix="/health", tags=["health"])


def _probe(cmd: str, version_args: list[str]) -> dict:
    """Return {installed, path, version, error}."""
    path = shutil.which(cmd)
    if not path:
        return {"installed": False, "path": None, "version": None, "error": "未找到可执行文件"}
    try:
        r = subprocess.run(
            [path, *version_args],
            capture_output=True,
            text=True,
            timeout=5,
        )
        version = (r.stdout or r.stderr).strip().split("\n")[0]
        return {"installed": True, "path": path, "version": version, "error": None}
    except Exception as e:
        return {"installed": True, "path": path, "version": None, "error": str(e)}


def _check_python_pkg(mod: str) -> dict:
    try:
        __import__(mod)
        return {"installed": True, "error": None}
    except ImportError as e:
        return {"installed": False, "error": str(e)}


@router.get("/dependencies")
async def check_dependencies():
    """Frontend calls this on startup to detect missing system tools."""
    yt_dlp = _probe(settings.yt_dlp_path, ["--version"])
    ffmpeg = _probe(settings.ffmpeg_path, ["-version"])

    pkgs = {
        "openai": _check_python_pkg("openai"),
        "whisper": _check_python_pkg("whisper"),
        "scenedetect": _check_python_pkg("scenedetect"),
        "jieba": _check_python_pkg("jieba"),
    }

    deepseek_configured = bool(settings.deepseek_api_key)

    critical_missing = []
    if not yt_dlp["installed"]:
        critical_missing.append("yt-dlp")
    if not ffmpeg["installed"]:
        critical_missing.append("ffmpeg")

    return {
        "ok": len(critical_missing) == 0,
        "critical_missing": critical_missing,
        "tools": {
            "yt-dlp": yt_dlp,
            "ffmpeg": ffmpeg,
        },
        "python_packages": pkgs,
        "llm": {
            "enabled": settings.llm_enabled,
            "deepseek_configured": deepseek_configured,
            "model": settings.deepseek_model,
        },
    }
