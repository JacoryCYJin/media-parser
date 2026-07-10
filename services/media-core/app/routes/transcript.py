import asyncio

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.services.transcript.local_stt import transcribe_audio_url
from app.services.transcript.tasks import create_transcript_task, read_transcript_task

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
