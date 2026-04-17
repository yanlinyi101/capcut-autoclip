import asyncio
import json
import os
import time
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from backend.schemas.extract import ExtractResponse
from backend.services.init_service import get_project, update_project
from backend.services.extract_service import extract_from_srt
from backend.services.asr_service import generate_srt
from backend.core.config import settings
from backend.tasks.background import create_task, push_event, mark_done

router = APIRouter(prefix="/projects", tags=["extract"])


_extract_tasks: dict[str, str] = {}


@router.post("/{project_id}/extract", response_model=ExtractResponse)
async def extract_keywords(project_id: str):
    """Synchronous extract (no progress). Kept for backward compat."""
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    srt_path = project.get("srt_path", "")
    if not srt_path:
        raise HTTPException(status_code=400, detail="未找到 SRT 字幕文件，请先生成字幕")

    try:
        keywords = await asyncio.to_thread(extract_from_srt, srt_path)
        selected = [k["index"] for k in keywords if k.get("needs_broll")]
        update_project(
            project_id,
            {
                "keywords": keywords,
                "selected_row_indices": selected,
                "current_step": 2,
            },
        )
        return ExtractResponse(
            project_id=project_id,
            total_rows=len(keywords),
            keywords=keywords,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"提取失败: {e}")


@router.post("/{project_id}/extract/start")
async def start_extract(project_id: str):
    """Kick off an async extract pipeline that emits SSE progress."""
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    srt_path = project.get("srt_path", "")
    if not srt_path:
        raise HTTPException(status_code=400, detail="未找到 SRT 字幕文件，请先生成字幕")

    task_id = create_task()
    _extract_tasks[project_id] = task_id

    async def _run():
        try:
            from backend.services.extract_service import extract_keywords as extract_kw_fn
            from backend.services.llm_service import analyze_broll_need
            import pysrt

            push_event(task_id, {"type": "progress", "data": {"stage": "parsing", "message": "解析 SRT 字幕..."}})

            def _parse_and_jieba() -> list[dict]:
                subs = pysrt.open(srt_path, encoding="utf-8")
                rows: list[dict] = []
                idx = 0
                for sub in subs:
                    text = sub.text.strip().replace("\n", " ")
                    if not text:
                        continue
                    kws = extract_kw_fn(text)
                    if kws:
                        rows.append({
                            "index": idx,
                            "start_time": str(sub.start).split(",")[0],
                            "end_time": str(sub.end).split(",")[0],
                            "text": text,
                            "keywords": kws,
                            "needs_broll": False,
                            "broll_reason": "",
                        })
                        idx += 1
                return rows

            rows = await asyncio.to_thread(_parse_and_jieba)
            total = len(rows)

            push_event(task_id, {
                "type": "progress",
                "data": {"stage": "jieba_done", "message": f"已从字幕中提取 {total} 行关键词", "total": total, "done": 0, "percent": 10}
            })

            if total == 0:
                update_project(project_id, {"keywords": [], "selected_row_indices": [], "current_step": 2})
                push_event(task_id, {"type": "complete", "data": {"stage": "complete", "total": 0, "percent": 100, "message": "字幕中无可提取关键词"}})
                return

            loop = asyncio.get_running_loop()

            def _on_progress(done: int, tot: int, stage: str):
                pct = 10 + int(80 * done / max(tot, 1))
                loop.call_soon_threadsafe(
                    push_event,
                    task_id,
                    {"type": "progress", "data": {"stage": "llm", "done": done, "total": tot, "percent": pct, "message": f"AI 分析 B-Roll 需求 {done}/{tot}..." if stage == "llm" else f"使用规则判定 {done}/{tot}"}},
                )

            annotations = await asyncio.to_thread(
                analyze_broll_need, rows, 40, 20, _on_progress
            )

            by_index = {a["index"]: a for a in annotations}
            for row in rows:
                ann = by_index.get(row["index"])
                if ann:
                    row["needs_broll"] = bool(ann.get("needs_broll", False))
                    row["broll_reason"] = str(ann.get("reason", ""))

            selected = [r["index"] for r in rows if r.get("needs_broll")]
            update_project(project_id, {
                "keywords": rows,
                "selected_row_indices": selected,
                "current_step": 2,
            })

            push_event(task_id, {
                "type": "complete",
                "data": {
                    "stage": "complete",
                    "total": total,
                    "selected": len(selected),
                    "percent": 100,
                    "message": f"完成！共 {total} 行，AI 推荐 {len(selected)} 行搜索素材",
                    "keywords": rows,
                },
            })
        except Exception as e:
            push_event(task_id, {"type": "error", "data": {"stage": "failed", "error": str(e)}})
        finally:
            mark_done(task_id)

    asyncio.create_task(_run())
    return {"task_id": task_id, "status": "started", "message": "提取任务已启动"}


@router.get("/{project_id}/extract/stream")
async def stream_extract(project_id: str, task_id: str | None = None):
    from backend.core.sse_manager import sse_event_generator
    tid = task_id or _extract_tasks.get(project_id)
    if not tid:
        raise HTTPException(status_code=404, detail="无提取任务")
    return EventSourceResponse(sse_event_generator(tid))


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


class PatchKeywordRequest(BaseModel):
    keywords: Optional[list[str]] = None
    selected: Optional[bool] = None


@router.patch("/{project_id}/keywords/{row_index}")
async def patch_keyword_row(project_id: str, row_index: int, req: PatchKeywordRequest):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    rows = project.get("keywords", [])
    target = next((r for r in rows if r.get("index") == row_index), None)
    if target is None:
        raise HTTPException(status_code=404, detail=f"行 {row_index} 不存在")

    if req.keywords is not None:
        target["keywords"] = list(req.keywords)

    selected: list[int] = list(project.get("selected_row_indices", []))
    if req.selected is not None:
        sset = set(selected)
        if req.selected:
            sset.add(row_index)
        else:
            sset.discard(row_index)
        selected = sorted(sset)

    update_project(project_id, {"keywords": rows, "selected_row_indices": selected})
    return {"row_index": row_index, "keywords": target["keywords"], "selected_row_indices": selected}


class BulkSelectRequest(BaseModel):
    mode: str  # "all" | "none" | "ai_recommended"


@router.post("/{project_id}/keywords/bulk-select")
async def bulk_select_keywords(project_id: str, req: BulkSelectRequest):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    rows = project.get("keywords", [])
    if req.mode == "all":
        selected = [r["index"] for r in rows]
    elif req.mode == "none":
        selected = []
    elif req.mode == "ai_recommended":
        selected = [r["index"] for r in rows if r.get("needs_broll")]
    else:
        raise HTTPException(status_code=400, detail=f"未知 mode: {req.mode}")

    update_project(project_id, {"selected_row_indices": selected})
    return {"selected_row_indices": selected, "count": len(selected)}


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


VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".avi", ".flv", ".wmv", ".m4v"}
UPLOAD_CHUNK = 1024 * 1024  # 1MB


@router.post("/{project_id}/upload-exported-video")
async def upload_exported_video(project_id: str, file: UploadFile = File(...)):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    suffix = Path(file.filename or "").suffix.lower()
    if suffix and suffix not in VIDEO_EXTS:
        raise HTTPException(status_code=400, detail=f"不支持的视频格式: {suffix}")
    if not suffix:
        suffix = ".mp4"

    input_dir = Path(project["project_path"]) / "autoclip_input"
    input_dir.mkdir(parents=True, exist_ok=True)
    ts = int(time.time())
    saved_path = input_dir / f"exported_{ts}{suffix}"

    total = 0
    try:
        with open(saved_path, "wb") as f:
            while True:
                chunk = await file.read(UPLOAD_CHUNK)
                if not chunk:
                    break
                f.write(chunk)
                total += len(chunk)
    except Exception as e:
        if saved_path.exists():
            saved_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"保存文件失败: {e}")
    finally:
        await file.close()

    update_project(project_id, {"video_path": str(saved_path), "has_video": True})

    return {
        "video_path": str(saved_path),
        "size_bytes": total,
        "filename": file.filename or saved_path.name,
    }


@router.get("/{project_id}/recent-exports")
async def recent_exports(project_id: str, days: int = 7, limit: int = 10):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    home = Path.home()
    scan_dirs = [home / "Desktop", home / "Downloads", home / "Movies"]
    cutoff = time.time() - days * 86400

    items = []
    for d in scan_dirs:
        if not d.is_dir():
            continue
        try:
            for p in d.iterdir():
                if not p.is_file():
                    continue
                if p.suffix.lower() not in VIDEO_EXTS:
                    continue
                try:
                    st = p.stat()
                except OSError:
                    continue
                if st.st_mtime < cutoff:
                    continue
                items.append({
                    "path": str(p),
                    "name": p.name,
                    "size_bytes": st.st_size,
                    "mtime": st.st_mtime,
                    "source_dir": d.name,
                })
        except PermissionError:
            continue

    items.sort(key=lambda x: x["mtime"], reverse=True)
    return {"items": items[:limit]}


@router.post("/{project_id}/upload-srt")
async def upload_srt(project_id: str, file: UploadFile = File(...)):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    suffix = Path(file.filename or "").suffix.lower()
    if suffix and suffix != ".srt":
        raise HTTPException(status_code=400, detail="只支持 .srt 格式")

    input_dir = Path(project["project_path"]) / "autoclip_input"
    input_dir.mkdir(parents=True, exist_ok=True)
    ts = int(time.time())
    saved_path = input_dir / f"imported_{ts}.srt"

    try:
        content = await file.read()
        saved_path.write_bytes(content)
    except Exception as e:
        if saved_path.exists():
            saved_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"保存 SRT 失败: {e}")
    finally:
        await file.close()

    update_project(project_id, {"srt_path": str(saved_path), "has_srt": True})
    return {"srt_path": str(saved_path), "size_bytes": len(content), "filename": file.filename or saved_path.name}


@router.post("/{project_id}/use-srt-path")
async def use_srt_path(project_id: str, srt_path: str):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    p = Path(srt_path)
    if not p.exists() or p.suffix.lower() != ".srt":
        raise HTTPException(status_code=400, detail="SRT 文件不存在或格式不对")

    update_project(project_id, {"srt_path": str(p), "has_srt": True})
    return {"srt_path": str(p)}


@router.get("/{project_id}/recent-srt")
async def recent_srt(project_id: str, days: int = 30, limit: int = 10):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    home = Path.home()
    scan_dirs = [home / "Desktop", home / "Downloads", home / "Movies", home / "Documents"]
    cutoff = time.time() - days * 86400

    items = []
    for d in scan_dirs:
        if not d.is_dir():
            continue
        try:
            for p in d.iterdir():
                if not p.is_file() or p.suffix.lower() != ".srt":
                    continue
                try:
                    st = p.stat()
                except OSError:
                    continue
                if st.st_mtime < cutoff:
                    continue
                items.append({
                    "path": str(p),
                    "name": p.name,
                    "size_bytes": st.st_size,
                    "mtime": st.st_mtime,
                    "source_dir": d.name,
                })
        except PermissionError:
            continue

    items.sort(key=lambda x: x["mtime"], reverse=True)
    return {"items": items[:limit]}
