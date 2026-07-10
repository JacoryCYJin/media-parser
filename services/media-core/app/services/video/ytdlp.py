import json
import re
import subprocess
from pathlib import Path
from urllib.parse import quote, urlparse

from app.config import YTDLP_BIN
from app.errors import ApiError
from app.services.user_data import (
    cookies_path_for,
    get_user_settings,
    normalize_browser_cookie_source,
    normalize_cookie_mode,
)


def detect_platform(url: str) -> str:
    try:
        host = urlparse(url).hostname or ""
        host = host.lower()
        if "youtube.com" in host or "youtu.be" in host:
            return "youtube"
        if "bilibili.com" in host or "b23.tv" in host:
            return "bilibili"
        return re.sub(r"^www\.", "", host).split(".")[0] or "default"
    except Exception:
        return "default"


def normalize_video_input(input_value: str | None) -> str:
    raw = str(input_value or "").strip()
    if not raw:
        return ""

    bv_match = re.match(r"^(BV[0-9A-Za-z]{10})$", raw, re.I)
    if bv_match:
        return f"https://www.bilibili.com/video/{bv_match.group(1)}"

    av_match = re.match(r"^(av\d+)$", raw, re.I)
    if av_match:
        return f"https://www.bilibili.com/video/{av_match.group(1).lower()}"

    return raw


def get_ytdlp_args(client_id: str, url: str, extra_args: list[str] | None = None, options: dict | None = None) -> list[str]:
    extra_args = extra_args or []
    options = options or {}
    platform = detect_platform(url)
    cookie_path = cookies_path_for(client_id, platform)
    has_cookies = cookie_path.exists()
    settings = get_user_settings(client_id)
    cookie_mode = normalize_cookie_mode(options.get("cookieMode") or settings.get("cookie_mode"))
    use_cookies = options.get("useCookies") is not False
    cookies_from_browser = (
        normalize_browser_cookie_source(options.get("cookiesFromBrowser"))
        if options.get("cookiesFromBrowser")
        else (settings.get("browser_cookie_source") if use_cookies and cookie_mode == "browser" else "")
    )
    should_use_manual_cookies = use_cookies and cookie_mode == "manual" and has_cookies
    args = [*extra_args]

    if platform == "youtube":
        will_use_any_cookies = should_use_manual_cookies or bool(cookies_from_browser)
        if not will_use_any_cookies:
            args.extend(["--extractor-args", "youtube:player_client=android,web"])
        args.extend(["--add-header", "Referer:https://www.youtube.com/"])

    if cookies_from_browser:
        args.extend(["--cookies-from-browser", cookies_from_browser])
    elif should_use_manual_cookies:
        args.extend(["--cookies", str(cookie_path)])

    args.extend(["--no-playlist", url])
    return args


def run_ytdlp(args: list[str]) -> dict:
    completed = subprocess.run(
        [YTDLP_BIN, *args],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode == 0:
        return {"stdout": completed.stdout, "stderr": completed.stderr}
    raise RuntimeError(completed.stderr or completed.stdout or f"yt-dlp exited with code {completed.returncode}")


def normalize_thumbnail(info: dict) -> str:
    raw = str(info.get("thumbnail") or "").strip()
    if raw:
        if raw.startswith("http://"):
            return raw.replace("http://", "https://", 1)
        if raw.startswith("//"):
            return f"https:{raw}"
        return raw

    thumbnails = info.get("thumbnails") or []
    if isinstance(thumbnails, list) and thumbnails:
        raw = str((thumbnails[-1] or {}).get("url") or "").strip()
        if not raw:
            return ""
        if raw.startswith("http://"):
            return raw.replace("http://", "https://", 1)
        if raw.startswith("//"):
            return f"https:{raw}"
        return raw
    return ""


def build_thumbnail_proxy_url(thumbnail_url: str) -> str:
    raw = str(thumbnail_url or "").strip()
    if not raw:
        return ""
    return f"/api/thumbnail?url={quote(raw, safe='')}"


def estimate_size_bytes(format_info: dict, duration: int | float | None) -> dict:
    explicit_size = float(format_info.get("filesize") or format_info.get("filesize_approx") or 0)
    if explicit_size > 0:
        return {"bytes": explicit_size, "estimated": False}

    bitrate_kbps = float(format_info.get("tbr") or 0)
    duration_seconds = float(duration or 0)
    if bitrate_kbps > 0 and duration_seconds > 0:
        return {"bytes": (bitrate_kbps * 1000 * duration_seconds) / 8, "estimated": True}

    return {"bytes": 0, "estimated": False}


def format_size_mb(size: dict) -> str:
    bytes_value = float(size.get("bytes") or 0)
    if bytes_value <= 0:
        return "未知"
    return f"{bytes_value / 1024 / 1024:.2f}"


def find_downloadable_format(formats: list[dict], format_id: str) -> dict | None:
    wanted = str(format_id or "").strip()
    if not wanted:
        return None
    return next((item for item in formats if str(item.get("format_id") or "") == wanted), None)


def assert_allowed_download_format(client_id: str, url: str, format_id: str) -> dict | None:
    if not format_id:
        return None
    result = run_ytdlp(get_ytdlp_args(client_id, url, ["-J"]))
    info = json.loads(result["stdout"])
    selected = find_downloadable_format(info.get("formats") or [], format_id)
    ext = str((selected or {}).get("ext") or "").lower()
    has_video = bool((selected or {}).get("vcodec")) and selected.get("vcodec") != "none"
    has_audio = bool((selected or {}).get("acodec")) and selected.get("acodec") != "none"

    if not selected or ext not in {"mp4", "m4a"}:
        raise ApiError("该格式不可用：仅支持 MP4 视频或 M4A 音频下载", status_code=400)

    if ext == "m4a" and (has_video or not has_audio):
        raise ApiError("该音频格式不可用", status_code=400)

    if ext == "mp4" and not has_video:
        raise ApiError("该视频格式不可用", status_code=400)

    return {"ext": ext, "hasVideo": has_video, "hasAudio": has_audio}


def to_unique_formats(formats: list[dict], duration: int | float | None = 0) -> list[dict]:
    by_resolution: dict[str, dict] = {}
    best_audio: dict | None = None

    for format_info in formats or []:
        if not format_info or not format_info.get("ext"):
            continue
        ext = str(format_info.get("ext") or "").lower()
        has_video = bool(format_info.get("vcodec")) and format_info.get("vcodec") != "none"
        has_audio = bool(format_info.get("acodec")) and format_info.get("acodec") != "none"
        size = estimate_size_bytes(format_info, duration)

        if ext == "m4a" and has_audio and not has_video:
            score = float(format_info.get("abr") or format_info.get("tbr") or 0)
            if not best_audio or score > best_audio["score"]:
                best_audio = {
                    "score": score,
                    "value": {
                        "format_id": format_info.get("format_id"),
                        "resolution": "Audio",
                        "format_note": format_info.get("format_note") or "audio",
                        "ext": format_info.get("ext"),
                        "filesize_mb": format_size_mb(size),
                        "has_audio": True,
                        "has_video": False,
                    },
                }
            continue

        if ext != "mp4":
            continue
        if not format_info.get("height"):
            continue
        if int(format_info.get("height") or 0) < 144:
            continue
        if "storyboard" in str(format_info.get("format_note") or "").lower():
            continue
        if not has_video:
            continue

        resolution = f"{format_info.get('height')}p"
        existing = by_resolution.get(resolution)
        score = float(format_info.get("tbr") or 0)

        if not existing or score > existing["score"]:
            by_resolution[resolution] = {
                "score": score,
                "value": {
                    "format_id": format_info.get("format_id"),
                    "resolution": resolution,
                    "format_note": format_info.get("format_note") or "",
                    "ext": format_info.get("ext"),
                    "filesize_mb": format_size_mb(size),
                    "has_audio": has_audio,
                    "has_video": bool(format_info.get("vcodec")) and format_info.get("vcodec") != "none",
                },
            }

    visible_formats = sorted(
        (item["value"] for item in by_resolution.values()),
        key=lambda item: int(re.sub(r"\D", "", item["resolution"]) or 0),
        reverse=True,
    )
    if best_audio:
        visible_formats.append(best_audio["value"])
    return visible_formats
