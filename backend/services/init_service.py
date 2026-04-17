import os
import uuid
from datetime import datetime

# In-memory project store
_projects: dict[str, dict] = {}


def init_project(project_path: str) -> dict:
    """Validate a JianYing project directory and create a project record."""
    if not os.path.exists(project_path):
        raise ValueError("路径不存在")

    draft_json = os.path.join(project_path, "draft_content.json")

    has_draft = os.path.exists(draft_json)

    if not has_draft:
        raise ValueError("未找到 draft_content.json，请确认这是剪映草稿目录")

    # Detect SRT files
    from backend.services.asr_service import find_srt_file, find_video_file

    srt_path = find_srt_file(project_path) or ""
    has_srt = bool(srt_path)

    # Detect video files
    video_path = find_video_file(project_path) or ""
    has_video = bool(video_path)

    project_id = str(uuid.uuid4())
    project = {
        "project_id": project_id,
        "project_path": project_path,
        "srt_path": srt_path,
        "video_path": video_path,
        "has_draft_content": has_draft,
        "has_srt": has_srt,
        "has_video": has_video,
        "status": "initialized",
        "current_step": 1,
        "created_at": datetime.now(),
        "keywords": [],
        "selected_row_indices": [],
        "materials": [],
        "material_index": {},
        "downloads": {},
        "broll_segments": [],
        "keyframes": {},
        "edit_plan": [],
        "clips": [],
        "canvas": {"width": 1920, "height": 1080},
    }
    _projects[project_id] = project
    return project


def get_project(project_id: str) -> dict | None:
    return _projects.get(project_id)


def update_project(project_id: str, updates: dict) -> dict | None:
    project = _projects.get(project_id)
    if project:
        project.update(updates)
    return project
