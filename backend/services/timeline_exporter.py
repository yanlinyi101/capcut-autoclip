"""Write the intermediate timeline plan (JSON + human-readable markdown)."""
from __future__ import annotations

import json
import os
from datetime import datetime

from backend.services.clipper_service import PRESETS


def _fmt_time(sec: float) -> str:
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = sec - h * 3600 - m * 60
    return f"{h:02d}:{m:02d}:{s:06.3f}"


def write_timeline_plan(
    output_root: str,
    project_name: str,
    canvas: dict,
    clips: list[dict],
) -> dict:
    os.makedirs(output_root, exist_ok=True)

    plan = {
        "project": project_name,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "canvas": canvas,
        "segments": [
            {
                "segment_id": c["segment_id"],
                "start": c["timeline_start"],
                "end": c["timeline_end"],
                "duration": c["duration"],
                "preset": c["preset"],
                "clip_file": c["clip_rel"],
                "transform": c["transform"],
                "source_material_id": c.get("source_material_id"),
            }
            for c in clips
        ],
    }
    json_path = os.path.join(output_root, "timeline_plan.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(plan, f, ensure_ascii=False, indent=2)

    md_path = os.path.join(output_root, "README_import.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(_render_markdown(project_name, canvas, clips))

    return {"plan_path": json_path, "readme_path": md_path, "plan": plan}


def _render_markdown(project_name: str, canvas: dict, clips: list[dict]) -> str:
    w = canvas.get("width") or canvas.get("w")
    h = canvas.get("height") or canvas.get("h")
    lines: list[str] = []
    lines.append(f"# {project_name} — B-Roll 导入说明\n")
    lines.append(
        "以下是自动生成的 B-Roll 片段清单。由于当前版本剪映草稿已加密，"
        "暂时无法自动写入时间轴，请按表格手动拖入。\n"
    )
    lines.append(f"- **画布尺寸**: {w} × {h}\n- **片段数量**: {len(clips)}\n")
    lines.append("## 拖拽步骤\n")
    lines.append(
        "1. 在剪映中打开原工程\n"
        "2. 按下表把 `clip_file` 拖入画中画/B-Roll 轨道\n"
        "3. 将起点对齐到 `开始时间`\n"
        "4. 按 `呈现模式` 列调整位置和缩放（也可直接使用数值）\n"
    )
    lines.append("## 片段列表\n")
    lines.append(
        "| # | 开始 | 结束 | 时长 | 呈现模式 | 剪辑文件 | 位置 (x, y) | 缩放 |"
    )
    lines.append(
        "|---|------|------|------|----------|----------|------------|------|"
    )
    for i, c in enumerate(clips, 1):
        preset_label = PRESETS.get(c["preset"], {}).get("label", c["preset"])
        t = c["transform"]
        lines.append(
            f"| {i} | {_fmt_time(c['timeline_start'])} "
            f"| {_fmt_time(c['timeline_end'])} "
            f"| {c['duration']:.2f}s "
            f"| {preset_label} "
            f"| `{c['clip_rel']}` "
            f"| ({t.get('x', 0):.2f}, {t.get('y', 0):.2f}) "
            f"| {t.get('scale', 1):.2f} |"
        )
    lines.append("")
    lines.append(
        "> 说明：位置坐标以画布中心为 (0,0)，范围 [-1, 1]，y 正方向朝下。"
        "缩放 1.0 表示相对画布宽度等宽。"
    )
    return "\n".join(lines)
