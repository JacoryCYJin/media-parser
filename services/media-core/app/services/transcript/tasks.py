import threading
import time
import uuid
from copy import deepcopy

from app.services.transcript.local_stt import transcribe_audio_url


TERMINAL_STATUSES = {"completed", "failed"}

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
        task.update(updates)
        task["updated_at"] = _now()


def _progress_value(value) -> int:
    try:
        return max(0, min(100, int(value)))
    except (TypeError, ValueError):
        return 0


def _run_task(task_id: str, payload: dict) -> None:
    try:
        _update_task(task_id, status="downloading", stage="downloading", progress=1)

        def update_stage(stage: str) -> None:
            _update_task(task_id, status=stage, stage=stage)

        def update_progress(progress) -> None:
            _update_task(task_id, progress=_progress_value(progress))

        result = transcribe_audio_url(
            payload["source_url"],
            client_id=payload["client_id"],
            title=payload.get("title") or "",
            source=payload.get("source") or "",
            language=payload.get("language") or "",
            model_name=payload.get("model") or "",
            device=payload.get("device") or "",
            compute_type=payload.get("compute_type") or "",
            stage_callback=update_stage,
            progress_callback=update_progress,
        )
        _update_task(task_id, status="completed", stage="completed", progress=100, result=result, error="")
    except Exception as error:
        _update_task(task_id, status="failed", stage="failed", error=str(error))


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
) -> dict:
    task_id = uuid.uuid4().hex
    created_at = _now()
    task = {
        "task_id": task_id,
        "client_id": client_id,
        "source_url": source_url,
        "source_type": source_type,
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
