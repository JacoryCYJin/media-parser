import html
import re
from urllib.parse import urljoin


def strip_html(value: str = "") -> str:
    text = html.unescape(str(value or ""))
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?is)<(script|style).*?</\1>", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def first_text(element, names: list[str], namespaces: dict[str, str] | None = None) -> str:
    namespaces = namespaces or {}
    for name in names:
        found = element.find(name, namespaces)
        if found is not None and found.text:
            return str(found.text).strip()
    return ""


def normalize_url(url: str = "", base_url: str = "") -> str:
    raw = html.unescape(str(url or "").strip())
    if not raw:
        return ""
    if raw.startswith("//"):
        return f"https:{raw}"
    if base_url:
        return urljoin(base_url, raw)
    return raw


def parse_duration_seconds(value: str | int | float | None) -> int:
    if value is None:
        return 0
    raw = str(value).strip()
    if not raw:
        return 0
    iso_match = re.match(
        r"^P(?:T)?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$",
        raw,
        re.I,
    )
    if iso_match and any(iso_match.groups()):
        hours, minutes, seconds = (float(part or 0) for part in iso_match.groups())
        return round(hours * 3600 + minutes * 60 + seconds)
    if re.match(r"^\d+(?:\.\d+)?$", raw):
        return round(float(raw))
    parts = raw.split(":")
    if not all(part.strip().isdigit() for part in parts):
        return 0
    numbers = [int(part) for part in parts]
    if len(numbers) == 3:
        return numbers[0] * 3600 + numbers[1] * 60 + numbers[2]
    if len(numbers) == 2:
        return numbers[0] * 60 + numbers[1]
    return numbers[0] if numbers else 0


def guess_transcript_format(url: str = "", mime_type: str = "") -> str:
    normalized_mime = str(mime_type or "").lower()
    normalized_url = str(url or "").lower().split("?", 1)[0]

    if "json" in normalized_mime or normalized_url.endswith(".json"):
        return "json"
    if "vtt" in normalized_mime or normalized_url.endswith(".vtt"):
        return "vtt"
    if "srt" in normalized_mime or normalized_url.endswith(".srt"):
        return "srt"
    if "html" in normalized_mime or normalized_url.endswith((".html", ".htm")):
        return "html"
    return "txt"


def infer_audio_content_type(url: str = "", content_type: str = "") -> str:
    raw = str(content_type or "").split(";", 1)[0].strip().lower()
    if raw:
        return raw
    path = str(url or "").lower().split("?", 1)[0]
    if path.endswith(".mp3"):
        return "audio/mpeg"
    if path.endswith(".m4a"):
        return "audio/mp4"
    if path.endswith(".aac"):
        return "audio/aac"
    if path.endswith(".wav"):
        return "audio/wav"
    if path.endswith(".ogg"):
        return "audio/ogg"
    if path.endswith(".flac"):
        return "audio/flac"
    return ""
