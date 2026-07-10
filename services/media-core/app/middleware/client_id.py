from fastapi import Request
from fastapi.responses import JSONResponse

from app.services.user_data import ensure_user_dirs, sanitize_client_id


async def client_id_middleware(request: Request, call_next):
    if request.url.path == "/api/thumbnail":
        return await call_next(request)

    client_id = sanitize_client_id(request.headers.get("x-client-id"))
    if not client_id:
        return JSONResponse({"error": "缺少或无效的 x-client-id 请求头"}, status_code=400)

    request.state.client_id = client_id
    ensure_user_dirs(client_id)
    return await call_next(request)
