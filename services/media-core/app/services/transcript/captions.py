import html
import json
import re
import urllib.request


MIN_TRANSCRIPT_COMPACT_LENGTH = 100


def has_caption_entries(captions: dict | None) -> bool:
    return any(isinstance(items, list) and len(items) > 0 for items in (captions or {}).values())


def get_caption_languages(captions: dict | None) -> list[str]:
    return [lang for lang, items in (captions or {}).items() if isinstance(items, list) and len(items) > 0]


def get_subtitle_info(info: dict) -> dict:
    subtitles = info.get("subtitles") or {}
    automatic_captions = info.get("automatic_captions") or {}
    return {
        "has_subtitles": has_caption_entries(subtitles),
        "has_automatic_captions": has_caption_entries(automatic_captions),
        "subtitle_languages": get_caption_languages(subtitles),
        "automatic_caption_languages": get_caption_languages(automatic_captions),
    }


def normalize_transcript_text(text: str = "") -> str:
    in_skip_block = False
    lines = []

    for raw_line in html.unescape(str(text or "")).replace("\r", "\n").split("\n"):
        trimmed = re.sub(r"<[^>]+>", "", raw_line).strip()
        if re.match(r"^(STYLE|REGION|NOTE)(\s|$)", trimmed, re.I):
            in_skip_block = True
            continue
        if not trimmed:
            in_skip_block = False
            continue
        if in_skip_block:
            continue
        if re.match(r"^WEBVTT", trimmed, re.I):
            continue
        if re.match(r"^Kind:", trimmed, re.I):
            continue
        if re.match(r"^Language:", trimmed, re.I):
            continue
        if re.match(r"^\d+$", trimmed):
            continue
        if re.match(r"^(align|position|line|size):", trimmed, re.I):
            continue
        if re.match(r"^(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}", trimmed):
            continue
        lines.append(trimmed)

    deduped = []
    for line in lines:
        if not deduped or line != deduped[-1]:
            deduped.append(line)
    return "\n".join(deduped).strip()


def transcript_preview(text: str = "") -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()[:500]


def evaluate_transcript(text: str = "") -> dict:
    normalized = str(text or "").strip()
    compact = re.sub(r"\s+", "", normalized)
    readable_chars = [char for char in compact if char.isalnum()]
    tokens = re.findall(r"[\w\u4e00-\u9fff]{2,}", normalized, flags=re.UNICODE)
    unique_tokens = {token.lower() for token in tokens}
    readable_ratio = len(readable_chars) / len(compact) if compact else 0
    unique_ratio = len(unique_tokens) / len(tokens) if tokens else 0

    if not compact:
        return {
            "isValid": False,
            "reason": "EMPTY_TRANSCRIPT",
            "charCount": 0,
            "compactLength": 0,
            "tokenCount": 0,
            "uniqueTokenCount": 0,
        }

    if len(compact) < MIN_TRANSCRIPT_COMPACT_LENGTH:
        return {
            "isValid": False,
            "reason": "TRANSCRIPT_TOO_SHORT",
            "charCount": len(normalized),
            "compactLength": len(compact),
            "tokenCount": len(tokens),
            "uniqueTokenCount": len(unique_tokens),
        }

    if readable_ratio < 0.55:
        return {
            "isValid": False,
            "reason": "TRANSCRIPT_LOW_READABLE_RATIO",
            "charCount": len(normalized),
            "compactLength": len(compact),
            "tokenCount": len(tokens),
            "uniqueTokenCount": len(unique_tokens),
        }

    if len(tokens) >= 20 and unique_ratio < 0.12:
        return {
            "isValid": False,
            "reason": "TRANSCRIPT_TOO_REPETITIVE",
            "charCount": len(normalized),
            "compactLength": len(compact),
            "tokenCount": len(tokens),
            "uniqueTokenCount": len(unique_tokens),
        }

    return {
        "isValid": True,
        "reason": "OK",
        "charCount": len(normalized),
        "compactLength": len(compact),
        "tokenCount": len(tokens),
        "uniqueTokenCount": len(unique_tokens),
    }


def parse_json_caption(raw: str = "") -> str:
    parsed = json.loads(raw)
    chunks = []
    for event in parsed.get("events") or []:
        for seg in event.get("segs") or []:
            text = str(seg.get("utf8") or "").strip()
            if text:
                chunks.append(text)
    return normalize_transcript_text(" ".join(chunks))


def parse_subtitle_text(raw: str = "", ext: str = "") -> str:
    if str(ext or "").lower() == "json3":
        return parse_json_caption(raw)
    return normalize_transcript_text(raw)


def caption_language_score(lang: str = "") -> int:
    normalized = str(lang).lower()
    if normalized.startswith("zh"):
        return 0
    if normalized.startswith("en"):
        return 1
    return 2


def caption_ext_score(ext: str = "") -> int:
    normalized = str(ext).lower()
    if normalized == "json3":
        return 0
    if normalized == "vtt":
        return 1
    if normalized.startswith("srv"):
        return 2
    if normalized == "ttml":
        return 3
    return 4


def get_caption_candidates(info: dict) -> list[dict]:
    groups = [
        {"type": "manual", "captions": info.get("subtitles") or {}},
        {"type": "automatic", "captions": info.get("automatic_captions") or {}},
    ]
    candidates = []

    for group in groups:
        for language, items in group["captions"].items():
            if not isinstance(items, list):
                continue
            for item in items:
                if not item or not item.get("url"):
                    continue
                candidates.append(
                    {
                        "type": group["type"],
                        "language": language,
                        "ext": str(item.get("ext") or "").lower(),
                        "name": item.get("name") or item.get("format") or "",
                        "url": item.get("url"),
                    }
                )

    return sorted(
        candidates,
        key=lambda candidate: (
            0 if candidate["type"] == "manual" else 1,
            caption_language_score(candidate["language"]),
            caption_ext_score(candidate["ext"]),
        ),
    )


def fetch_text(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Accept": "text/vtt,application/json,text/plain,*/*",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def fetch_transcript_from_info(info: dict) -> dict:
    candidates = get_caption_candidates(info)
    best_invalid = None

    print(
        "[video-transcript] 字幕候选:",
        [{"type": c["type"], "language": c["language"], "ext": c["ext"], "name": c["name"]} for c in candidates],
    )

    for candidate in candidates:
        try:
            raw = fetch_text(candidate["url"])
            transcript = parse_subtitle_text(raw, candidate["ext"])
            quality = evaluate_transcript(transcript)
            metadata = {
                "type": candidate["type"],
                "language": candidate["language"],
                "ext": candidate["ext"],
                "raw_length": len(raw),
                "transcript_length": quality["charCount"],
                "compact_length": quality["compactLength"],
                "reason": quality["reason"],
                "preview": transcript_preview(transcript),
            }

            if not quality["isValid"]:
                print("[video-transcript] 跳过无效字幕候选:", metadata)
                if not best_invalid or quality["compactLength"] > best_invalid["quality"]["compactLength"]:
                    best_invalid = {
                        "candidate": candidate,
                        "transcript": transcript,
                        "quality": quality,
                        "metadata": metadata,
                    }
                continue

            print("[video-transcript] 使用字幕候选:", metadata)
            if transcript:
                return {
                    "transcript": transcript,
                    "transcript_language": candidate["language"],
                    "transcript_source": candidate["type"],
                    "transcript_format": candidate["ext"],
                    "transcript_is_valid": True,
                    "transcript_status": "available",
                    "transcript_char_count": quality["charCount"],
                    "transcript_compact_length": quality["compactLength"],
                    "transcript_preview": transcript_preview(transcript),
                }
        except Exception as error:
            print(
                "[video-transcript] 字幕候选读取失败:",
                {
                    "type": candidate["type"],
                    "language": candidate["language"],
                    "ext": candidate["ext"],
                    "message": str(error),
                },
            )

    if best_invalid:
        return {
            "transcript": "",
            "transcript_language": best_invalid["candidate"]["language"],
            "transcript_source": best_invalid["candidate"]["type"],
            "transcript_format": best_invalid["candidate"]["ext"],
            "transcript_is_valid": False,
            "transcript_status": "insufficient",
            "transcript_invalid_reason": best_invalid["quality"]["reason"],
            "transcript_char_count": best_invalid["quality"]["charCount"],
            "transcript_compact_length": best_invalid["quality"]["compactLength"],
            "transcript_preview": transcript_preview(best_invalid["transcript"]),
        }

    return {
        "transcript": "",
        "transcript_language": "",
        "transcript_source": "",
        "transcript_format": "",
        "transcript_is_valid": False,
        "transcript_status": "missing",
        "transcript_invalid_reason": "NO_TRANSCRIPT",
        "transcript_char_count": 0,
        "transcript_compact_length": 0,
        "transcript_preview": "",
    }
