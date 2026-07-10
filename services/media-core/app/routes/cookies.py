from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.services.user_data import cookies_path_for, sanitize_platform, user_cookies_dir

router = APIRouter()


@router.get("/cookies")
async def list_cookies(request: Request):
    cookie_dir = user_cookies_dir(request.state.client_id)
    files = [path for path in cookie_dir.iterdir() if path.is_file() and path.suffix == ".txt"]
    platforms = {}

    for file_path in files:
        platforms[file_path.stem] = {"has_cookies": True}

    platforms.setdefault("youtube", {"has_cookies": False})
    platforms.setdefault("bilibili", {"has_cookies": False})

    custom_platforms = [platform for platform in platforms if platform not in {"youtube", "bilibili"}]
    return {"platforms": platforms, "custom_platforms": custom_platforms}


@router.get("/cookies/{platform}")
async def get_platform_cookies(platform: str, request: Request):
    normalized = sanitize_platform(platform)
    if not normalized:
        return JSONResponse({"error": "无效的平台名"}, status_code=400)

    cookie_path = cookies_path_for(request.state.client_id, normalized)
    if not cookie_path.exists():
        return JSONResponse({"error": "该平台未设置 cookies"}, status_code=404)

    return {"platform": normalized, "cookies": cookie_path.read_text(encoding="utf-8")}


@router.post("/cookies")
async def save_platform_cookies(request: Request):
    body = await request.json()
    platform = sanitize_platform(body.get("platform"))
    cookies = str(body.get("cookies") or "")

    if not platform:
        return JSONResponse({"error": "无效的平台名"}, status_code=400)
    if not cookies.strip():
        return JSONResponse({"error": "cookies 内容不能为空"}, status_code=400)

    cookies_path_for(request.state.client_id, platform).write_text(cookies, encoding="utf-8")
    return {"message": f"{platform} cookies 保存成功"}


@router.delete("/cookies/{platform}")
async def delete_platform_cookies(platform: str, request: Request):
    normalized = sanitize_platform(platform)
    if not normalized:
        return JSONResponse({"error": "无效的平台名"}, status_code=400)

    cookie_path = cookies_path_for(request.state.client_id, normalized)
    if cookie_path.exists():
        cookie_path.unlink()

    return {"message": f"{normalized} cookies 已删除"}
