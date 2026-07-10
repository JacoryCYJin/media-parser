import html as html_lib
import json
import re

from app.services.podcast.formatting import infer_audio_content_type, normalize_url, parse_duration_seconds, strip_html
from app.services.podcast.http import fetch_text


def marker_only_transcript() -> dict:
    return {
        "status": "marker_only",
        "source": "xiaoyuzhou",
        "format": "",
        "language": "",
        "url": "",
        "char_count": 0,
        "compact_length": 0,
        "preview": "",
        "text": "",
        "invalid_reason": "TRANSCRIPT_MARKER_ONLY",
    }


def _meta_content(html: str, name: str) -> str:
    patterns = [
        rf'<meta\s+[^>]*(?:property|name)=["\']{re.escape(name)}["\'][^>]*content=["\']([^"\']*)["\'][^>]*>',
        rf'<meta\s+[^>]*content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']{re.escape(name)}["\'][^>]*>',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, flags=re.I)
        if match:
            return strip_html(html_lib.unescape(match.group(1)))
    return ""


def _script_json(html: str, pattern: str) -> list[dict]:
    payloads = []
    for match in re.finditer(pattern, html, flags=re.I | re.S):
        raw = html_lib.unescape(match.group(1)).strip()
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                payloads.append(parsed)
        except Exception:
            continue
    return payloads


def _json_ld_items(html: str) -> list[dict]:
    return _script_json(html, r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>')


def _next_data(html: str) -> dict:
    items = _script_json(html, r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>')
    return items[0] if items else {}


def _find_rss_link(html: str, base_url: str) -> str:
    match = re.search(
        r'<link[^>]+type=["\']application/rss\+xml["\'][^>]+href=["\']([^"\']+)["\']',
        html,
        flags=re.I,
    )
    return normalize_url(match.group(1), base_url) if match else ""


def _episode_id(url: str) -> str:
    match = re.search(r"/episode/([^/?#]+)", url)
    return match.group(1) if match else ""


def _first_by_keys(value, keys: set[str]):
    if isinstance(value, dict):
        for key, item in value.items():
            if key in keys and item not in (None, ""):
                return item
        for item in value.values():
            found = _first_by_keys(item, keys)
            if found not in (None, ""):
                return found
    elif isinstance(value, list):
        for item in value:
            found = _first_by_keys(item, keys)
            if found not in (None, ""):
                return found
    return None


def _series_name(json_ld_items: list[dict], next_data: dict) -> str:
    for item in json_ld_items:
        part = item.get("partOfSeries") if isinstance(item, dict) else None
        if isinstance(part, dict) and part.get("name"):
            return str(part["name"]).strip()

    podcast = _first_by_keys(next_data, {"podcast", "podcastInfo", "podcastShow"})
    if isinstance(podcast, dict):
        for key in ["title", "name", "podcastName"]:
            if podcast.get(key):
                return str(podcast[key]).strip()
    return ""


def _episode_next_data(next_data: dict) -> dict:
    page_props = ((next_data.get("props") or {}).get("pageProps") or {}) if isinstance(next_data, dict) else {}
    episode = page_props.get("episode") if isinstance(page_props, dict) else None
    return episode if isinstance(episode, dict) else {}


def _episode_description(json_ld_items: list[dict], next_data: dict) -> str:
    for item in json_ld_items:
        if isinstance(item, dict) and item.get("@type") == "PodcastEpisode" and item.get("description"):
            return strip_html(str(item["description"]))

    episode = _episode_next_data(next_data)
    for key in ["description", "shownotes"]:
        if episode.get(key):
            return strip_html(str(episode[key]))
    return ""


def _published_at(json_ld_items: list[dict], next_data: dict) -> str | None:
    for item in json_ld_items:
        if item.get("datePublished"):
            return str(item["datePublished"]).strip()
    found = _first_by_keys(next_data, {"datePublished", "publishedAt", "pubDate"})
    return str(found).strip() if found else None


def _duration(json_ld_items: list[dict], next_data: dict) -> int:
    for item in json_ld_items:
        if item.get("timeRequired"):
            return parse_duration_seconds(item["timeRequired"])
        if item.get("duration"):
            return parse_duration_seconds(item["duration"])
    return parse_duration_seconds(_first_by_keys(next_data, {"duration", "durationSeconds"}))


def _audio_url(json_ld_items: list[dict], next_data: dict, base_url: str) -> str:
    for item in json_ld_items:
        media = item.get("associatedMedia") if isinstance(item, dict) else None
        if isinstance(media, dict) and media.get("contentUrl"):
            return normalize_url(str(media["contentUrl"]), base_url)
        if item.get("contentUrl"):
            return normalize_url(str(item["contentUrl"]), base_url)
    found = _first_by_keys(next_data, {"contentUrl", "audioUrl", "mediaUrl"})
    return normalize_url(str(found), base_url) if found else ""


def _thumbnail(next_data: dict, base_url: str) -> str:
    found = _first_by_keys(next_data, {"image", "cover", "coverUrl"})
    return normalize_url(str(found), base_url) if isinstance(found, str) else ""


def _has_transcript_marker(next_data: dict) -> bool:
    marker = _first_by_keys(next_data, {"transcript", "transcriptMediaId"})
    return bool(marker)


def parse_xiaoyuzhou_page(url: str) -> tuple[dict, dict]:
    html, _headers = fetch_text(url, accept="text/html,*/*", timeout=30)
    json_ld_items = _json_ld_items(html)
    next_data = _next_data(html)
    audio_url = normalize_url(_meta_content(html, "og:audio"), url) or _audio_url(json_ld_items, next_data, url)

    episode = {
        "id": _episode_id(url),
        "title": _meta_content(html, "og:title") or str(_first_by_keys(next_data, {"title", "name"}) or "").strip(),
        "show_title": _series_name(json_ld_items, next_data),
        "description": _episode_description(json_ld_items, next_data),
        "thumbnail": normalize_url(_meta_content(html, "og:image"), url) or _thumbnail(next_data, url),
        "published_at": _published_at(json_ld_items, next_data),
        "duration": _duration(json_ld_items, next_data),
        "audio_url": audio_url,
        "audio_content_type": infer_audio_content_type(audio_url, ""),
        "audio_size_bytes": None,
        "language": "unknown",
        "feed_url": _find_rss_link(html, url),
        "link": url,
        "transcript_candidates": [],
    }
    transcript = marker_only_transcript() if _has_transcript_marker(next_data) else None
    return episode, transcript
