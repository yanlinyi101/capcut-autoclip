from fastapi import APIRouter, HTTPException
from backend.schemas.project import ProjectInitRequest, ProjectResponse
from backend.services.init_service import init_project, get_project

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("/init", response_model=ProjectResponse)
async def create_project(req: ProjectInitRequest):
    try:
        project = init_project(req.project_path)
        return ProjectResponse(**project)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project_status(project_id: str):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return ProjectResponse(**project)
