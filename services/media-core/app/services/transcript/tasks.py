import threading
import time
import uuid
from copy import deepcopy

from app.services.transcript.local_stt import transcribe_audio_url, transcribe_video_audio, transcribe_local_audio


TERMINAL_STATUSES = {"completed", "failed", "cancelled"}


class TranscriptCancelled(Exception):
    pass

_TASKS: dict[str, dict] = {}
_TASK_LOCK = threading.Lock()


def _now() -> float:
    return round(time.time(), 3)


def _public_task(task: dict | None) -> dict | None:
    if not task:
        return None
    public = deepcopy(task)
    public.pop("client_id", None)
    return public


def _update_task(task_id: str, **updates) -> None:
    with _TASK_LOCK:
        task = _TASKS.get(task_id)
        if not task:
            return
        if task.get("cancel_requested") and updates.get("status") not in {"cancelled", "stopping"}:
            raise TranscriptCancelled()
        task.update(updates)
        task["updated_at"] = _now()


def _progress_value(value) -> int:
    try:
        return max(0, min(100, int(value)))
    except (TypeError, ValueError):
        return 0


def _run_task(task_id: str, payload: dict) -> None:
    try:
        is_video_audio = payload.get("source_type") == "video"
        initial_stage = "transcribing" if payload.get("source_type") == "local" else ("fetching" if is_video_audio else "downloading")
        _update_task(task_id, status=initial_stage, stage=initial_stage, progress=1)

        def update_stage(stage: str) -> None:
            _update_task(task_id, status=stage, stage=stage)

        def update_progress(progress) -> None:
            _update_task(task_id, progress=_progress_value(progress))

        common_options = {
            "title": payload.get("title") or "",
            "source": payload.get("source") or "",
            "language": payload.get("language") or "",
            "model_name": payload.get("model") or "",
            "device": payload.get("device") or "",
            "compute_type": payload.get("compute_type") or "",
            "stage_callback": update_stage,
            "progress_callback": update_progress,
        }
        if payload.get("source_type") == "local":
            result = transcribe_local_audio(payload["source_url"], client_id=payload["client_id"], **common_options)
        elif is_video_audio:
            result = transcribe_video_audio(
                payload["source_url"],
                client_id=payload["client_id"],
                format_id=payload.get("format_id") or "",
                **common_options,
            )
        else:
            result = transcribe_audio_url(
                payload["source_url"],
                client_id=payload["client_id"],
                **common_options,
            )
        _update_task(task_id, status="completed", stage="completed", progress=100, result=result, error="")
    except TranscriptCancelled:
        _update_task(task_id, status="cancelled", stage="cancelled", error="")
    except Exception as error:
        try:
            _update_task(task_id, status="failed", stage="failed", error=str(error))
        except TranscriptCancelled:
            _update_task(task_id, status="cancelled", stage="cancelled", error="")


def create_transcript_task(
    *,
    client_id: str,
    source_url: str,
    title: str = "",
    source: str = "",
    language: str = "",
    model: str = "",
    device: str = "",
    compute_type: str = "",
    source_type: str = "",
    format_id: str = "",
) -> dict:
    if not source_url:
        raise ValueError("转写任务必须提供音频来源")
    task_id = uuid.uuid4().hex
    created_at = _now()
    task = {
        "task_id": task_id,
        "client_id": client_id,
        "source_url": source_url,
        "source_type": source_type,
        "format_id": format_id,
        "title": title,
        "source": source,
        "status": "queued",
        "stage": "queued",
        "progress": 0,
        "error": "",
        "result": None,
        "created_at": created_at,
        "updated_at": created_at,
    }
    payload = {
        "client_id": client_id,
        "source_url": source_url,
        "source_type": source_type,
        "format_id": format_id,
        "title": title,
        "source": source,
        "language": language,
        "model": model,
        "device": device,
        "compute_type": compute_type,
    }

    with _TASK_LOCK:
        _TASKS[task_id] = task

    thread = threading.Thread(target=_run_task, args=(task_id, payload), daemon=True)
    thread.start()
    return _public_task(task)


def read_transcript_task(task_id: str, client_id: str) -> dict | None:
    with _TASK_LOCK:
        task = _TASKS.get(task_id)
        if not task or task.get("client_id") != client_id:
            return None
        return _public_task(task)


def cancel_transcript_task(task_id: str, client_id: str) -> dict | None:
    with _TASK_LOCK:
        task = _TASKS.get(task_id)
        if not task or task["client_id"] != client_id:
            return None
        if task["status"] not in TERMINAL_STATUSES:
            task.update(cancel_requested=True, status="stopping", stage="stopping", updated_at=_now())
        return _public_task(task)
