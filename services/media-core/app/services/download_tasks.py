import re
import signal
import subprocess
import threading
import time
from pathlib import Path
from uuid import uuid4

from app.config import YTDLP_BIN
from app.services.video.ytdlp import detect_platform, get_ytdlp_args


download_tasks: dict[str, dict] = {}
download_tasks_lock = threading.Lock()
MAX_ACTIVE_TASKS_PER_CLIENT = 2
TASK_RETENTION_SECONDS = 60 * 60


def public_download_task(task: dict | None) -> dict | None:
    if not task:
        return None
    return {key: value for key, value in task.items() if key != "process"}


def update_download_task(task_id: str, **updates) -> None:
    with download_tasks_lock:
        task = download_tasks.get(task_id)
        if task:
            task.update(updates)
            task["updated_at"] = time.time()


def cleanup_download_tasks() -> None:
    now = time.time()
    with download_tasks_lock:
        removable = [
            task_id
            for task_id, task in download_tasks.items()
            if task.get("status") in {"COMPLETE", "FAILED", "CANCELLED"} and now - float(task.get("updated_at") or 0) > TASK_RETENTION_SECONDS
        ]
        for task_id in removable:
            download_tasks.pop(task_id, None)


def active_task_count(client_id: str) -> int:
    cleanup_download_tasks()
    with download_tasks_lock:
        return sum(
            1
            for task in download_tasks.values()
            if task.get("client_id") == client_id and task.get("status") in {"QUEUED", "DOWNLOADING", "PAUSED"}
        )


def create_download_task(client_id: str) -> str:
    task_id = uuid4().hex
    now = time.time()
    with download_tasks_lock:
        download_tasks[task_id] = {
            "task_id": task_id,
            "client_id": client_id,
            "status": "QUEUED",
            "progress": 0,
            "path": "",
            "output_dir": "",
            "error": "",
            "created_at": now,
            "updated_at": now,
        }
    return task_id


def read_download_task(task_id: str) -> dict | None:
    cleanup_download_tasks()
    with download_tasks_lock:
        return public_download_task(download_tasks.get(task_id))


def control_download_task(task_id: str, action: str) -> tuple[dict | None, str]:
    with download_tasks_lock:
        task = download_tasks.get(task_id)
        if not task:
            return None, "下载任务不存在"
        process = task.get("process")
        status = task.get("status")

        if action == "pause":
            if status != "DOWNLOADING" or not process:
                return public_download_task(task), "当前任务不能暂停"
            process.send_signal(signal.SIGSTOP)
            task["status"] = "PAUSED"
        elif action == "resume":
            if status != "PAUSED" or not process:
                return public_download_task(task), "当前任务不能继续"
            process.send_signal(signal.SIGCONT)
            task["status"] = "DOWNLOADING"
        elif action == "cancel":
            if status not in {"QUEUED", "DOWNLOADING", "PAUSED"}:
                return public_download_task(task), "当前任务不能取消"
            if process and process.poll() is None:
                if status == "PAUSED":
                    process.send_signal(signal.SIGCONT)
                process.terminate()
            task["status"] = "CANCELLED"
            task["error"] = "下载已取消"
            task["process"] = None
        else:
            return public_download_task(task), "未知任务操作"

        task["updated_at"] = time.time()
        return public_download_task(task), ""


def extract_download_progress(line: str) -> int | None:
    match = re.search(r"\[download\]\s+(\d+(?:\.\d+)?)%", line)
    if not match:
        return None
    return max(0, min(100, round(float(match.group(1)))))


def run_ytdlp_with_progress(task_id: str, args: list[str]) -> dict:
    completed_lines: list[str] = []
    all_lines: list[str] = []

    def handle_line(raw_line: str) -> None:
        line = raw_line.strip()
        if not line:
            return
        all_lines.append(line)
        progress = extract_download_progress(line)
        if progress is not None:
            update_download_task(task_id, progress=progress)
            return
        if line.startswith(("[Merger]", "[Fixup]", "[ExtractAudio]")):
            task = read_download_task(task_id) or {}
            update_download_task(task_id, progress=max(99, int(task.get("progress") or 0)))
            return
        if not line.startswith("["):
            completed_lines.append(line)

    process = subprocess.Popen(
        [YTDLP_BIN, *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    task = read_download_task(task_id) or {}
    if task.get("status") == "CANCELLED":
        process.terminate()
        raise RuntimeError("下载已取消")
    update_download_task(task_id, status="DOWNLOADING", process=process)

    try:
        assert process.stdout is not None
        for raw_line in process.stdout:
            handle_line(raw_line)
        return_code = process.wait()
    finally:
        update_download_task(task_id, process=None)

    if return_code == 0:
        return {"stdout": "\n".join(completed_lines), "stderr": "\n".join(all_lines)}
    task = read_download_task(task_id) or {}
    if task.get("status") == "CANCELLED":
        raise RuntimeError("下载已取消")
    raise RuntimeError("\n".join(all_lines) or f"yt-dlp exited with code {return_code}")


def is_youtube_blocked(message: str) -> bool:
    return "HTTP Error 403" in message or "Forbidden" in message or "Sign in to confirm you’re not a bot" in message


def run_download_with_retries(task_id: str, client_id: str, url: str, base_args: list[str]) -> str:
    stdout = ""
    is_youtube = detect_platform(url) == "youtube"

    try:
        result = run_ytdlp_with_progress(task_id, get_ytdlp_args(client_id, url, base_args))
        stdout = result["stdout"]
    except Exception as first_error:
        msg = str(first_error)
        if not (is_youtube and is_youtube_blocked(msg)):
            raise

        try:
            retry_no_cookies = run_ytdlp_with_progress(task_id, get_ytdlp_args(client_id, url, base_args, {"useCookies": False}))
            stdout = retry_no_cookies["stdout"]
        except Exception as second_error:
            second_msg = str(second_error)
            if not is_youtube_blocked(second_msg):
                raise

            try:
                retry_safari = run_ytdlp_with_progress(
                    task_id,
                    get_ytdlp_args(client_id, url, base_args, {"useCookies": False, "cookiesFromBrowser": "safari"}),
                )
                stdout = retry_safari["stdout"]
            except Exception:
                retry_chrome = run_ytdlp_with_progress(
                    task_id,
                    get_ytdlp_args(client_id, url, base_args, {"useCookies": False, "cookiesFromBrowser": "chrome"}),
                )
                stdout = retry_chrome["stdout"]

    return stdout


def download_task_worker(task_id: str, client_id: str, url: str, base_args: list[str], target_dir: Path) -> None:
    try:
        task = read_download_task(task_id) or {}
        if task.get("status") == "CANCELLED":
            return
        stdout = run_download_with_retries(task_id, client_id, url, base_args)
        task = read_download_task(task_id) or {}
        if task.get("status") == "CANCELLED":
            return
        saved_path = next((line.strip() for line in reversed(stdout.splitlines()) if line.strip()), "")
        update_download_task(
            task_id,
            status="COMPLETE",
            progress=100,
            path=saved_path or str(target_dir),
            output_dir=str(target_dir),
            process=None,
        )
    except Exception as error:
        task = read_download_task(task_id) or {}
        if task.get("status") == "CANCELLED":
            return
        msg = str(error)
        if "Sign in to confirm you’re not a bot" in msg:
            msg = "下载失败: YouTube 触发了机器人校验，请先在 Cookies 设置里更新 YouTube cookies（建议重新导出）后重试。"
        else:
            msg = f"下载失败: {msg}"
        update_download_task(task_id, status="FAILED", error=msg, process=None)
