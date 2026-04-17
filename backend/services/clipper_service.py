"""Clip B-Roll segments out of downloaded videos, scaled to the target canvas."""
from __future__ import annotations

import asyncio
import logging
import os
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

PRESETS = {
    "hide_speaker": {
        "label": "隐藏主讲人（B-Roll 全屏）",
        "scale_mode": "cover",
        "out_scale": 1.0,
        "transform": {"x": 0.0, "y": 0.0, "scale": 1.0},
        "render_index": 20,
    },
    "speaker_br": {
        "label": "主讲人置右下（B-Roll 全屏）",
        "scale_mode": "cover",
        "out_scale": 1.0,
        "transform": {"x": 0.0, "y": 0.0, "scale": 1.0},
        "render_index": 20,
    },
    "material_center_bottom": {
        "label": "素材居中偏下（主讲人露头）",
        "scale_mode": "contain",
        "out_scale": 0.62,
        "transform": {"x": 0.0, "y": 0.14, "scale": 0.62},
        "render_index": 20,
    },
}


def preset_defaults(preset: str) -> dict:
    cfg = PRESETS.get(preset, PRESETS["hide_speaker"])
    return {
        "preset": preset,
        "label": cfg["label"],
        "transform": dict(cfg["transform"]),
    }


def _build_vf_filter(
    preset: str,
    src_w: int,
    src_h: int,
    canvas_w: int,
    canvas_h: int,
) -> str:
    """Build an ffmpeg -vf expression that produces a canvas-sized clip.

    For `material_center_bottom` the clip is scaled to `out_scale` of the canvas
    and padded transparently elsewhere; positioning inside the canvas is done
    via the transform metadata (passed to CapCut/JianYing via timeline_plan.json).

    For `hide_speaker` and `speaker_br` the output is a full-canvas frame.
    """
    cfg = PRESETS.get(preset, PRESETS["hide_speaker"])
    mode = cfg["scale_mode"]
    out_scale = cfg["out_scale"]

    tw = int(canvas_w * out_scale)
    th = int(canvas_h * out_scale)
    # Keep even dimensions for yuv420p
    tw = tw - (tw % 2)
    th = th - (th % 2)

    if mode == "cover":
        # Fill canvas: scale to cover, then center-crop
        return (
            f"scale={tw}:{th}:force_original_aspect_ratio=increase,"
            f"crop={tw}:{th},setsar=1"
        )
    else:
        # Contain: fit inside, pad black
        return (
            f"scale={tw}:{th}:force_original_aspect_ratio=decrease,"
            f"pad={tw}:{th}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
        )


async def clip_segment(
    source_path: str,
    start_sec: float,
    duration_sec: float,
    out_path: str,
    canvas_w: int,
    canvas_h: int,
    preset: str,
    ffmpeg_path: str = "ffmpeg",
    source_offset: float = 0.0,
) -> str:
    """Run ffmpeg to cut + scale a segment. Returns out_path on success."""
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    # Probe source resolution for filter calc (not strictly needed with cover/contain)
    vf = _build_vf_filter(preset, canvas_w, canvas_h, canvas_w, canvas_h)

    seek = max(0.0, float(source_offset))
    cmd = [
        ffmpeg_path,
        "-y",
        "-ss", f"{seek:.3f}",
        "-i", source_path,
        "-t", f"{max(0.1, duration_sec):.3f}",
        "-vf", vf,
        "-an",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        out_path,
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        err = stderr.decode("utf-8", errors="ignore")[-400:]
        raise RuntimeError(f"ffmpeg 剪辑失败: {err}")

    return out_path


async def render_plan(
    plan_items: list[dict],
    downloads: dict[int, dict],
    output_root: str,
    canvas_w: int,
    canvas_h: int,
    ffmpeg_path: str = "ffmpeg",
) -> AsyncGenerator[dict, None]:
    """Render every plan item to a clip mp4 under `output_root/clips/`.

    `plan_items` each has:
      segment_id, start, end, material_id, source_offset, preset, transform
    """
    clips_dir = os.path.join(output_root, "clips")
    total = len(plan_items)
    done = 0
    results: list[dict] = []

    for item in plan_items:
        seg_id = item["segment_id"]
        mid = item["material_id"]
        source = downloads.get(mid) or downloads.get(str(mid)) or {}
        src_path = source.get("file_path")

        yield {
            "type": "progress",
            "data": {
                "segment_id": seg_id,
                "status": "rendering",
                "processed": done,
                "total": total,
            },
        }

        if not src_path or not os.path.exists(src_path):
            done += 1
            yield {
                "type": "error",
                "data": {
                    "segment_id": seg_id,
                    "error": "源文件不存在",
                    "processed": done,
                    "total": total,
                },
            }
            continue

        duration = max(0.1, float(item["end"]) - float(item["start"]))
        offset = float(item.get("source_offset", 0.0))
        preset = item.get("preset", "hide_speaker")
        out_name = f"clip_{seg_id}_{preset}.mp4"
        out_path = os.path.join(clips_dir, out_name)

        try:
            await clip_segment(
                src_path,
                item["start"],
                duration,
                out_path,
                canvas_w,
                canvas_h,
                preset,
                ffmpeg_path=ffmpeg_path,
                source_offset=offset,
            )
            done += 1
            rec = {
                "segment_id": seg_id,
                "clip_path": out_path,
                "clip_rel": os.path.relpath(out_path, output_root),
                "duration": round(duration, 3),
                "preset": preset,
                "transform": item.get("transform", PRESETS[preset]["transform"]),
                "timeline_start": item["start"],
                "timeline_end": item["end"],
                "source_material_id": mid,
            }
            results.append(rec)
            yield {
                "type": "complete",
                "data": {
                    **rec,
                    "processed": done,
                    "total": total,
                },
            }
        except Exception as e:
            logger.exception("clip failed for %s", seg_id)
            done += 1
            yield {
                "type": "error",
                "data": {
                    "segment_id": seg_id,
                    "error": str(e),
                    "processed": done,
                    "total": total,
                },
            }

    yield {
        "type": "all_complete",
        "data": {"total": total, "succeeded": len(results), "clips": results},
    }
