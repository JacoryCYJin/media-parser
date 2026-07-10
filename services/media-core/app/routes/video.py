import asyncio
import json
import urllib.request
from urllib.parse import urlparse

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from app.services.transcript import fetch_transcript_from_info, get_subtitle_info
from app.services.video.ytdlp import (
    build_thumbnail_proxy_url,
    detect_platform,
    get_ytdlp_args,
    normalize_thumbnail,
    normalize_video_input,
    run_ytdlp,
    to_unique_formats,
)

router = APIRouter()


@router.post("/parse")
async def parse_video(request: Request):
    body = await request.json()
    try:
        url = normalize_video_input(body.get("url"))
        if not url:
            return JSONResponse({"error": "缺少 url 参数"}, status_code=400)

        is_youtube = detect_platform(url) == "youtube"
        stdout = ""
        try:
            result = await asyncio.to_thread(run_ytdlp, get_ytdlp_args(request.state.client_id, url, ["-J"]))
            stdout = result["stdout"]
        except Exception as first_error:
            msg = str(first_error)
            blocked = "Sign in to confirm you’re not a bot" in msg or "HTTP Error 403" in msg
            if not (is_youtube and blocked):
                raise

            try:
                retry_no_cookies = await asyncio.to_thread(
                    run_ytdlp,
                    get_ytdlp_args(request.state.client_id, url, ["-J"], {"useCookies": False}),
                )
                stdout = retry_no_cookies["stdout"]
            except Exception:
                try:
                    retry_safari = await asyncio.to_thread(
                        run_ytdlp,
                        get_ytdlp_args(
                            request.state.client_id,
                            url,
                            ["-J"],
                            {"useCookies": False, "cookiesFromBrowser": "safari"},
                        ),
                    )
                    stdout = retry_safari["stdout"]
                except Exception:
                    retry_chrome = await asyncio.to_thread(
                        run_ytdlp,
                        get_ytdlp_args(
                            request.state.client_id,
                            url,
                            ["-J"],
                            {"useCookies": False, "cookiesFromBrowser": "chrome"},
                        ),
                    )
                    stdout = retry_chrome["stdout"]

        info = json.loads(stdout)
        formats = to_unique_formats(info.get("formats") or [], info.get("duration"))

        if not formats:
            return JSONResponse(
                {"code": "NO_VISIBLE_FORMATS", "error": "未找到可下载的 MP4 / 音频格式。"},
                status_code=400,
            )

        thumbnail = normalize_thumbnail(info)
        subtitle_info = get_subtitle_info(info)
        transcript_info = await asyncio.to_thread(fetch_transcript_from_info, info)
        return {
            "title": info.get("title"),
            "thumbnail": thumbnail,
            "thumbnail_proxy": build_thumbnail_proxy_url(thumbnail),
            "duration": info.get("duration"),
            "uploader": info.get("uploader") or info.get("channel") or info.get("creator") or "",
            "upload_date": info.get("upload_date") or info.get("release_date") or info.get("timestamp") or "",
            **subtitle_info,
            **transcript_info,
            "source_url": url,
            "formats": formats,
        }
    except Exception as error:
        msg = str(error)
        if "Sign in to confirm you’re not a bot" in msg:
            return JSONResponse(
                {"error": "解析失败: YouTube 触发了机器人校验，请在 Cookies 设置里更新 YouTube cookies 后重试。"},
                status_code=500,
            )
        return JSONResponse({"error": f"解析失败: {msg}"}, status_code=500)


@router.post("/video/parse")
async def parse_video_v2(request: Request):
    return await parse_video(request)


@router.get("/thumbnail")
async def thumbnail(url: str = ""):
    try:
        raw = str(url or "").strip()
        if not raw:
            return JSONResponse({"error": "缺少封面 url 参数"}, status_code=400)

        target = raw
        if target.startswith("//"):
            target = f"https:{target}"
        if not target.lower().startswith(("http://", "https://")):
            return JSONResponse({"error": "无效的封面 url"}, status_code=400)

        host = (urlparse(target).hostname or "").lower()
        referer = "https://www.youtube.com/"
        if "bilibili.com" in host or "hdslb.com" in host:
            referer = "https://www.bilibili.com/"

        def fetch_image():
            req = urllib.request.Request(
                target,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
                    "Referer": referer,
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                },
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                content_type = response.headers.get("content-type") or "image/jpeg"
                return content_type, response.read()

        content_type, content = await asyncio.to_thread(fetch_image)
        return Response(content=content, media_type=content_type, headers={"Cache-Control": "public, max-age=3600"})
    except Exception as error:
        return JSONResponse({"error": f"封面获取失败: {error}"}, status_code=500)
