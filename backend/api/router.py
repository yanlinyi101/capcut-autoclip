from fastapi import APIRouter
from backend.api.projects import router as projects_router
from backend.api.extract import router as extract_router
from backend.api.search import router as search_router
from backend.api.download import router as download_router
from backend.api.drafts import router as drafts_router
from backend.api.settings import router as settings_router

api_router = APIRouter()

api_router.include_router(projects_router)
api_router.include_router(extract_router)
api_router.include_router(search_router)
api_router.include_router(download_router)
api_router.include_router(drafts_router)
api_router.include_router(settings_router)
