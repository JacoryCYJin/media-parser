import json
import re
from urllib.parse import parse_qs, quote, urlparse

from app.services.podcast.http import fetch_text
from app.services.podcast.rss import parse_rss_feed, select_episode


def extract_apple_ids(url: str) -> tuple[str, str]:
    podcast_match = re.search(r"/id(\d+)", url)
    query = parse_qs(urlparse(url).query)
    return (
        podcast_match.group(1) if podcast_match else "",
        (query.get("i") or [""])[0],
    )


def lookup_podcast_feed(podcast_id: str) -> dict:
    lookup_url = f"https://itunes.apple.com/lookup?id={quote(podcast_id)}&entity=podcast"
    raw, _headers = fetch_text(lookup_url, accept="application/json,*/*", timeout=30)
    parsed = json.loads(raw)
    result = next((item for item in parsed.get("results") or [] if item.get("feedUrl")), None)
    if not result:
        raise ValueError("Apple Podcasts 未返回 feedUrl")
    return {
        "feed_url": result.get("feedUrl") or "",
        "collection_name": result.get("collectionName") or "",
        "artwork": result.get("artworkUrl600") or result.get("artworkUrl100") or "",
    }


def lookup_episode_url(podcast_id: str, episode_id: str) -> str:
    if not episode_id:
        return ""
    lookup_url = f"https://itunes.apple.com/lookup?id={quote(podcast_id)}&entity=podcastEpisode&limit=200"
    try:
        raw, _headers = fetch_text(lookup_url, accept="application/json,*/*", timeout=30)
        parsed = json.loads(raw)
        for item in parsed.get("results") or []:
            if str(item.get("trackId") or "") == str(episode_id):
                return str(item.get("episodeUrl") or "").strip()
    except Exception:
        return ""
    return ""


def parse_apple_podcast(url: str) -> tuple[dict, dict | None]:
    podcast_id, episode_id = extract_apple_ids(url)
    if not podcast_id:
        raise ValueError("无法从 Apple Podcasts 链接提取节目 ID")

    lookup = lookup_podcast_feed(podcast_id)
    feed = parse_rss_feed(lookup["feed_url"])
    episode = select_episode(feed, episode_id)
    episode_url = lookup_episode_url(podcast_id, episode_id)

    if episode and episode_url and not episode.get("audio_url"):
        episode["audio_url"] = episode_url

    if lookup.get("collection_name") and feed.get("show"):
        feed["show"]["title"] = feed["show"].get("title") or lookup["collection_name"]
    if lookup.get("artwork") and feed.get("show"):
        feed["show"]["thumbnail"] = feed["show"].get("thumbnail") or lookup["artwork"]

    return feed, episode
