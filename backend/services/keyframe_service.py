"""Extract keyframes (scene-change frames) from downloaded videos."""
from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import AsyncGenerator

import cv2
from scenedetect import ContentDetector, SceneManager, open_video

logger = logging.getLogger(__name__)

MAX_FRAMES_PER_VIDEO = 8
FALLBACK_SAMPLE_COUNT = 6
DEFAULT_THRESHOLD = 27.0


def _detect_scenes_sync(video_path: str, threshold: float) -> list[tuple[float, float]]:
    """Return scene ranges (start_sec, end_sec) via PySceneDetect."""
    video = open_video(video_path)
    sm = SceneManager()
    sm.add_detector(ContentDetector(threshold=threshold))
    sm.detect_scenes(video)
    scenes = sm.get_scene_list()
    return [(s[0].get_seconds(), s[1].get_seconds()) for s in scenes]


def _extract_frames_sync(
    video_path: str,
    out_dir: str,
    threshold: float = DEFAULT_THRESHOLD,
    max_frames: int = MAX_FRAMES_PER_VIDEO,
) -> list[dict]:
    os.makedirs(out_dir, exist_ok=True)

    try:
        scenes = _detect_scenes_sync(video_path, threshold)
    except Exception as e:
        logger.warning("PySceneDetect failed for %s: %s", video_path, e)
        scenes = []

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"无法打开视频: {video_path}")
    try:
        duration_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        duration_sec = duration_frames / fps if fps > 0 else 0.0

        if not scenes and duration_sec > 0:
            step = duration_sec / (FALLBACK_SAMPLE_COUNT + 1)
            scenes = [(step * (i + 1), step * (i + 1) + 0.1) for i in range(FALLBACK_SAMPLE_COUNT)]

        if len(scenes) > max_frames:
            stride = len(scenes) / max_frames
            scenes = [scenes[int(i * stride)] for i in range(max_frames)]

        frames_meta: list[dict] = []
        for i, (s, e) in enumerate(scenes):
            mid_sec = (s + e) / 2.0 if e > s else s
            cap.set(cv2.CAP_PROP_POS_MSEC, mid_sec * 1000.0)
            ok, frame = cap.read()
            if not ok or frame is None:
                continue
            frame_path = os.path.join(out_dir, f"frame_{i:02d}.jpg")
            cv2.imwrite(frame_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            frames_meta.append(
                {
                    "scene_idx": i,
                    "timestamp": round(mid_sec, 3),
                    "scene_start": round(s, 3),
                    "scene_end": round(e, 3),
                    "frame_path": frame_path,
                }
            )
    finally:
        cap.release()

    return frames_meta


async def extract_keyframes(
    downloads: dict[int, dict],
    output_root: str,
    threshold: float = DEFAULT_THRESHOLD,
    max_frames: int = MAX_FRAMES_PER_VIDEO,
) -> AsyncGenerator[dict, None]:
    """For each downloaded video, extract keyframes and yield progress events."""
    total = len(downloads)
    processed = 0
    index: dict[str, list[dict]] = {}

    for mid, info in downloads.items():
        file_path = info.get("file_path")
        title = info.get("title", f"video_{mid}")

        if not file_path or not os.path.exists(file_path):
            processed += 1
            yield {
                "type": "error",
                "data": {
                    "material_id": mid,
                    "title": title,
                    "error": "文件不存在",
                    "processed": processed,
                    "total": total,
                },
            }
            continue

        yield {
            "type": "progress",
            "data": {
                "material_id": mid,
                "title": title,
                "status": "extracting",
                "processed": processed,
                "total": total,
            },
        }

        try:
            out_dir = os.path.join(output_root, "keyframes", str(mid))
            frames = await asyncio.to_thread(
                _extract_frames_sync, file_path, out_dir, threshold, max_frames
            )
            for fm in frames:
                fm["material_id"] = mid
            index[str(mid)] = frames

            processed += 1
            yield {
                "type": "complete",
                "data": {
                    "material_id": mid,
                    "title": title,
                    "frame_count": len(frames),
                    "frames": frames,
                    "processed": processed,
                    "total": total,
                },
            }
        except Exception as e:
            logger.exception("keyframe extraction failed for %s", file_path)
            processed += 1
            yield {
                "type": "error",
                "data": {
                    "material_id": mid,
                    "title": title,
                    "error": str(e),
                    "processed": processed,
                    "total": total,
                },
            }

    yield {
        "type": "all_complete",
        "data": {"total": total, "videos_processed": processed, "index": index},
    }


def probe_video_resolution(video_path: str) -> tuple[int, int] | None:
    """Return (width, height) of a video file, or None if unreadable."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None
    try:
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    finally:
        cap.release()
    if w <= 0 or h <= 0:
        return None
    return (w, h)


def relative_frame_url(frame_path: str, project_path: str) -> str:
    """Return a path relative to project_path (for serving via /edit/frame)."""
    try:
        return str(Path(frame_path).resolve().relative_to(Path(project_path).resolve()))
    except ValueError:
        return frame_path
