import re
import threading
from datetime import datetime
from pathlib import Path

from app.services.user_data import get_user_settings, normalize_output_dir


# Group updates and saves share a lock: appending while a file is being saved
# cannot leave that file outside its batch folder.
EXPORT_LOCK = threading.RLock()
_GROUPS: dict[tuple[str, str], dict] = {}


def _group(client_id: str, group_id: str) -> dict:
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", group_id):
        raise ValueError("无效的转录任务组 / Invalid transcription group")
    key = (client_id, group_id)
    if key not in _GROUPS:
        root = normalize_output_dir(get_user_settings(client_id).get("default_download_dir"), client_id)
        _GROUPS[key] = {"root": root, "folder": None, "results": []}
    return _GROUPS[key]


def _write_unique(folder: Path, name: str, text: str) -> Path:
    counter = 0
    stem = Path(name).stem
    suffix = Path(name).suffix
    while True:
        path = folder / (name if not counter else f"{stem}_{counter}{suffix}")
        try:
            file = path.open("x", encoding="utf-8")
            break
        except FileExistsError:
            counter += 1
    try:
        with file:
            file.write(text)
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return path


def configure_export_group(client_id: str, group_id: str, batch: bool) -> None:
    with EXPORT_LOCK:
        group = _group(client_id, group_id)
        if not batch and group["folder"] is None:
            return
        root = group["root"]
        root.mkdir(parents=True, exist_ok=True)
        if group["folder"] is None:
            stamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            counter = 0
            while True:
                folder = root / (stamp if not counter else f"{stamp}_{counter}")
                try:
                    folder.mkdir()
                    group["folder"] = folder
                    break
                except FileExistsError:
                    counter += 1
        folder = group["folder"]
        for result in group["results"]:
            if not result.get("saved") or result.get("output_dir") == str(folder):
                continue
            source = Path(result["files"]["txt"])
            # Move only files registered by this task, preserving their contents.
            destination = _write_unique(folder, source.name, source.read_text(encoding="utf-8"))
            try:
                source.unlink()
            except Exception:
                destination.unlink(missing_ok=True)
                raise
            result.update(output_dir=str(folder), files={"txt": str(destination)})


def save_transcript(result: dict, client_id: str, locale: str = "zh-CN", group_id: str = "") -> dict:
    with EXPORT_LOCK:
        return _save_transcript(result, client_id, locale, group_id)


def _save_transcript(result: dict, client_id: str, locale: str, group_id: str) -> dict:
    """Keep recognition results usable even when the output folder is unavailable."""
    if result.get("saved"):
        return result
    english = str(locale).startswith("en")
    title = result.get("title") or ("Transcript" if english else "转写文稿")
    result["export_text"] = f"{'Title' if english else '标题'}: {title}\n\n{'Transcript' if english else '字幕'}:\n{result.get('text', '')}"
    stem = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', title).rstrip('. ')[:60] or 'transcript'
    result.setdefault("export_name", f"{stem}_{datetime.now():%Y-%m-%d_%H-%M-%S}.txt")
    result["saved"] = False
    try:
        if group_id:
            group = _group(client_id, group_id)
            if not any(entry is result for entry in group["results"]):
                group["results"].append(result)
            folder = group["folder"] or group["root"]
        else:
            folder = normalize_output_dir(get_user_settings(client_id).get("default_download_dir"), client_id)
        folder.mkdir(parents=True, exist_ok=True)
        path = _write_unique(folder, result["export_name"], result["export_text"])
        result.update(saved=True, save_error="", output_dir=str(folder), files={"txt": str(path)})
    except Exception as error:
        result["save_error"] = str(error)
    return result
