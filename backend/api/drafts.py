import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from backend.core.config import settings
from backend.services.scan_service import scan_jianying_drafts

router = APIRouter(prefix="/drafts", tags=["drafts"])


@router.get("/")
async def list_drafts():
    """Scan and return all local JianYing draft projects."""
    draft_path = settings.jianying_draft_path
    if not os.path.isdir(draft_path):
        return {"drafts": [], "scan_path": draft_path, "error": "剪映草稿目录不存在"}
    drafts = scan_jianying_drafts(draft_path)
    return {"drafts": drafts, "scan_path": draft_path}


@router.get("/cover")
async def get_cover(path: str):
    """Serve a draft cover image by its absolute path."""
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="封面不存在")
    # Security: only serve jpg/png files under the JianYing directory
    if not path.endswith((".jpg", ".jpeg", ".png")):
        raise HTTPException(status_code=400, detail="不支持的文件格式")
    return FileResponse(path, media_type="image/jpeg")
