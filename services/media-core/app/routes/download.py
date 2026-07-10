import asyncio
import platform
import subprocess
import threading
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.errors import ApiError
from app.services.download_tasks import (
    MAX_ACTIVE_TASKS_PER_CLIENT,
    active_task_count,
    control_download_task,
    create_download_task,
    download_task_worker,
    read_download_task,
)
from app.services.user_data import get_user_settings, normalize_output_dir
from app.services.video.ytdlp import (
    assert_allowed_download_format,
    normalize_video_input,
)

router = APIRouter()


def reveal_path_command(target_path: Path) -> list[str] | None:
    system = platform.system().lower()
    if system == "darwin":
        if target_path.is_file():
            return ["open", "-R", str(target_path)]
        return ["open", str(target_path)]
    if system == "windows":
        if target_path.is_file():
            return ["explorer", f"/select,{target_path}"]
        return ["explorer", str(target_path)]
    return None


@router.post("/reveal")
async def reveal_download(request: Request):
    body = await request.json()
    raw_path = str(body.get("path") or "").strip()

    if not raw_path:
        return JSONResponse({"error": "缺少 path 参数"}, status_code=400)

    target_path = Path(raw_path).expanduser()
    if not target_path.exists():
        return JSONResponse({"error": "文件或目录不存在"}, status_code=404)

    try:
        command = reveal_path_command(target_path)
        if not command:
            return JSONResponse({"error": "当前系统暂不支持自动打开本地路径"}, status_code=501)
        completed = subprocess.run(command, capture_output=True, text=True, check=False)
        if completed.returncode != 0:
            return JSONResponse({"error": completed.stderr.strip() or "无法打开本地路径"}, status_code=500)
        return {"message": "已打开本地路径", "path": str(target_path)}
    except FileNotFoundError:
        return JSONResponse({"error": "当前系统不支持自动打开本地路径"}, status_code=500)
    except Exception as error:
        return JSONResponse({"error": f"打开本地路径失败: {error}"}, status_code=500)


@router.post("/download")
async def download_video(request: Request):
    body = await request.json()
    try:
        url = normalize_video_input(body.get("url"))
        resolution = str(body.get("resolution") or "").strip()
        format_id = str(body.get("format_id") or "").strip()

        if not url or not resolution:
            return JSONResponse({"error": "缺少 url 或 resolution 参数"}, status_code=400)

        is_audio_only = resolution.lower() in {"audio", "audio only"}
        height = 0 if is_audio_only else int("".join(ch for ch in resolution if ch.isdigit()) or 0)
        if not is_audio_only and not height:
            return JSONResponse({"error": "无效的 resolution 参数"}, status_code=400)

        user_settings = get_user_settings(request.state.client_id)
        target_dir = normalize_output_dir(body.get("output_dir") or user_settings["default_download_dir"], request.state.client_id)
        target_dir.mkdir(parents=True, exist_ok=True)

        if active_task_count(request.state.client_id) >= MAX_ACTIVE_TASKS_PER_CLIENT:
            return JSONResponse({"error": f"同时最多下载 {MAX_ACTIVE_TASKS_PER_CLIENT} 个任务"}, status_code=429)

        selected_format = await asyncio.to_thread(assert_allowed_download_format, request.state.client_id, url, format_id)
        if format_id:
            selected_video_selector = (
                f"{format_id}[ext=mp4]"
                if selected_format and selected_format.get("hasAudio")
                else f"{format_id}[ext=mp4]+bestaudio[ext=m4a]"
            )
        else:
            selected_video_selector = f"bestvideo[height<={height}][ext=mp4]+bestaudio[ext=m4a]/best[height<={height}][ext=mp4]"

        format_selector = (
            (f"{format_id}[ext=m4a][vcodec=none]/bestaudio[ext=m4a]" if format_id else "bestaudio[ext=m4a]")
            if is_audio_only
            else selected_video_selector
        )

        if selected_format and selected_format.get("ext") == "m4a" and not is_audio_only:
            return JSONResponse({"error": "音频格式请使用 Audio 下载项"}, status_code=400)
        if selected_format and selected_format.get("ext") == "mp4" and is_audio_only:
            return JSONResponse({"error": "视频格式不能作为 Audio 下载"}, status_code=400)

        output_template = str(Path(target_dir) / "%(title).140B-%(id)s.%(ext)s")
        base_args = [
            "--newline",
            "--progress",
            "--progress-template",
            "[download] %(progress._percent_str)s of %(progress._total_bytes_str)s at %(progress._speed_str)s ETA %(progress._eta_str)s",
            "-f",
            format_selector,
            "-o",
            output_template,
            "--print",
            "after_move:filepath",
        ]
        if not is_audio_only:
            base_args.extend(["--merge-output-format", "mp4"])

        task_id = create_download_task(request.state.client_id)
        worker = threading.Thread(
            target=download_task_worker,
            args=(task_id, request.state.client_id, url, base_args, target_dir),
            daemon=True,
        )
        worker.start()
        return read_download_task(task_id)
    except ApiError as error:
        return JSONResponse({"error": error.message}, status_code=error.status_code)
    except Exception as error:
        msg = str(error)
        if "Sign in to confirm you’re not a bot" in msg:
            return JSONResponse(
                {"error": "下载失败: YouTube 触发了机器人校验，请先在 Cookies 设置里更新 YouTube cookies（建议重新导出）后重试。"},
                status_code=500,
            )
        return JSONResponse({"error": f"下载失败: {msg}"}, status_code=500)


@router.get("/download/tasks/{task_id}")
async def get_download_task(task_id: str):
    task = read_download_task(task_id)
    if not task:
        return JSONResponse({"error": "下载任务不存在"}, status_code=404)
    return task


@router.post("/download/tasks/{task_id}/{action}")
async def control_download(task_id: str, action: str):
    task, error = control_download_task(task_id, action)
    if not task:
        return JSONResponse({"error": error}, status_code=404)
    if error:
        return JSONResponse({"error": error, **task}, status_code=400)
    return task
