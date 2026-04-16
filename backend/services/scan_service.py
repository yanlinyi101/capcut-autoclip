import json
import os
from datetime import datetime
from pathlib import Path

from backend.services.asr_service import VIDEO_EXTS


def scan_jianying_drafts(draft_root: str) -> list[dict]:
    """Scan JianYing draft directory and return project metadata with covers."""
    meta_file = os.path.join(draft_root, "root_meta_info.json")

    if not os.path.exists(meta_file):
        return []

    with open(meta_file, "r", encoding="utf-8") as f:
        meta = json.load(f)

    drafts = []
    for entry in meta.get("all_draft_store", []):
        fold_path = entry.get("draft_fold_path", "")
        if not fold_path or not os.path.isdir(fold_path):
            continue

        # Check for cover image
        cover_path = entry.get("draft_cover", "")
        has_cover = os.path.exists(cover_path) if cover_path else False

        # Check for SRT subtitle files
        has_srt = False
        srt_has_content = False
        for f in os.listdir(fold_path):
            if f.lower().endswith(".srt"):
                has_srt = True
                srt_file = os.path.join(fold_path, f)
                try:
                    if os.path.getsize(srt_file) > 10:
                        srt_has_content = True
                except OSError:
                    pass
                break

        # Check for video files (can be used for ASR generation)
        has_video = False
        for f in os.listdir(fold_path):
            if Path(f).suffix.lower() in VIDEO_EXTS:
                has_video = True
                break

        # Parse timestamps (microseconds -> datetime)
        created_ts = entry.get("tm_draft_create", 0)
        modified_ts = entry.get("tm_draft_modified", 0)
        duration_us = entry.get("tm_duration", 0)

        created_at = datetime.fromtimestamp(created_ts / 1_000_000) if created_ts else None
        modified_at = datetime.fromtimestamp(modified_ts / 1_000_000) if modified_ts else None

        # Duration in seconds
        duration_sec = duration_us / 1_000_000 if duration_us else 0

        drafts.append({
            "draft_id": entry.get("draft_id", ""),
            "draft_name": entry.get("draft_name", os.path.basename(fold_path)),
            "draft_path": fold_path,
            "cover_path": cover_path if has_cover else "",
            "has_cover": has_cover,
            "has_srt": has_srt,
            "srt_has_content": srt_has_content,
            "has_video": has_video,
            "duration_seconds": round(duration_sec, 1),
            "materials_size": entry.get("draft_timeline_materials_size", 0),
            "created_at": created_at.isoformat() if created_at else None,
            "modified_at": modified_at.isoformat() if modified_at else None,
            "is_ai_shorts": entry.get("draft_is_ai_shorts", False),
        })

    # Sort by modified time descending
    drafts.sort(key=lambda d: d.get("modified_at", "") or "", reverse=True)
    return drafts
