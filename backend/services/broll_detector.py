"""Detect subtitle segments that are good B-Roll candidates."""
from __future__ import annotations

import re

MIN_DURATION_SEC = 3.0
STRONG_FLAGS = {"ns", "nr", "nt", "nz"}
SELF_REFERENTIAL = ("我", "你", "对吧", "是不是", "咱", "哎")


def _parse_hms(ts: str) -> float:
    parts = ts.split(":")
    if len(parts) != 3:
        return 0.0
    h, m, s = parts
    return int(h) * 3600 + int(m) * 60 + float(s)


_kw_re = re.compile(r"^(.+)\((\w+)\)$")


def _parse_keyword(raw: str) -> tuple[str, str]:
    m = _kw_re.match(raw.strip())
    if m:
        return m.group(1), m.group(2)
    return raw, ""


def rule_based_broll_need(row: dict) -> tuple[bool, str]:
    """Rule-based fallback: does this subtitle row need a B-Roll?

    Returns (needs_broll, reason). Matches broll_detector's own criteria:
    contains a proper-noun keyword AND duration >= 3s.
    """
    start = _parse_hms(row.get("start_time", "0:00:00"))
    end = _parse_hms(row.get("end_time", "0:00:00"))
    duration = max(0.0, end - start)

    parsed = [_parse_keyword(k) for k in row.get("keywords", [])]
    strong = [w for w, flag in parsed if flag in STRONG_FLAGS]

    if strong and duration >= MIN_DURATION_SEC:
        return True, f"含专有名词({','.join(strong[:2])})"
    if strong:
        return True, f"含专有名词({strong[0]})"
    return False, "无专有名词"


def detect_broll_segments(keywords: list[dict]) -> list[dict]:
    """Turn extracted keyword rows into B-Roll candidate segments.

    Each input row has: index, start_time, end_time, text, keywords (list of "词(flag)").
    Returns rows whose subtitle warrants an external B-Roll, annotated with `reason`.
    """
    out: list[dict] = []
    for row in keywords:
        start = _parse_hms(row.get("start_time", "0:00:00"))
        end = _parse_hms(row.get("end_time", "0:00:00"))
        duration = max(0.0, end - start)
        text = row.get("text", "")

        parsed = [_parse_keyword(k) for k in row.get("keywords", [])]
        strong = [w for w, flag in parsed if flag in STRONG_FLAGS]

        has_self_ref = any(marker in text for marker in SELF_REFERENTIAL)

        reasons: list[str] = []
        if strong:
            reasons.append("contains_proper_noun")
        if duration >= MIN_DURATION_SEC:
            reasons.append("sufficient_duration")
        if has_self_ref:
            reasons.append("self_referential")

        is_candidate = bool(strong) and duration >= MIN_DURATION_SEC
        if not is_candidate:
            continue

        confidence = 0.4 + 0.3 * min(len(strong), 2) + min(duration, 10) * 0.02
        if has_self_ref:
            confidence -= 0.1

        out.append(
            {
                "segment_id": f"seg_{row.get('index', len(out)):03d}",
                "row_index": row.get("index"),
                "start": round(start, 3),
                "end": round(end, 3),
                "duration": round(duration, 3),
                "text": text,
                "keywords": strong,
                "all_keywords": [w for w, _ in parsed],
                "reason": ",".join(reasons),
                "confidence": round(min(confidence, 0.99), 2),
            }
        )

    return out
