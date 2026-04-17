"""API for the auto-edit pipeline: B-Roll detection → keyframes → clipping → plan export."""
from __future__ import annotations

import asyncio
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse

from backend.core.config import settings
from backend.core.sse_manager import sse_event_generator
from backend.schemas.edit import (
    DetectResponse,
    KeyframesResponse,
    OutputResponse,
    PlanRequest,
    RenderTaskResponse,
)
from backend.services.broll_detector import detect_broll_segments
from backend.services.clipper_service import PRESETS, render_plan
from backend.services.init_service import get_project, update_project
from backend.services.keyframe_service import extract_keyframes
from backend.services.timeline_exporter import write_timeline_plan
from backend.tasks.background import create_task, mark_done, push_event

router = APIRouter(prefix="/projects", tags=["edit"])

# project_id -> latest task_id per stage
_keyframe_tasks: dict[str, str] = {}
_render_tasks: dict[str, str] = {}


def _output_root(project: dict) -> str:
    return os.path.join(project["project_path"], "autoclip_output")


@router.get("/edit/presets")
async def list_presets():
    return {
        "presets": [
            {
                "id": key,
                "label": cfg["label"],
                "transform": cfg["transform"],
            }
            for key, cfg in PRESETS.items()
        ]
    }


@router.post("/{project_id}/edit/detect", response_model=DetectResponse)
async def detect(project_id: str):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    keywords = project.get("keywords", [])
    if not keywords:
        raise HTTPException(status_code=400, detail="请先运行关键词提取")

    segments = await asyncio.to_thread(detect_broll_segments, keywords)
    update_project(project_id, {"broll_segments": segments})
    return DetectResponse(project_id=project_id, total=len(segments), segments=segments)


@router.get("/{project_id}/edit/segments", response_model=DetectResponse)
async def get_segments(project_id: str):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    segments = project.get("broll_segments", [])
    return DetectResponse(project_id=project_id, total=len(segments), segments=segments)


@router.post("/{project_id}/edit/keyframes")
async def start_keyframes(project_id: str):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    downloads = project.get("downloads", {})
    available = {
        int(mid) if isinstance(mid, str) else mid: info
        for mid, info in downloads.items()
        if info.get("file_path") and os.path.exists(info["file_path"])
    }
    if not available:
        raise HTTPException(status_code=400, detail="未发现已下载的素材")

    task_id = create_task()
    _keyframe_tasks[project_id] = task_id

    async def _run():
        try:
            index: dict[str, list[dict]] = {}
            async for event in extract_keyframes(available, _output_root(project)):
                push_event(task_id, event)
                if event["type"] == "complete":
                    d = event["data"]
                    index[str(d["material_id"])] = d["frames"]
                elif event["type"] == "all_complete":
                    index = event["data"]["index"]
            update_project(project_id, {"keyframes": index})
        except Exception as e:
            push_event(task_id, {"type": "error", "data": {"error": str(e)}})
        finally:
            mark_done(task_id)

    asyncio.create_task(_run())
    return {"task_id": task_id, "total_items": len(available), "status": "running"}


@router.get("/{project_id}/edit/keyframes/stream")
async def stream_keyframes(project_id: str):
    task_id = _keyframe_tasks.get(project_id)
    if not task_id:
        raise HTTPException(status_code=404, detail="没有正在进行的关键帧任务")
    return EventSourceResponse(sse_event_generator(task_id))


@router.get("/{project_id}/edit/keyframes", response_model=KeyframesResponse)
async def get_keyframes(project_id: str):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    index = project.get("keyframes", {})
    return KeyframesResponse(
        project_id=project_id,
        total_videos=len(index),
        index=index,
    )


@router.get("/{project_id}/edit/frame")
async def serve_frame(project_id: str, path: str = Query(...)):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    abs_path = os.path.abspath(path)
    output_root = os.path.abspath(_output_root(project))
    if not abs_path.startswith(output_root):
        raise HTTPException(status_code=400, detail="路径不在输出目录内")
    if not abs_path.lower().endswith((".jpg", ".jpeg", ".png")):
        raise HTTPException(status_code=400, detail="不支持的文件格式")
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="帧文件不存在")
    return FileResponse(abs_path, media_type="image/jpeg")


@router.get("/{project_id}/edit/clip")
async def serve_clip(project_id: str, path: str = Query(...)):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    abs_path = os.path.abspath(path)
    output_root = os.path.abspath(_output_root(project))
    if not abs_path.startswith(output_root):
        raise HTTPException(status_code=400, detail="路径不在输出目录内")
    if not abs_path.lower().endswith(".mp4"):
        raise HTTPException(status_code=400, detail="不支持的文件格式")
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(abs_path, media_type="video/mp4")


@router.post("/{project_id}/edit/render", response_model=RenderTaskResponse)
async def start_render(project_id: str, req: PlanRequest):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    if not req.plan:
        raise HTTPException(status_code=400, detail="剪辑计划为空")

    downloads = {int(k) if isinstance(k, str) else k: v for k, v in project.get("downloads", {}).items()}
    output_root = _output_root(project)
    canvas = {"width": req.canvas_width, "height": req.canvas_height}

    # Persist the user's plan
    plan_dicts = [item.model_dump() for item in req.plan]
    update_project(project_id, {"edit_plan": plan_dicts, "canvas": canvas})

    task_id = create_task()
    _render_tasks[project_id] = task_id

    async def _run():
        clips: list[dict] = []
        try:
            async for event in render_plan(
                plan_dicts,
                downloads,
                output_root,
                req.canvas_width,
                req.canvas_height,
                ffmpeg_path=settings.ffmpeg_path,
            ):
                push_event(task_id, event)
                if event["type"] == "complete":
                    clips.append(event["data"])

            # Export timeline + README
            project_name = Path(project["project_path"]).name
            meta = await asyncio.to_thread(
                write_timeline_plan,
                output_root,
                project_name,
                canvas,
                clips,
            )
            update_project(
                project_id,
                {
                    "clips": clips,
                    "output_dir": output_root,
                    "plan_path": meta["plan_path"],
                    "readme_path": meta["readme_path"],
                    "current_step": 5,
                },
            )
            push_event(
                task_id,
                {
                    "type": "exported",
                    "data": {
                        "plan_path": meta["plan_path"],
                        "readme_path": meta["readme_path"],
                        "clips_count": len(clips),
                    },
                },
            )
        except Exception as e:
            push_event(task_id, {"type": "error", "data": {"error": str(e)}})
        finally:
            mark_done(task_id)

    asyncio.create_task(_run())
    return RenderTaskResponse(
        task_id=task_id, total_items=len(req.plan), status="running"
    )


@router.get("/{project_id}/edit/render/stream")
async def stream_render(project_id: str):
    task_id = _render_tasks.get(project_id)
    if not task_id:
        raise HTTPException(status_code=404, detail="没有正在进行的剪辑任务")
    return EventSourceResponse(sse_event_generator(task_id))


@router.get("/{project_id}/edit/output", response_model=OutputResponse)
async def get_output(project_id: str):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return OutputResponse(
        project_id=project_id,
        output_dir=project.get("output_dir") or _output_root(project),
        plan_path=project.get("plan_path"),
        readme_path=project.get("readme_path"),
        clips=project.get("clips", []),
    )
