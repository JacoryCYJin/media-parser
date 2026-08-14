import asyncio

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.errors import ApiError
from app.services.transcript.local_stt import transcribe_audio_url
from app.services.transcript.tasks import create_transcript_task, read_transcript_task
from app.services.video.ytdlp import assert_allowed_download_format, normalize_video_input

router = APIRouter()


def _get_source_url(body: dict) -> str:
    return str(body.get("source_url") or body.get("audio_url") or "").strip()


@router.post("/transcript/local-stt")
async def local_stt(request: Request):
    body = await request.json()
    audio_url = _get_source_url(body)
    if not audio_url:
        return JSONResponse({"error": "缺少 source_url 参数"}, status_code=400)

    try:
        result = await asyncio.to_thread(
            transcribe_audio_url,
            audio_url,
            client_id=request.state.client_id,
            title=str(body.get("title") or "").strip(),
            source=str(body.get("source") or "").strip(),
            language=str(body.get("language") or "").strip(),
            model_name=str(body.get("model") or "").strip(),
            device=str(body.get("device") or "").strip(),
            compute_type=str(body.get("compute_type") or "").strip(),
        )
        return result
    except ValueError as error:
        return JSONResponse({"error": str(error)}, status_code=400)
    except RuntimeError as error:
        return JSONResponse({"error": str(error)}, status_code=501)
    except Exception as error:
        return JSONResponse({"error": f"本地转写失败: {error}"}, status_code=500)


@router.post("/transcript/local-stt/tasks")
async def create_local_stt_task(request: Request):
    body = await request.json()
    source_url = _get_source_url(body)
    if not source_url:
        return JSONResponse({"error": "缺少 source_url 参数"}, status_code=400)

    if not source_url.startswith(("http://", "https://")):
        return JSONResponse({"error": "source_url 必须是 http 或 https 链接"}, status_code=400)

    task = create_transcript_task(
        client_id=request.state.client_id,
        source_url=source_url,
        title=str(body.get("title") or "").strip(),
        source=str(body.get("source") or "").strip(),
        language=str(body.get("language") or "").strip(),
        model=str(body.get("model") or "").strip(),
        device=str(body.get("device") or "").strip(),
        compute_type=str(body.get("compute_type") or "").strip(),
        source_type=str(body.get("source_type") or "").strip(),
    )
    return task


@router.get("/transcript/local-stt/tasks/{task_id}")
async def get_local_stt_task(request: Request, task_id: str):
    task = read_transcript_task(task_id, request.state.client_id)
    if not task:
        return JSONResponse({"error": "转写任务不存在"}, status_code=404)
    return task


@router.post("/transcript/local-stt/tasks/video")
async def create_video_local_stt_task(request: Request):
    body = await request.json()
    video_url = normalize_video_input(body.get("url"))
    format_id = str(body.get("format_id") or "").strip()
    if not video_url or not format_id:
        return JSONResponse({"error": "缺少视频链接或音频格式"}, status_code=400)

    try:
        selected_format = await asyncio.to_thread(assert_allowed_download_format, request.state.client_id, video_url, format_id)
        if not selected_format or selected_format.get("ext") != "m4a" or not selected_format.get("hasAudio"):
            return JSONResponse({"error": "请选择可用的 M4A 音频格式"}, status_code=400)
        return create_transcript_task(
            client_id=request.state.client_id,
            source_url=video_url,
            title=str(body.get("title") or "").strip(),
            source=str(body.get("source") or "").strip(),
            language=str(body.get("language") or "").strip(),
            model=str(body.get("model") or "").strip(),
            device=str(body.get("device") or "").strip(),
            compute_type=str(body.get("compute_type") or "").strip(),
            source_type="video",
            format_id=format_id,
        )
    except ValueError as error:
        return JSONResponse({"error": str(error)}, status_code=400)
    except ApiError as error:
        return JSONResponse({"error": error.message}, status_code=error.status_code)
