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
from app.services.video.ytdlp import get_ytdlp_args, run_ytdlp


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


def _transcript_result(result: dict, *, title: str, source_url: str) -> dict:
    result["title"] = str(title or "").strip() or _title_from_url(source_url)
    result["saved"] = False
    return result


def _transcribe_audio_path(
    audio_path: Path,
    *,
    selected_model: str,
    selected_device: str,
    selected_compute: str,
    selected_language: str | None,
    start_progress: int,
    stage_callback=None,
    progress_callback=None,
) -> tuple[dict, object]:
    if stage_callback:
        stage_callback("transcribing")
    if progress_callback:
        progress_callback(start_progress)
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
            progress_callback(start_progress + min(75, int(segment_end / duration * 75)))

    return {
        "duration": duration,
        "text": _to_simplified(normalize_transcript_text("\n".join(text_parts))),
        "segments": segments,
    }, info


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
        transcript, info = _transcribe_audio_path(
            audio_path,
            selected_model=selected_model,
            selected_device=selected_device,
            selected_compute=selected_compute,
            selected_language=selected_language,
            start_progress=20,
            stage_callback=stage_callback,
            progress_callback=progress_callback,
        )

    elapsed = round(time.time() - started_at, 3)
    detected_language = getattr(info, "language", "") or ""

    result = {
        "status": "completed",
        "provider": "faster-whisper",
        "model": selected_model,
        "device": selected_device,
        "compute_type": selected_compute,
        "language": detected_language,
        "duration": round(transcript["duration"], 3),
        "elapsed_seconds": elapsed,
        "audio": {
            "url": normalized_url,
            "bytes": download_info["bytes"],
            "content_type": download_info["content_type"],
        },
        "text": transcript["text"],
        "preview": transcript_preview(transcript["text"]),
        "segments": transcript["segments"],
    }

    return _transcript_result(result, title=title, source_url=normalized_url)


def transcribe_video_audio(
    video_url: str,
    *,
    client_id: str,
    format_id: str,
    title: str = "",
    source: str = "",
    language: str = "",
    model_name: str = "",
    device: str = "",
    compute_type: str = "",
    stage_callback=None,
    progress_callback=None,
) -> dict:
    selected_model = str(model_name or LOCAL_STT_MODEL).strip() or "small"
    selected_device = str(device or LOCAL_STT_DEVICE).strip() or "cpu"
    selected_compute = str(compute_type or LOCAL_STT_COMPUTE_TYPE).strip() or "int8"
    selected_language = str(language or "").strip() or None
    started_at = time.time()
    normalized_url = str(video_url or "").strip()
    normalized_format_id = str(format_id or "").strip()
    if not normalized_url.startswith(("http://", "https://")):
        raise ValueError("video_url 必须是 http 或 https 链接")
    if not normalized_format_id:
        raise ValueError("缺少音频格式")

    with tempfile.TemporaryDirectory(prefix="jacory-video-stt-") as tmpdir:
        output_template = str(Path(tmpdir) / "source.%(ext)s")
        if stage_callback:
            stage_callback("fetching")
        if progress_callback:
            progress_callback(1)
        result = run_ytdlp(
            get_ytdlp_args(
                client_id,
                normalized_url,
                ["-f", normalized_format_id, "--no-part", "-o", output_template, "--print", "after_move:filepath"],
            )
        )
        audio_path_text = next((line.strip() for line in reversed(result["stdout"].splitlines()) if line.strip()), "")
        audio_path = Path(audio_path_text or str(Path(tmpdir) / "source.m4a"))
        if not audio_path.is_file():
            raise RuntimeError("未能获取可转写的临时音频")
        audio_bytes = audio_path.stat().st_size
        if audio_bytes > LOCAL_STT_MAX_AUDIO_BYTES:
            raise ValueError(f"音频文件过大，超过限制 {LOCAL_STT_MAX_AUDIO_BYTES} bytes")
        transcript, info = _transcribe_audio_path(
            audio_path,
            selected_model=selected_model,
            selected_device=selected_device,
            selected_compute=selected_compute,
            selected_language=selected_language,
            start_progress=20,
            stage_callback=stage_callback,
            progress_callback=progress_callback,
        )

    result = {
        "status": "completed",
        "provider": "faster-whisper",
        "model": selected_model,
        "device": selected_device,
        "compute_type": selected_compute,
        "language": getattr(info, "language", "") or "",
        "duration": round(transcript["duration"], 3),
        "elapsed_seconds": round(time.time() - started_at, 3),
        "audio": {
            "source_url": normalized_url,
            "format_id": normalized_format_id,
            "bytes": audio_bytes,
            "content_type": "audio/mp4",
        },
        "text": transcript["text"],
        "preview": transcript_preview(transcript["text"]),
        "segments": transcript["segments"],
    }
    return _transcript_result(result, title=title, source_url=normalized_url)


def validate_local_media(path: str) -> Path:
    media_path = Path(path).expanduser().resolve(strict=True)
    if not media_path.is_file() or media_path.suffix.lower() not in {".mp3", ".m4a", ".wav", ".flac", ".ogg", ".aac", ".mp4", ".mkv"}:
        raise ValueError("请选择支持的音视频文件 / Select a supported audio or video file")
    if media_path.stat().st_size > LOCAL_STT_MAX_AUDIO_BYTES:
        raise ValueError("音视频文件超过大小限制 / Media file exceeds the size limit")
    if media_path.suffix.lower() in {".mp4", ".mkv"}:
        import av
        try:
            with av.open(str(media_path)) as container:
                if not container.streams.audio:
                    raise ValueError("此视频没有音轨 / This video has no audio track")
        except av.error.FFmpegError as error:
            raise ValueError("无法读取此视频文件 / Unable to read this video file") from error
    return media_path


def transcribe_local_audio(
    path: str, *, client_id: str, title: str = "", source: str = "",
    language: str = "", model_name: str = "", device: str = "",
    compute_type: str = "", stage_callback=None, progress_callback=None,
) -> dict:
    audio_path = validate_local_media(path)
    selected_model = model_name or LOCAL_STT_MODEL
    selected_device = device or LOCAL_STT_DEVICE
    selected_compute = compute_type or LOCAL_STT_COMPUTE_TYPE
    started = time.time()
    transcript, info = _transcribe_audio_path(
        audio_path, selected_model=selected_model, selected_device=selected_device,
        selected_compute=selected_compute, selected_language=language or None,
        start_progress=0, stage_callback=stage_callback, progress_callback=progress_callback,
    )
    result = {
        "status": "completed", "provider": "faster-whisper", "model": selected_model,
        "language": getattr(info, "language", ""), "duration": transcript["duration"],
        "elapsed_seconds": round(time.time() - started, 3),
        "text": transcript["text"], "segments": transcript["segments"],
        "audio": {"path": str(audio_path)},
    }
    return _transcript_result(result, title=title or audio_path.stem, source_url=audio_path.as_uri())
