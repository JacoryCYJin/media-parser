"""Recognize one video source without guessing a search result or fetching a URL."""
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from app.errors import ApiError

URL_TOKENS = re.compile(r'''https?://[^\s<>"'`，。；！？（）【】]+|(?<![\w./-])(?:www\.|m\.|music\.)?(?:bilibili\.com|b23\.tv|youtube\.com|youtu\.be)/[^\s<>"'`，。；！？（）【】]+''', re.I)
ID_TOKENS = re.compile(r"(?<![A-Za-z0-9_])(?:BV[A-Za-z0-9]{10}|av\d+)(?![A-Za-z0-9_])", re.I)
TRACKING = re.compile(r"^(?:utm_.+|spm_id_from|si|feature|share_source|share_medium|share_plat|share_session_id|share_tag)$", re.I)
YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"}
BILIBILI_HOSTS = {"bilibili.com", "www.bilibili.com", "m.bilibili.com"}


def canonical_url(value: str) -> str:
    token = value.rstrip(")]} ,.!?:;")
    url = urlsplit(token if re.match(r"^https?://", token, re.I) else "https://" + token)
    if not url.hostname or url.scheme.lower() not in {"http", "https"} or url.username or url.password:
        raise ValueError("Invalid URL")
    host = url.hostname.lower()
    scheme, netloc, path = url.scheme.lower(), url.netloc.lower(), url.path or "/"
    params = parse_qsl(url.query, keep_blank_values=True)
    youtube = host in YOUTUBE_HOSTS
    short_youtube = host in {"youtu.be", "www.youtu.be"}
    segments = [part for part in path.split("/") if part]
    video_id = segments[0] if short_youtube and segments else ""
    if youtube:
        video_id = next((v for k, v in params if k == "v"), "")
        if not video_id and len(segments) > 1 and segments[0] in {"shorts", "live", "embed", "v"}:
            video_id = segments[1]
    if video_id and re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
        scheme, netloc, path = "https", "www.youtube.com", "/watch"
        params = [("v", video_id)] + [(k, v) for k, v in params if k != "v"]
    if host in BILIBILI_HOSTS and re.fullmatch(r"/video/(?:BV[A-Za-z0-9]{10}|av\d+)/?", path, re.I):
        scheme, netloc = "https", "www.bilibili.com"
        path = re.sub(r"/bv", "/BV", path.rstrip("/"), flags=re.I)
        path = re.sub(r"/av", "/av", path, flags=re.I)
    if youtube or short_youtube or host in BILIBILI_HOSTS | {"b23.tv"}:
        params = [(k, v) for k, v in params if not TRACKING.fullmatch(k)]
    # Preserve the original query encoding for unrelated extractor URLs.
    query = urlencode(params) if youtube or short_youtube or host in BILIBILI_HOSTS | {"b23.tv"} else url.query
    return urlunsplit((scheme, netloc, path, query, url.fragment))


def normalize_video_input(input_value: str | None) -> str:
    raw = re.sub(r"[\u200B-\u200D\uFEFF]", "", str(input_value or "")).strip()
    if not raw:
        return ""
    candidates = []

    def extract(match):
        try:
            candidates.append(canonical_url(match[0]))
        except ValueError:
            pass
        return " "

    remainder = URL_TOKENS.sub(extract, raw)
    for match in ID_TOKENS.finditer(remainder):
        value = match[0]
        video_id = "BV" + value[2:] if value.lower().startswith("bv") else value.lower()
        candidates.append(canonical_url("https://www.bilibili.com/video/" + video_id))
    if not candidates and re.fullmatch(r"[A-Za-z0-9_-]{11}", raw):
        candidates.append(canonical_url("https://www.youtube.com/watch?v=" + raw))
    unique = {}
    for value in candidates:
        parsed = urlsplit(value)
        key = urlunsplit(parsed._replace(query=urlencode(sorted(parse_qsl(parsed.query, keep_blank_values=True)))))
        unique[key] = value
    if not unique:
        raise ApiError("未识别到视频来源，请粘贴视频链接、BV/AV 号或 YouTube 视频 ID。", 400, "INVALID_VIDEO_INPUT")
    if len(unique) > 1:
        raise ApiError("发现多个视频来源，请每次保留一个视频链接或编号。", 400, "MULTIPLE_VIDEO_SOURCES")
    return next(iter(unique.values()))
