import asyncio
from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse
from backend.schemas.search import (
    SearchRequest,
    SearchTaskResponse,
    MaterialsResponse,
)
from backend.services.init_service import get_project, update_project
from backend.services.search_service import search_materials
from backend.tasks.background import create_task, push_event, mark_done
from backend.core.sse_manager import sse_event_generator

router = APIRouter(prefix="/projects", tags=["search"])

# project_id -> task_id mapping
_search_tasks: dict[str, str] = {}


@router.post("/{project_id}/search", response_model=SearchTaskResponse)
async def start_search(project_id: str, req: SearchRequest | None = None):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    keywords = project.get("keywords", [])
    if not keywords:
        raise HTTPException(status_code=400, detail="请先提取关键词")

    selected = project.get("selected_row_indices")
    if selected is not None:
        sel_set = set(selected)
        if not sel_set:
            raise HTTPException(status_code=400, detail="请至少勾选一行关键词")
        keywords = [k for k in keywords if k.get("index") in sel_set]
        if not keywords:
            raise HTTPException(status_code=400, detail="勾选的行与关键词不匹配")

    results_per_platform = req.results_per_platform if req else 3
    platforms = req.platforms if req else ["youtube", "bilibili"]
    if not platforms:
        raise HTTPException(status_code=400, detail="请至少选择一个素材平台")

    task_id = create_task()
    _search_tasks[project_id] = task_id

    async def run_search():
        all_materials = []
        material_index = {}
        async for event in search_materials(
            keywords, None, results_per_platform, platforms=platforms
        ):
            push_event(task_id, event)
            if event["type"] == "result":
                all_materials.append(event["data"])
                for yt in event["data"].get("youtube_results", []):
                    if yt.get("id"):
                        material_index[yt["id"]] = {
                            "url": yt["url"],
                            "title": yt["title"],
                        }
                for bili in event["data"].get("bilibili_results", []):
                    if bili.get("id"):
                        material_index[bili["id"]] = {
                            "url": bili["url"],
                            "title": bili["title"],
                        }

        update_project(
            project_id,
            {
                "materials": all_materials,
                "material_index": material_index,
                "current_step": 3,
            },
        )
        mark_done(task_id)

    asyncio.create_task(run_search())

    return SearchTaskResponse(
        task_id=task_id,
        status="running",
        message="搜索任务已启动",
    )


@router.get("/{project_id}/search/stream")
async def search_stream(project_id: str):
    task_id = _search_tasks.get(project_id)
    if not task_id:
        raise HTTPException(status_code=404, detail="没有正在进行的搜索任务")
    return EventSourceResponse(sse_event_generator(task_id))


@router.get("/{project_id}/materials", response_model=MaterialsResponse)
async def get_materials(project_id: str):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    materials = project.get("materials", [])
    total_yt = sum(len(m.get("youtube_results", [])) for m in materials)
    total_bili = sum(len(m.get("bilibili_results", [])) for m in materials)

    return MaterialsResponse(
        materials=materials,
        total_youtube=total_yt,
        total_bilibili=total_bili,
    )
