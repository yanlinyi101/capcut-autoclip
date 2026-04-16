import subprocess
import time
import os
import asyncio
from typing import AsyncGenerator
from duckduckgo_search import DDGS
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
            "--print", "%(title)s|%(webpage_url)s|%(duration_string)s",
            "--no-playlist",
            "--no-warnings",
            "--ignore-errors",
        ]

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
                if len(parts) >= 3:
                    title = parts[0]
                    url = parts[1]
                    duration = parts[2]

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


def _search_douyin_sync(query: str, limit: int = 3) -> list[dict]:
    """Search Douyin via DuckDuckGo (blocking)."""
    results = []
    try:
        ddg_query = f'site:douyin.com/video "{query}"'
        with DDGS() as ddgs:
            search_results = list(ddgs.text(ddg_query, max_results=10))
            count = 0
            for res in search_results:
                if count >= limit:
                    break
                title = res.get("title", "")
                url = res.get("href", "")
                keywords = query.split()
                main_keyword = keywords[0] if keywords else ""

                if main_keyword and main_keyword in title:
                    results.append(
                        {"platform": "Douyin", "title": title, "url": url}
                    )
                    count += 1
            time.sleep(1)
    except Exception:
        pass
    return results


async def search_materials(
    keywords_data: list[dict],
    max_rows: int = 10,
    results_per_platform: int = 3,
) -> AsyncGenerator[dict, None]:
    """Async generator that yields search progress and result events."""
    target_rows = keywords_data[:max_rows]
    global_id = 1

    for i, row in enumerate(target_rows):
        kw_list = row.get("keywords", [])
        kw_str = ", ".join(kw_list) if isinstance(kw_list, list) else str(kw_list)
        search_query = clean_keywords(kw_str)

        if not search_query:
            continue

        # Progress: starting this keyword
        yield {
            "type": "progress",
            "data": {
                "row_index": i,
                "total_rows": len(target_rows),
                "keyword": search_query,
                "platform": "douyin",
                "status": "searching",
            },
        }

        # Search Douyin
        dy_results = await asyncio.to_thread(
            _search_douyin_sync, search_query, results_per_platform
        )
        dy_items = [
            {"id": None, "title": r["title"], "url": r["url"], "duration": None, "platform": "Douyin"}
            for r in dy_results
        ]

        yield {
            "type": "progress",
            "data": {
                "row_index": i,
                "total_rows": len(target_rows),
                "keyword": search_query,
                "platform": "youtube",
                "status": "searching",
            },
        }

        # Search YouTube
        yt_results = await asyncio.to_thread(
            _search_youtube_sync, search_query, results_per_platform
        )
        yt_items = []
        for r in yt_results:
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

        yield {
            "type": "result",
            "data": {
                "keyword": search_query,
                "row_index": i,
                "start_time": row.get("start_time", ""),
                "original_text": row.get("text", ""),
                "youtube_results": yt_items,
                "douyin_results": dy_items,
            },
        }

    yield {
        "type": "complete",
        "data": {
            "total_materials": global_id - 1,
            "message": "搜索完成",
        },
    }
