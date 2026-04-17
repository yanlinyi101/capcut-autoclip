"""DeepSeek LLM-based B-Roll need annotator with rule-based fallback."""
from __future__ import annotations

import json
import logging
from typing import Iterable

from backend.core.config import settings
from backend.services.broll_detector import rule_based_broll_need

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是视频剪辑助手。我会给你一段演讲/纪录片的字幕片段清单，每段带 index、文本和前后上下文。
请判断每段是否需要在剪映中插入外部 B-Roll 素材（地点画面、人物照片、事件镜头、物品特写等），以加深观众理解。

**需要 B-Roll** 的典型情况：提到具体地点/人物/历史事件/物品/动作场景，观众需要"看到"这个实体。
**不需要 B-Roll** 的典型情况：抽象讨论、自我介绍/过渡句（"我今天说说"）、情感抒发、纯观点陈述、疑问/反问。

只返回 JSON 数组，每项形如 {"index": int, "needs_broll": bool, "reason": "简短中文理由（<20字）"}。不要额外解释，不要 markdown 代码块。"""


def _fallback_all(rows: list[dict]) -> list[dict]:
    out = []
    for row in rows:
        need, reason = rule_based_broll_need(row)
        out.append({"index": row.get("index"), "needs_broll": need, "reason": reason})
    return out


def _build_user_prompt(rows: list[dict], context_chars: int) -> str:
    lines = []
    texts = [r.get("text", "") for r in rows]
    for i, row in enumerate(rows):
        prev_text = texts[i - 1] if i > 0 else ""
        next_text = texts[i + 1] if i + 1 < len(rows) else ""
        prev_ctx = prev_text[-context_chars:] if prev_text else "—"
        next_ctx = next_text[:context_chars] if next_text else "—"
        idx = row.get("index", i)
        lines.append(f"[{idx}] (前: {prev_ctx}) {row.get('text','')} (后: {next_ctx})")
    return "\n".join(lines)


def _strip_code_fence(s: str) -> str:
    s = s.strip()
    if s.startswith("```"):
        s = s.split("\n", 1)[-1] if "\n" in s else s
        if s.endswith("```"):
            s = s.rsplit("```", 1)[0]
    return s.strip()


def _call_deepseek_batch(client, rows_batch: list[dict], context_chars: int) -> list[dict]:
    """Single-batch DeepSeek call. Raises on any failure. Returns list of annotation dicts."""
    user_prompt = _build_user_prompt(rows_batch, context_chars)
    resp = client.chat.completions.create(
        model=settings.deepseek_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
    )
    raw = _strip_code_fence(resp.choices[0].message.content or "")
    parsed = json.loads(raw)

    if isinstance(parsed, dict):
        for key in ("results", "items", "data", "list"):
            if key in parsed and isinstance(parsed[key], list):
                parsed = parsed[key]
                break
        else:
            lists = [v for v in parsed.values() if isinstance(v, list)]
            if lists:
                parsed = lists[0]
            else:
                raise ValueError("No list found in LLM response object")

    if not isinstance(parsed, list):
        raise ValueError(f"LLM response is not a list: {type(parsed)}")

    by_index = {}
    for item in parsed:
        if not isinstance(item, dict):
            continue
        idx = item.get("index")
        if idx is None:
            continue
        by_index[int(idx)] = {
            "needs_broll": bool(item.get("needs_broll", False)),
            "reason": str(item.get("reason", ""))[:40] or "AI 判定",
        }

    out = []
    for row in rows_batch:
        idx = row.get("index")
        if idx in by_index:
            entry = by_index[idx]
            out.append({"index": idx, "needs_broll": entry["needs_broll"], "reason": entry["reason"]})
        else:
            need, reason = rule_based_broll_need(row)
            out.append({"index": idx, "needs_broll": need, "reason": reason})
    return out


def analyze_broll_need(
    rows: list[dict],
    context_chars: int = 40,
    batch_size: int = 20,
    on_progress=None,
) -> list[dict]:
    """Annotate each row with needs_broll + reason, chunked for progress reporting.

    on_progress(done, total, stage) is called after each batch (or once for fallback).
    Falls back to rule-based on any failure.
    """
    if not rows:
        return []

    total = len(rows)

    if not settings.llm_enabled or not settings.deepseek_api_key:
        logger.info("LLM disabled or no API key, using rule-based fallback")
        if on_progress:
            on_progress(total, total, "rule_based")
        return _fallback_all(rows)

    try:
        from openai import OpenAI
    except ImportError:
        logger.warning("openai SDK not installed, fallback")
        if on_progress:
            on_progress(total, total, "rule_based")
        return _fallback_all(rows)

    try:
        client = OpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
            timeout=60.0,
        )
    except Exception as e:
        logger.warning("LLM client init failed: %s", e)
        if on_progress:
            on_progress(total, total, "rule_based")
        return _fallback_all(rows)

    out: list[dict] = []
    done = 0
    for i in range(0, total, batch_size):
        batch = rows[i : i + batch_size]
        try:
            out.extend(_call_deepseek_batch(client, batch, context_chars))
        except Exception as e:
            logger.warning("LLM batch %d-%d failed, using rules: %s", i, i + len(batch), e)
            for row in batch:
                need, reason = rule_based_broll_need(row)
                out.append({"index": row.get("index"), "needs_broll": need, "reason": reason})
        done += len(batch)
        if on_progress:
            on_progress(done, total, "llm")

    return out
