import asyncio
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from backend.schemas.extract import ExtractResponse
from backend.services.init_service import get_project, update_project
from backend.services.extract_service import extract_from_srt
from backend.services.asr_service import generate_srt
from backend.core.config import settings
from backend.tasks.background import create_task, push_event, mark_done

router = APIRouter(prefix="/projects", tags=["extract"])


@router.post("/{project_id}/extract", response_model=ExtractResponse)
async def extract_keywords(project_id: str):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    srt_path = project.get("srt_path", "")
    if not srt_path:
        raise HTTPException(status_code=400, detail="未找到 SRT 字幕文件，请先生成字幕")

    try:
        keywords = await asyncio.to_thread(extract_from_srt, srt_path)
        update_project(project_id, {"keywords": keywords, "current_step": 2})
        return ExtractResponse(
            project_id=project_id,
            total_rows=len(keywords),
            keywords=keywords,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"提取失败: {e}")


@router.get("/{project_id}/keywords", response_model=ExtractResponse)
async def get_keywords(project_id: str):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    keywords = project.get("keywords", [])
    return ExtractResponse(
        project_id=project_id,
        total_rows=len(keywords),
        keywords=keywords,
    )


class GenerateSrtRequest(BaseModel):
    video_path: str = ""


@router.post("/{project_id}/generate-srt")
async def start_generate_srt(project_id: str, req: GenerateSrtRequest = GenerateSrtRequest()):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    # Use manually specified path if provided, otherwise fall back to auto-detected
    video_path = req.video_path.strip() or project.get("video_path", "")
    if not video_path:
        raise HTTPException(status_code=400, detail="未找到视频文件，请指定视频文件路径")

    import os
    if not os.path.exists(video_path):
        raise HTTPException(status_code=400, detail=f"视频文件不存在: {video_path}")

    task_id = create_task()

    async def _run():
        try:
            async for event in generate_srt(
                video_path=video_path,
                output_dir=project["project_path"],
                method=settings.asr_method,
                whisper_model=settings.whisper_model,
                language=settings.language,
                ffmpeg_path=settings.ffmpeg_path,
            ):
                push_event(task_id, {"type": event["stage"], "data": event})

                if event["stage"] == "completed":
                    srt_path = event.get("srt_path", "")
                    update_project(
                        project_id,
                        {"srt_path": srt_path, "has_srt": True},
                    )
        except Exception as e:
            push_event(task_id, {"type": "failed", "data": {"error": str(e)}})
        finally:
            mark_done(task_id)

    asyncio.create_task(_run())

    return {"task_id": task_id, "status": "started", "message": "ASR 字幕生成已开始"}


@router.get("/{project_id}/generate-srt/stream")
async def stream_generate_srt(project_id: str, task_id: str):
    from backend.core.sse_manager import sse_event_generator

    async def event_stream():
        async for event in sse_event_generator(task_id):
            yield event

    return EventSourceResponse(event_stream())
