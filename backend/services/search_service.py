import subprocess
import os
import asyncio
from typing import AsyncGenerator
from backend.core.config import settings


def clean_keywords(keyword_str: str) -> str:
    """Extract top 2 bare keywords from POS-tagged string like '北京(ns), 故事(n)'."""
    if not keyword_str:
        return ""
    clean_kws = []
    parts = keyword_str.split(",")
    for p in parts:
        p = p.strip()
        if "(" in p:
            word = p.split("(")[0]
            clean_kws.append(word)
        else:
            clean_kws.append(p)
    return " ".join(clean_kws[:2])


def _search_youtube_sync(query: str, limit: int = 3) -> list[dict]:
    """Search YouTube using yt-dlp subprocess (blocking)."""
    modifiers = "航拍 OR 纪录片 OR 4K OR 实拍 OR 影像"
    negatives = "-讲解 -解说 -分析 -反应 -talking -vlog"
    enhanced_query = f"{query} {modifiers} {negatives}"

    results = []
    try:
        cmd = [
            settings.yt_dlp_path,
            f"ytsearch{limit * 2}:{enhanced_query}",
            "--print", "%(id)s|%(title)s|%(webpage_url)s|%(duration_string)s",
            "--no-playlist",
            "--no-warnings",
            "--ignore-errors",
            "--socket-timeout", "30",
        ]
        if settings.proxy_url:
            cmd += ["--proxy", settings.proxy_url]

        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            env=env,
            timeout=60,
        )

        if result.returncode == 0 and result.stdout:
            lines = result.stdout.strip().split("\n")
            for line in lines:
                parts = line.split("|")
                if len(parts) >= 4:
                    _vid_id = parts[0]
                    title = parts[1]
                    url = parts[2]
                    duration = parts[3]

                    title_lower = title.lower()
                    if any(
                        x in title_lower
                        for x in ["讲解", "解说", "分析", "reaction", "review"]
                    ):
                        continue

                    results.append(
                        {
                            "platform": "YouTube",
                            "title": title,
                            "url": url,
                            "duration": duration,
                        }
                    )
                    if len(results) >= limit:
                        break
    except Exception:
        pass
    return results


_BILI_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _search_bilibili_sync(query: str, limit: int = 3) -> list[dict]:
    """Search Bilibili using yt-dlp's bilisearch prefix (bare keywords, no modifiers)."""
    results = []
    try:
        cmd = [
            settings.yt_dlp_path,
            f"bilisearch{limit}:{query}",
            "--print", "%(id)s|%(title)s|%(webpage_url)s|%(duration_string)s|%(uploader)s",
            "--no-warnings",
            "--ignore-errors",
            "--socket-timeout", "30",
            "--user-agent", _BILI_UA,
            "--add-header", "Referer:https://www.bilibili.com/",
            "--add-header", "Origin:https://www.bilibili.com",
        ]
        if settings.proxy_url:
            cmd += ["--proxy", settings.proxy_url]

        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            env=env,
            timeout=60,
        )

        # yt-dlp may exit non-zero if some items fail (e.g. bilibili "cheese"
        # paid courses) but still print valid results; rely on stdout.
        if result.stdout:
            seen_urls = set()
            lines = result.stdout.strip().split("\n")
            for line in lines:
                parts = line.split("|")
                if len(parts) >= 3:
                    title = parts[1]
                    url = parts[2]
                    duration = parts[3] if len(parts) > 3 else None
                    if not url or url == "NA":
                        continue
                    # Dedupe multipart (p01/p02/...) — keep only first page
                    base = url.split("?p=")[0]
                    if base in seen_urls:
                        continue
                    seen_urls.add(base)
                    results.append(
                        {
                            "platform": "Bilibili",
                            "title": title,
                            "url": url,
                            "duration": duration if duration and duration != "NA" else None,
                        }
                    )
                    if len(results) >= limit:
                        break
    except Exception:
        pass
    return results


async def search_materials(
    keywords_data: list[dict],
    max_rows: int | None = None,
    results_per_platform: int = 3,
    platforms: list[str] | None = None,
) -> AsyncGenerator[dict, None]:
    """Async generator that yields search progress and result events.

    Processes every row in `keywords_data` (user controls scope via the
    row-selection UI on the Extract page). `max_rows` is accepted for
    backward compatibility but ignored.
    """
    if platforms is None:
        platforms = ["youtube", "bilibili"]
    platforms = [p.lower() for p in platforms]
    want_yt = "youtube" in platforms
    want_bili = "bilibili" in platforms

    total_rows = len(keywords_data)
    global_id = 1
    query_cache: dict[str, tuple[list[dict], list[dict]]] = {}

    for i, row in enumerate(keywords_data):
        kw_list = row.get("keywords", [])
        kw_str = ", ".join(kw_list) if isinstance(kw_list, list) else str(kw_list)
        search_query = clean_keywords(kw_str)

        if not search_query:
            continue

        cached = search_query in query_cache

        yt_raw: list[dict] = []
        bili_raw: list[dict] = []

        if cached:
            yt_raw, bili_raw = query_cache[search_query]
        else:
            if want_yt:
                yield {
                    "type": "progress",
                    "data": {
                        "row_index": i,
                        "total_rows": total_rows,
                        "keyword": search_query,
                        "platform": "youtube",
                        "status": "searching",
                    },
                }
                yt_raw = await asyncio.to_thread(
                    _search_youtube_sync, search_query, results_per_platform
                )

            if want_bili:
                yield {
                    "type": "progress",
                    "data": {
                        "row_index": i,
                        "total_rows": total_rows,
                        "keyword": search_query,
                        "platform": "bilibili",
                        "status": "searching",
                    },
                }
                bili_raw = await asyncio.to_thread(
                    _search_bilibili_sync, search_query, results_per_platform
                )

            query_cache[search_query] = (yt_raw, bili_raw)

        yt_items = []
        for r in yt_raw:
            yt_items.append(
                {
                    "id": global_id,
                    "title": r["title"],
                    "url": r["url"],
                    "duration": r.get("duration"),
                    "platform": "YouTube",
                }
            )
            global_id += 1

        bili_items = []
        for r in bili_raw:
            bili_items.append(
                {
                    "id": global_id,
                    "title": r["title"],
                    "url": r["url"],
                    "duration": r.get("duration"),
                    "platform": "Bilibili",
                }
            )
            global_id += 1

        yield {
            "type": "result",
            "data": {
                "keyword": search_query,
                "row_index": i,
                "start_time": row.get("start_time", ""),
                "original_text": row.get("text", ""),
                "youtube_results": yt_items,
                "bilibili_results": bili_items,
            },
        }

    yield {
        "type": "complete",
        "data": {
            "total_materials": global_id - 1,
            "message": "搜索完成",
        },
    }
