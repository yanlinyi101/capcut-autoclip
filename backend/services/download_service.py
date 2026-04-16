import asyncio
import os
import re
from typing import AsyncGenerator
from backend.core.config import settings


async def download_materials(
    material_index: dict[int, dict],
    material_ids: list[int],
    download_dir: str,
) -> AsyncGenerator[dict, None]:
    """Async generator yielding download progress events for each material."""
    os.makedirs(download_dir, exist_ok=True)
    completed = 0
    failed = 0

    for mid in material_ids:
        info = material_index.get(mid)
        if not info:
            failed += 1
            yield {
                "type": "error",
                "data": {
                    "material_id": mid,
                    "title": f"ID {mid}",
                    "status": "failed",
                    "error": "素材不存在",
                },
            }
            continue

        url = info["url"]
        title = info.get("title", f"video_{mid}")

        yield {
            "type": "progress",
            "data": {
                "material_id": mid,
                "title": title,
                "status": "downloading",
                "percent": 0,
            },
        }

        output_tmpl = os.path.join(download_dir, f"{mid}_%(title)s.%(ext)s")
        cmd = [
            settings.yt_dlp_path,
            url,
            "-o", output_tmpl,
            "--format", settings.download_format,
            "--merge-output-format", "mp4",
            "--no-playlist",
            "--newline",
        ]

        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )

            last_percent = 0
            while True:
                line = await proc.stderr.readline()
                if not line:
                    break
                text = line.decode("utf-8", errors="ignore").strip()
                # Parse yt-dlp progress: [download]  45.2% of ~100MiB ...
                match = re.search(r"\[download\]\s+([\d.]+)%", text)
                if match:
                    percent = float(match.group(1))
                    # Only yield if changed significantly
                    if percent - last_percent >= 5 or percent >= 100:
                        last_percent = percent
                        yield {
                            "type": "progress",
                            "data": {
                                "material_id": mid,
                                "title": title,
                                "status": "downloading",
                                "percent": round(percent, 1),
                            },
                        }

            await proc.wait()

            if proc.returncode == 0:
                # Find the downloaded file
                file_path = None
                file_size = None
                for f in os.listdir(download_dir):
                    if f.startswith(f"{mid}_"):
                        fp = os.path.join(download_dir, f)
                        file_path = fp
                        size_bytes = os.path.getsize(fp)
                        if size_bytes > 1024 * 1024:
                            file_size = f"{size_bytes / (1024*1024):.1f}MB"
                        else:
                            file_size = f"{size_bytes / 1024:.0f}KB"
                        break

                completed += 1
                yield {
                    "type": "complete",
                    "data": {
                        "material_id": mid,
                        "title": title,
                        "status": "completed",
                        "percent": 100,
                        "file_path": file_path,
                        "file_size": file_size,
                    },
                }
            else:
                stderr_output = await proc.stderr.read()
                error_text = stderr_output.decode("utf-8", errors="ignore")[:200] if stderr_output else "下载失败"
                failed += 1
                yield {
                    "type": "error",
                    "data": {
                        "material_id": mid,
                        "title": title,
                        "status": "failed",
                        "error": error_text,
                    },
                }
        except Exception as e:
            failed += 1
            yield {
                "type": "error",
                "data": {
                    "material_id": mid,
                    "title": title,
                    "status": "failed",
                    "error": str(e),
                },
            }

    yield {
        "type": "all_complete",
        "data": {
            "completed": completed,
            "failed": failed,
            "total": len(material_ids),
        },
    }
