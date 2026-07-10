import json
import xml.etree.ElementTree as ET

from app.services.podcast.formatting import (
    first_text,
    guess_transcript_format,
    normalize_url,
    parse_duration_seconds,
    strip_html,
)
from app.services.podcast.http import fetch_text
from app.services.transcript import evaluate_transcript, normalize_transcript_text, transcript_preview


NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
    "media": "http://search.yahoo.com/mrss/",
    "podcast": "https://podcastindex.org/namespace/1.0",
}


def empty_transcript() -> dict:
    return {
        "status": "missing",
        "source": "none",
        "format": "",
        "language": "",
        "url": "",
        "char_count": 0,
        "compact_length": 0,
        "preview": "",
        "text": "",
        "invalid_reason": "NO_TRANSCRIPT",
    }


def _attr(element, key: str) -> str:
    return str((element.attrib or {}).get(key) or "").strip() if element is not None else ""


def _int_attr(element, key: str) -> int | None:
    raw = _attr(element, key)
    return int(raw) if raw.isdigit() else None


def _find_image(element) -> str:
    itunes_image = element.find("itunes:image", NS)
    if itunes_image is not None:
        return normalize_url(_attr(itunes_image, "href") or _attr(itunes_image, "url"))

    image_url = element.find("image/url")
    if image_url is not None and image_url.text:
        return normalize_url(image_url.text)

    media_thumbnail = element.find("media:thumbnail", NS)
    if media_thumbnail is not None:
        return normalize_url(_attr(media_thumbnail, "url"))

    return ""


def _find_audio(item) -> tuple[str, str, int | None]:
    enclosure = item.find("enclosure")
    if enclosure is not None and _attr(enclosure, "url"):
        return normalize_url(_attr(enclosure, "url")), _attr(enclosure, "type"), _int_attr(enclosure, "length")

    media_content = item.find("media:content", NS)
    if media_content is not None and _attr(media_content, "url"):
        return normalize_url(_attr(media_content, "url")), _attr(media_content, "type"), _int_attr(media_content, "fileSize")

    return "", "", None


def _find_transcript_candidates(item) -> list[dict]:
    candidates = []
    for node in item.findall("podcast:transcript", NS):
        url = normalize_url(_attr(node, "url"))
        if not url:
            continue
        mime_type = _attr(node, "type")
        candidates.append(
            {
                "url": url,
                "type": mime_type,
                "language": _attr(node, "language"),
                "rel": _attr(node, "rel"),
                "format": guess_transcript_format(url, mime_type),
            }
        )
    return candidates


def _channel_info(root) -> tuple[object, dict]:
    channel = root.find("channel")
    if channel is None and root.tag.endswith("feed"):
        channel = root
    if channel is None:
        raise ValueError("无效的 RSS/Atom 格式")

    description = first_text(channel, ["description", "subtitle", "summary"], NS)
    return channel, {
        "title": first_text(channel, ["title"], NS),
        "description": strip_html(description),
        "language": first_text(channel, ["language"], NS) or "unknown",
        "link": first_text(channel, ["link"], NS),
        "thumbnail": _find_image(channel),
    }


def _parse_item(item, channel: dict) -> dict:
    audio_url, audio_content_type, audio_size_bytes = _find_audio(item)
    description = first_text(item, ["description", "content:encoded", "summary"], NS)
    item_image = _find_image(item)

    return {
        "id": first_text(item, ["guid", "id"], NS),
        "title": first_text(item, ["title"], NS),
        "show_title": channel.get("title") or "",
        "description": strip_html(description),
        "thumbnail": item_image or channel.get("thumbnail") or "",
        "published_at": first_text(item, ["pubDate", "published", "updated"], NS) or None,
        "duration": parse_duration_seconds(first_text(item, ["itunes:duration"], NS)),
        "audio_url": audio_url,
        "audio_content_type": audio_content_type,
        "audio_size_bytes": audio_size_bytes,
        "language": channel.get("language") or "unknown",
        "link": first_text(item, ["link"], NS),
        "transcript_candidates": _find_transcript_candidates(item),
    }


def parse_rss_feed(feed_url: str) -> dict:
    xml_text, _headers = fetch_text(
        feed_url,
        accept="application/rss+xml,application/xml,text/xml,*/*",
        timeout=30,
    )
    root = ET.fromstring(xml_text)
    channel, channel_data = _channel_info(root)
    items = channel.findall("item") or channel.findall("{http://www.w3.org/2005/Atom}entry")
    return {
        "feed_url": feed_url,
        "show": channel_data,
        "episodes": [_parse_item(item, channel_data) for item in items],
    }


def select_episode(feed: dict, episode_hint: str = "") -> dict | None:
    episodes = feed.get("episodes") or []
    hint = str(episode_hint or "").strip()
    if hint:
        for episode in episodes:
            searchable = " ".join(str(episode.get(key) or "") for key in ["id", "title", "audio_url", "link"])
            if hint in searchable:
                return episode
    return episodes[0] if episodes else None


def parse_transcript_payload(raw: str, transcript_format: str = "") -> str:
    normalized_format = str(transcript_format or "").lower()
    if normalized_format == "json":
        try:
            parsed = json.loads(raw)
            chunks = []
            if isinstance(parsed, dict):
                if isinstance(parsed.get("text"), str):
                    chunks.append(parsed["text"])
                for key in ["segments", "items", "events"]:
                    for item in parsed.get(key) or []:
                        if isinstance(item, dict):
                            text = item.get("text") or item.get("utf8") or item.get("body")
                            if text:
                                chunks.append(str(text))
                            for seg in item.get("segs") or []:
                                if isinstance(seg, dict) and seg.get("utf8"):
                                    chunks.append(str(seg["utf8"]))
            elif isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, str):
                        chunks.append(item)
                    elif isinstance(item, dict):
                        text = item.get("text") or item.get("utf8") or item.get("body")
                        if text:
                            chunks.append(str(text))
            if chunks:
                return normalize_transcript_text("\n".join(chunks))
        except Exception:
            pass
    return normalize_transcript_text(raw)


def fetch_podcast_transcript(candidates: list[dict]) -> dict:
    for candidate in candidates or []:
        try:
            raw, _headers = fetch_text(
                candidate["url"],
                accept="text/vtt,application/x-subrip,application/json,text/plain,*/*",
                timeout=30,
            )
            transcript = parse_transcript_payload(raw, candidate.get("format") or "")
            quality = evaluate_transcript(transcript)
            return {
                "status": "available",
                "source": "rss",
                "format": candidate.get("format") or "",
                "language": candidate.get("language") or "",
                "url": candidate.get("url") or "",
                "char_count": quality["charCount"],
                "compact_length": quality["compactLength"],
                "preview": transcript_preview(transcript),
                "text": transcript if quality["isValid"] else "",
                "invalid_reason": "" if quality["isValid"] else quality["reason"],
            }
        except Exception:
            continue

    return empty_transcript()
