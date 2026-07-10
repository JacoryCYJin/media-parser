from app.services.media.resolver import resolve_media_target
from app.services.podcast.apple import parse_apple_podcast
from app.services.podcast.audio import parse_direct_audio, probe_audio_metadata
from app.services.podcast.rss import empty_transcript, fetch_podcast_transcript, parse_rss_feed, select_episode
from app.services.podcast.xiaoyuzhou import parse_xiaoyuzhou_page


def pending_summary() -> dict:
    return {
        "status": "pending_transcript",
        "one_liner": "",
        "sections": [],
        "chapters": [],
        "key_points": [],
        "entities": [],
        "markdown": "",
    }


def public_episode(episode: dict | None) -> dict:
    episode = episode or {}
    return {
        "id": episode.get("id") or "",
        "title": episode.get("title") or "",
        "show_title": episode.get("show_title") or "",
        "description": episode.get("description") or "",
        "thumbnail": episode.get("thumbnail") or "",
        "published_at": episode.get("published_at"),
        "duration": episode.get("duration") or 0,
        "audio_url": episode.get("audio_url") or "",
        "audio_content_type": episode.get("audio_content_type") or "",
        "audio_size_bytes": episode.get("audio_size_bytes"),
        "language": episode.get("language") or "unknown",
    }


def with_language_fallback(transcript: dict, episode: dict | None) -> dict:
    if transcript.get("language"):
        return transcript
    return {
        **transcript,
        "language": (episode or {}).get("language") or "unknown",
    }


def build_response(
    *,
    platform: str,
    source_url: str,
    media_type: str = "podcast",
    feed_url: str = "",
    episode: dict | None = None,
    transcript: dict | None = None,
    supported: bool = True,
    error: str = "",
) -> dict:
    return {
        "type": media_type,
        "platform": platform,
        "source_url": source_url,
        "feed_url": feed_url,
        "supported": supported,
        "episode": public_episode(episode),
        "transcript": with_language_fallback(transcript or empty_transcript(), episode),
        "summary": pending_summary(),
        "error": error,
    }


def _fill_audio_metadata(episode: dict | None) -> dict | None:
    if not episode or not episode.get("audio_url"):
        return episode

    metadata = probe_audio_metadata(episode["audio_url"])
    if not episode.get("audio_size_bytes"):
        episode["audio_size_bytes"] = metadata.get("content_length")
    if not episode.get("audio_content_type"):
        episode["audio_content_type"] = metadata.get("content_type") or ""
    return episode


def parse_rss_target(url: str) -> dict:
    feed = parse_rss_feed(url)
    episode = _fill_audio_metadata(select_episode(feed))
    transcript = fetch_podcast_transcript((episode or {}).get("transcript_candidates") or [])
    return build_response(
        platform="rss",
        source_url=url,
        feed_url=feed.get("feed_url") or url,
        episode=episode,
        transcript=transcript,
    )


def parse_apple_target(url: str) -> dict:
    feed, episode = parse_apple_podcast(url)
    episode = _fill_audio_metadata(episode)
    transcript = fetch_podcast_transcript((episode or {}).get("transcript_candidates") or [])
    return build_response(
        platform="apple-podcasts",
        source_url=url,
        feed_url=feed.get("feed_url") or "",
        episode=episode,
        transcript=transcript,
    )


def parse_xiaoyuzhou_target(url: str) -> dict:
    episode, transcript = parse_xiaoyuzhou_page(url)
    episode = _fill_audio_metadata(episode)
    return build_response(
        platform="xiaoyuzhou",
        source_url=url,
        feed_url=episode.get("feed_url") or "",
        episode=episode,
        transcript=transcript or empty_transcript(),
    )


def parse_audio_target(url: str, platform: str = "direct") -> dict:
    episode = parse_direct_audio(url)
    return build_response(
        platform=platform or "direct",
        media_type="audio",
        source_url=url,
        feed_url="",
        episode=episode,
        transcript=empty_transcript(),
    )


def parse_podcast_target(url: str) -> dict:
    target = resolve_media_target(url)
    if target["type"] not in {"podcast", "audio"}:
        return build_response(
            platform=target["platform"],
            source_url=target["url"],
            supported=False,
            error="当前链接不是播客或音频链接",
        )

    if target["type"] == "audio":
        return parse_audio_target(target["url"], target["platform"])

    if target["platform"] == "apple-podcasts":
        return parse_apple_target(target["url"])
    if target["platform"] == "xiaoyuzhou":
        return parse_xiaoyuzhou_target(target["url"])
    if target["platform"] == "rss":
        return parse_rss_target(target["url"])

    return build_response(
        platform=target["platform"],
        source_url=target["url"],
        supported=False,
        error="当前播客来源暂不支持",
    )
