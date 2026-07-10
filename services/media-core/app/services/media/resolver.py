from urllib.parse import urlparse

from app.services.media.types import MediaParseTarget


PODCAST_HOSTS = {
    "podcasts.apple.com",
    "www.xiaoyuzhoufm.com",
    "xiaoyuzhoufm.com",
}

AUDIO_EXTENSIONS = (".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac")


def resolve_media_target(url: str) -> MediaParseTarget:
    raw = str(url or "").strip()
    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower()
    path = (parsed.path or "").lower()

    if host in PODCAST_HOSTS:
        platform = "apple-podcasts" if host == "podcasts.apple.com" else "xiaoyuzhou"
        return {"type": "podcast", "platform": platform, "url": raw}

    if path.endswith((".xml", ".rss")) or "rss" in path.split("/") or host.startswith("feed."):
        return {"type": "podcast", "platform": "rss", "url": raw}

    if path.endswith(AUDIO_EXTENSIONS):
        return {"type": "audio", "platform": host.removeprefix("www.") or "direct", "url": raw}

    return {"type": "video", "platform": host.removeprefix("www.").split(".")[0] or "default", "url": raw}
