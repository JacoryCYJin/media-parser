import asyncio

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.errors import ApiError
from app.services.outline import create_outline, outline_service_meta

router = APIRouter()


@router.post("/video/outline")
async def video_outline(request: Request):
    body = await request.json()
    title = str(body.get("title") or "").strip()
    platform = str(body.get("platform") or "").strip()
    duration = str(body.get("duration") or "").strip()
    language = str(body.get("language") or "").strip()
    transcript = str(body.get("transcript") or "").strip()

    try:
        result = await asyncio.to_thread(create_outline, title, platform, duration, language, transcript, request.state.client_id)
        return {"success": True, **result}
    except ApiError as error:
        if error.code == "INSUFFICIENT_TRANSCRIPT":
            return JSONResponse(
                {
                    "success": False,
                    "code": error.code,
                    "error": error.message,
                    "transcript_reason": error.extra.get("transcript_reason"),
                    "transcript_char_count": error.extra.get("transcript_char_count"),
                    "transcript_compact_length": error.extra.get("transcript_compact_length"),
                },
                status_code=error.status_code,
            )

        print(
            "[video-outline] 生成大纲失败:",
            {
                "message": error.message,
                "statusCode": error.status_code,
                **outline_service_meta(request.state.client_id),
            },
        )
        return JSONResponse({"success": False, "error": error.message}, status_code=error.status_code)
    except Exception as error:
        print(
            "[video-outline] 生成大纲失败:",
            {
                "message": str(error),
                "statusCode": 500,
                **outline_service_meta(request.state.client_id),
            },
        )
        return JSONResponse({"success": False, "error": str(error) or "生成大纲失败"}, status_code=500)
