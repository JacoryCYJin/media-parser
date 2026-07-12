import platform
import subprocess
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.services.user_data import (
    get_user_settings,
    normalize_browser_cookie_source,
    normalize_cookie_mode,
    normalize_model_provider,
    normalize_output_dir,
    save_user_settings,
)

router = APIRouter()


def run_macos_folder_dialog() -> JSONResponse | dict:
    script = 'POSIX path of (choose folder with prompt "请选择下载文件夹")'
    completed = subprocess.run(
        ["osascript", "-e", script],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        err = completed.stderr.strip()
        if "User canceled" in err:
            return {"cancelled": True}
        return JSONResponse({"error": f"选取目录失败: {err or 'unknown error'}"}, status_code=500)

    selected = completed.stdout.strip()
    if not selected:
        return {"cancelled": True}
    return {"cancelled": False, "path": str(Path(selected).resolve())}


def run_windows_folder_dialog() -> JSONResponse | dict:
    script = r'''
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "请选择下载文件夹"
$dialog.ShowNewFolderButton = $true
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dialog.SelectedPath
  exit 0
}
exit 2
'''
    completed = subprocess.run(
        ["powershell", "-NoProfile", "-STA", "-Command", script],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode == 2:
        return {"cancelled": True}
    if completed.returncode != 0:
        err = completed.stderr.strip()
        return JSONResponse({"error": f"选取目录失败: {err or 'unknown error'}"}, status_code=500)

    selected = completed.stdout.strip()
    if not selected:
        return {"cancelled": True}
    return {"cancelled": False, "path": str(Path(selected).resolve())}


@router.get("/settings")
async def get_settings(request: Request):
    return get_user_settings(request.state.client_id)


@router.post("/settings")
async def save_settings(request: Request):
    body = await request.json()
    current_settings = get_user_settings(request.state.client_id)
    default_dir = normalize_output_dir(
        body.get("default_download_dir", current_settings["default_download_dir"]),
        request.state.client_id,
    )
    default_dir.mkdir(parents=True, exist_ok=True)

    settings = {
        **current_settings,
        "default_download_dir": str(default_dir),
        "cookie_mode": normalize_cookie_mode(body.get("cookie_mode", current_settings["cookie_mode"])),
        "browser_cookie_source": normalize_browser_cookie_source(
            body.get("browser_cookie_source", current_settings["browser_cookie_source"])
        ),
        "model_provider": normalize_model_provider(body.get("model_provider", current_settings["model_provider"])),
        "analysis_base_url": str(
            body.get("analysis_base_url", current_settings["analysis_base_url"]) or "https://api.siliconflow.cn/v1"
        ).strip()
        or "https://api.siliconflow.cn/v1",
        "analysis_api_key": str(body.get("analysis_api_key", current_settings["analysis_api_key"]) or "").strip(),
        "analysis_model": str(body.get("analysis_model", current_settings["analysis_model"]) or "").strip(),
    }
    save_user_settings(request.state.client_id, settings)
    return {"message": "默认下载目录保存成功", **settings}


@router.post("/folder-dialog")
async def folder_dialog():
    try:
        system = platform.system().lower()
        if system == "darwin":
            return run_macos_folder_dialog()
        if system == "windows":
            return run_windows_folder_dialog()
        return JSONResponse({"error": "当前系统暂不支持目录选择，请手动填写路径"}, status_code=501)
    except Exception as error:
        return JSONResponse({"error": f"打开目录选择失败: {error}"}, status_code=500)
