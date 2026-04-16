import asyncio
import os
from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse
from backend.schemas.download import DownloadRequest, DownloadTaskResponse
from backend.services.init_service import get_project, update_project
from backend.services.download_service import download_materials
from backend.tasks.background import create_task, push_event, mark_done
from backend.core.sse_manager import sse_event_generator

router = APIRouter(prefix="/projects", tags=["download"])

_download_tasks: dict[str, str] = {}


@router.post("/{project_id}/download", response_model=DownloadTaskResponse)
async def start_download(project_id: str, req: DownloadRequest):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    material_index = project.get("material_index", {})
    if not material_index:
        raise HTTPException(status_code=400, detail="没有可下载的素材，请先搜索")

    download_dir = os.path.join(
        project.get("project_path", "."), "autoclip_downloads"
    )
    task_id = create_task()
    _download_tasks[project_id] = task_id

    async def run_downloads():
        downloads = {}
        async for event in download_materials(
            material_index, req.material_ids, download_dir
        ):
            push_event(task_id, event)
            mid = event["data"].get("material_id")
            if mid is not None:
                downloads[mid] = event["data"]

        update_project(
            project_id, {"downloads": downloads, "current_step": 4}
        )
        mark_done(task_id)

    asyncio.create_task(run_downloads())

    return DownloadTaskResponse(
        task_id=task_id,
        total_items=len(req.material_ids),
        status="running",
    )


@router.get("/{project_id}/download/stream")
async def download_stream(project_id: str):
    task_id = _download_tasks.get(project_id)
    if not task_id:
        raise HTTPException(status_code=404, detail="没有正在进行的下载任务")
    return EventSourceResponse(sse_event_generator(task_id))


@router.get("/{project_id}/downloads")
async def get_downloads(project_id: str):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return {"downloads": project.get("downloads", {})}
