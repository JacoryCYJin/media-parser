import hashlib
import json
import re
import tempfile
import time
import urllib.request
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

from app.config import (
    LOCAL_STT_COMPUTE_TYPE,
    LOCAL_STT_DEVICE,
    LOCAL_STT_MAX_AUDIO_BYTES,
    LOCAL_STT_MODEL,
)
from app.services.transcript.captions import normalize_transcript_text, transcript_preview
from app.services.user_data import get_user_settings, normalize_output_dir


DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)

_MODEL_CACHE: dict[tuple[str, str, str], object] = {}


@lru_cache(maxsize=1)
def _simplified_converter():
    try:
        from opencc import OpenCC
    except ModuleNotFoundError as error:
        raise RuntimeError("缺少 opencc-python-reimplemented 依赖，请先在 media-core 环境安装 requirements.txt") from error

    return OpenCC("t2s")


def _to_simplified(value: str) -> str:
    text = str(value or "")
    if not text:
        return ""
    return _simplified_converter().convert(text)


def _load_model(model_name: str, device: str, compute_type: str):
    try:
        from faster_whisper import WhisperModel
    except ModuleNotFoundError as error:
        raise RuntimeError("缺少 faster-whisper 依赖，请先在 media-core 环境安装 requirements.txt") from error

    cache_key = (model_name, device, compute_type)
    if cache_key not in _MODEL_CACHE:
        _MODEL_CACHE[cache_key] = WhisperModel(model_name, device=device, compute_type=compute_type)
    return _MODEL_CACHE[cache_key]


def _extension_from_url(url: str) -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".mp3", ".m4a", ".mp4", ".aac", ".wav", ".ogg", ".flac", ".webm"}:
        return suffix
    return ".audio"


def _download_audio(url: str, target: Path, max_bytes: int, progress_callback=None) -> dict:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": DEFAULT_USER_AGENT,
            "Accept": "audio/*,video/*,*/*",
        },
    )

    with urllib.request.urlopen(request, timeout=60) as response:
        content_length = response.headers.get("Content-Length")
        total_bytes = int(content_length) if content_length and content_length.isdigit() else 0
        if total_bytes > max_bytes:
            raise ValueError(f"音频文件过大，超过限制 {max_bytes} bytes")

        downloaded = 0
        with target.open("wb") as file:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                downloaded += len(chunk)
                if downloaded > max_bytes:
                    raise ValueError(f"音频文件过大，超过限制 {max_bytes} bytes")
                file.write(chunk)
                if progress_callback:
                    if total_bytes > 0:
                        progress_callback(1 + min(19, int(downloaded / total_bytes * 19)))
                    else:
                        progress_callback(10)

        return {
            "bytes": downloaded,
            "content_type": response.headers.get("Content-Type") or "",
        }


def _safe_name(value: str, fallback: str) -> str:
    normalized = re.sub(r"[\\/:*?\"<>|\x00-\x1f]+", "-", str(value or "").strip())
    normalized = re.sub(r"\s+", " ", normalized).strip(" .-_")
    return (normalized or fallback)[:90].strip(" .-_") or fallback


def _title_from_url(url: str) -> str:
    stem = Path(urlparse(url).path).stem
    return _safe_name(stem, "local-stt")


def _save_transcript_files(result: dict, *, client_id: str, title: str, source: str, audio_url: str) -> dict:
    user_settings = get_user_settings(client_id)
    base_dir = normalize_output_dir(user_settings.get("default_download_dir"), client_id)
    source_hash = hashlib.sha256(audio_url.encode("utf-8")).hexdigest()[:10]
    safe_title = _safe_name(title, _title_from_url(audio_url))
    output_dir = base_dir / f"{safe_title}-{source_hash}"
    output_dir.mkdir(parents=True, exist_ok=True)

    files = {
        "json": output_dir / "transcript.json",
    }
    transcript_payload = {
        "播客标题": _to_simplified(str(title or "").strip() or _title_from_url(audio_url)),
        "播客来源 / 节目名": _to_simplified(str(source or "").strip()),
        "字幕内容": _to_simplified(str(result.get("text") or "")),
    }

    files["json"].write_text(
        json.dumps(transcript_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    result["saved"] = True
    result["output_dir"] = str(output_dir)
    result["files"] = {key: str(path) for key, path in files.items()}
    return result


def transcribe_audio_url(
    audio_url: str,
    *,
    client_id: str = "",
    title: str = "",
    source: str = "",
    language: str = "",
    model_name: str = "",
    device: str = "",
    compute_type: str = "",
    stage_callback=None,
    progress_callback=None,
) -> dict:
    normalized_url = str(audio_url or "").strip()
    if not normalized_url.startswith(("http://", "https://")):
        raise ValueError("audio_url 必须是 http 或 https 链接")

    selected_model = str(model_name or LOCAL_STT_MODEL).strip() or "small"
    selected_device = str(device or LOCAL_STT_DEVICE).strip() or "cpu"
    selected_compute = str(compute_type or LOCAL_STT_COMPUTE_TYPE).strip() or "int8"
    selected_language = str(language or "").strip() or None

    started_at = time.time()
    with tempfile.TemporaryDirectory(prefix="jacory-local-stt-") as tmpdir:
        audio_path = Path(tmpdir) / f"source{_extension_from_url(normalized_url)}"
        if stage_callback:
            stage_callback("downloading")
        if progress_callback:
            progress_callback(1)
        download_info = _download_audio(
            normalized_url,
            audio_path,
            LOCAL_STT_MAX_AUDIO_BYTES,
            progress_callback=progress_callback,
        )
        if stage_callback:
            stage_callback("transcribing")
        if progress_callback:
            progress_callback(20)
        model = _load_model(selected_model, selected_device, selected_compute)
        segments_iter, info = model.transcribe(
            str(audio_path),
            language=selected_language,
            vad_filter=True,
        )
        duration = float(getattr(info, "duration", 0) or 0)
        segments = []
        text_parts = []
        for segment in segments_iter:
            text = _to_simplified(normalize_transcript_text(segment.text))
            if text:
                text_parts.append(text)
            segments.append(
                {
                    "id": segment.id,
                    "start": round(float(segment.start or 0), 3),
                    "end": round(float(segment.end or 0), 3),
                    "text": text,
                }
            )
            if progress_callback and duration > 0:
                segment_end = float(segment.end or 0)
                progress_callback(20 + min(75, int(segment_end / duration * 75)))

    text = _to_simplified(normalize_transcript_text("\n".join(text_parts)))
    elapsed = round(time.time() - started_at, 3)
    detected_language = getattr(info, "language", "") or ""

    result = {
        "status": "completed",
        "provider": "faster-whisper",
        "model": selected_model,
        "device": selected_device,
        "compute_type": selected_compute,
        "language": detected_language,
        "duration": round(duration, 3),
        "elapsed_seconds": elapsed,
        "audio": {
            "url": normalized_url,
            "bytes": download_info["bytes"],
            "content_type": download_info["content_type"],
        },
        "text": text,
        "preview": transcript_preview(text),
        "segments": segments,
    }

    if client_id:
        if stage_callback:
            stage_callback("saving")
        if progress_callback:
            progress_callback(98)
        return _save_transcript_files(result, client_id=client_id, title=title, source=source, audio_url=normalized_url)

    result["saved"] = False
    return result
