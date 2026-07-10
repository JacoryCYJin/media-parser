from pathlib import PurePosixPath
from urllib.parse import unquote, urlparse

from app.services.podcast.formatting import infer_audio_content_type
from app.services.podcast.http import head_url, parse_content_length_from_headers, range_headers


def probe_audio_metadata(url: str) -> dict:
    content_type = ""
    content_length = None
    content_range = ""

    try:
        headers = head_url(url)
        content_type = headers.get("Content-Type") or headers.get("content-type") or ""
        content_length = parse_content_length_from_headers(headers)
    except Exception:
        headers = {}

    if not content_length:
        try:
            headers = range_headers(url)
            content_length = parse_content_length_from_headers(headers)
            content_range = headers.get("Content-Range") or headers.get("content-range") or ""
            content_type = content_type or headers.get("Content-Type") or headers.get("content-type") or ""
        except Exception:
            pass

    return {
        "content_type": infer_audio_content_type(url, content_type),
        "content_length": content_length,
        "content_range": content_range,
    }


def parse_direct_audio(url: str) -> dict:
    metadata = probe_audio_metadata(url)
    parsed = urlparse(url)
    filename = unquote(PurePosixPath(parsed.path).name or "Audio")
    title = filename.rsplit(".", 1)[0] if "." in filename else filename

    return {
        "id": "",
        "title": title or "Audio",
        "show_title": "",
        "description": "",
        "thumbnail": "",
        "published_at": None,
        "duration": 0,
        "audio_url": url,
        "audio_content_type": metadata["content_type"],
        "audio_size_bytes": metadata["content_length"],
        "language": "unknown",
        "link": url,
        "transcript_candidates": [],
    }
