import asyncio

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.services.podcast.parser import parse_podcast_target

router = APIRouter()


@router.post("/podcast/parse")
async def parse_podcast(request: Request):
    body = await request.json()
    url = str(body.get("url") or "").strip()
    if not url:
        return JSONResponse({"error": "缺少 url 参数"}, status_code=400)

    try:
        result = await asyncio.to_thread(parse_podcast_target, url)
        if not result.get("supported"):
            return JSONResponse(result, status_code=400)
        return result
    except Exception as error:
        return JSONResponse({"error": f"播客解析失败: {error}"}, status_code=500)
