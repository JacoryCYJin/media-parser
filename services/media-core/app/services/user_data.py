import json
import re
from uuid import uuid4
from pathlib import Path

from app.config import (
    BACKEND_ROOT,
    DEV_MODEL_2_API_KEY,
    DEV_MODEL_2_BASE_URL,
    DEV_MODEL_2_CONNECTION_NAME,
    DEV_MODEL_2_NAME,
    DEV_MODEL_API_KEY,
    DEV_MODEL_BASE_URL,
    DEV_MODEL_CONNECTION_NAME,
    DEV_MODEL_NAME,
    DOWNLOADS_ROOT_DIR,
    SYSTEM_DOWNLOADS_DIR,
    USERS_DIR,
)


COOKIE_MODES = {"manual", "browser", "none"}
BROWSER_COOKIE_SOURCES = {"chrome", "safari", "firefox", "edge"}
MODEL_PROVIDERS = {"api"}
MODEL_CONNECTION_TYPES = {"openai-compatible"}


DEFAULT_SETTINGS = {
    "cookie_mode": "browser",
    "browser_cookie_source": "chrome",
    "model_provider": "api",
    "analysis_base_url": "https://api.siliconflow.cn/v1",
    "analysis_api_key": "",
    "analysis_model": "",
    "model_connections": [],
    "active_model_connection_id": "",
}


def sanitize_platform(platform: str | None) -> str:
    if not platform:
        return ""
    normalized = str(platform).strip().lower()
    if not re.match(r"^[a-z0-9_-]+$", normalized):
        return ""
    return normalized


def sanitize_client_id(client_id: str | None) -> str:
    if not client_id:
        return ""
    normalized = str(client_id).strip().lower()
    if not re.match(r"^[a-z0-9_-]{8,64}$", normalized):
        return ""
    return normalized


def user_home_dir(client_id: str) -> Path:
    return USERS_DIR / client_id


def user_cookies_dir(client_id: str) -> Path:
    return user_home_dir(client_id) / "cookies"


def user_settings_path(client_id: str) -> Path:
    return user_home_dir(client_id) / "settings.json"


def user_default_downloads_dir(_client_id: str) -> Path:
    return SYSTEM_DOWNLOADS_DIR


def cookies_path_for(client_id: str, platform: str) -> Path:
    return user_cookies_dir(client_id) / f"{platform}.txt"


def ensure_user_dirs(client_id: str) -> None:
    user_home_dir(client_id).mkdir(parents=True, exist_ok=True)
    user_cookies_dir(client_id).mkdir(parents=True, exist_ok=True)


def normalize_output_dir(dir_input: str | None, client_id: str) -> Path:
    raw = str(dir_input or "").strip()
    if not raw:
        return user_default_downloads_dir(client_id)
    path = Path(raw).expanduser()
    if path.is_absolute():
        return path.resolve()
    return (BACKEND_ROOT / path).resolve()


def normalize_cookie_mode(mode: str | None) -> str:
    normalized = str(mode or "").strip().lower()
    return normalized if normalized in COOKIE_MODES else "browser"


def normalize_browser_cookie_source(source: str | None) -> str:
    normalized = str(source or "").strip().lower()
    return normalized if normalized in BROWSER_COOKIE_SOURCES else "chrome"


def normalize_model_provider(provider: str | None) -> str:
    normalized = str(provider or "").strip().lower()
    return normalized if normalized in MODEL_PROVIDERS else "api"


def normalize_model_connection_type(connection_type: str | None) -> str:
    normalized = str(connection_type or "").strip().lower()
    return normalized if normalized in MODEL_CONNECTION_TYPES else "openai-compatible"


def normalize_model_connection(raw: dict | None) -> dict | None:
    source = raw if isinstance(raw, dict) else {}
    base_url = str(source.get("base_url") or source.get("baseUrl") or "").strip().rstrip("/")
    api_key = str(source.get("api_key") or source.get("apiKey") or "").strip()
    model = str(source.get("model") or "").strip()
    name = str(source.get("name") or "").strip()
    connection_id = str(source.get("id") or "").strip()

    if not any([base_url, api_key, model, name]):
        return None
    if not connection_id:
        connection_id = f"model-{uuid4().hex[:12]}"
    if not name:
        name = "API"

    return {
        "id": connection_id,
        "name": name,
        "type": normalize_model_connection_type(source.get("type")),
        "base_url": base_url or DEFAULT_SETTINGS["analysis_base_url"],
        "api_key": api_key,
        "model": model,
    }


def legacy_model_connection(source: dict) -> dict | None:
    if "model_connections" in source:
        return None

    base_url = str(source.get("analysis_base_url") or DEFAULT_SETTINGS["analysis_base_url"]).strip().rstrip("/")
    api_key = str(source.get("analysis_api_key") or "").strip()
    model = str(source.get("analysis_model") or "").strip()
    has_custom_base_url = "analysis_base_url" in source and base_url != DEFAULT_SETTINGS["analysis_base_url"]
    if not any([api_key, model, has_custom_base_url]):
        return None

    return normalize_model_connection(
        {
            "id": "legacy-analysis-api",
            "name": "默认 API",
            "type": "openai-compatible",
            "base_url": base_url,
            "api_key": api_key,
            "model": model,
        }
    )


def dev_model_connection(
    connection_id: str,
    name: str,
    base_url: str,
    api_key: str,
    model: str,
) -> dict | None:
    if not all([base_url, api_key, model]):
        return None

    return normalize_model_connection(
        {
            "id": connection_id,
            "name": name,
            "type": "openai-compatible",
            "base_url": base_url,
            "api_key": api_key,
            "model": model,
        }
    )


def dev_model_connections() -> list[dict]:
    connections = [
        dev_model_connection(
            "dev-default-api",
            DEV_MODEL_CONNECTION_NAME,
            DEV_MODEL_BASE_URL,
            DEV_MODEL_API_KEY,
            DEV_MODEL_NAME,
        ),
        dev_model_connection(
            "dev-secondary-api",
            DEV_MODEL_2_CONNECTION_NAME,
            DEV_MODEL_2_BASE_URL,
            DEV_MODEL_2_API_KEY,
            DEV_MODEL_2_NAME,
        ),
    ]
    return [connection for connection in connections if connection]


def normalize_model_connections(source: dict) -> tuple[list[dict], str]:
    if "model_connections" in source:
        raw_connections = source.get("model_connections") if isinstance(source.get("model_connections"), list) else []
        connections = [connection for item in raw_connections if (connection := normalize_model_connection(item))]
        existing_ids = {connection["id"] for connection in connections}
        connections.extend(connection for connection in dev_model_connections() if connection["id"] not in existing_ids)
    else:
        legacy = legacy_model_connection(source)
        connections = [legacy] if legacy else []
        if not connections:
            connections = dev_model_connections()

    seen_ids = set()
    unique_connections = []
    for connection in connections:
        connection_id = connection["id"]
        if connection_id in seen_ids:
            connection["id"] = f"model-{uuid4().hex[:12]}"
        seen_ids.add(connection["id"])
        unique_connections.append(connection)

    requested_active_id = str(source.get("active_model_connection_id") or "").strip()
    active_id = requested_active_id if any(item["id"] == requested_active_id for item in unique_connections) else ""
    if not active_id and unique_connections:
        active_id = unique_connections[0]["id"]
    return unique_connections, active_id


def active_model_connection(settings: dict) -> dict | None:
    connections = settings.get("model_connections") if isinstance(settings.get("model_connections"), list) else []
    active_id = str(settings.get("active_model_connection_id") or "").strip()
    if active_id:
        for connection in connections:
            if connection.get("id") == active_id:
                return connection
    return connections[0] if connections else None


def normalize_settings(parsed: dict | None, client_id: str) -> dict:
    source = parsed if isinstance(parsed, dict) else {}
    model_connections, active_model_connection_id = normalize_model_connections(source)
    selected_connection = active_model_connection(
        {
            "model_connections": model_connections,
            "active_model_connection_id": active_model_connection_id,
        }
    )
    return {
        "default_download_dir": str(normalize_output_dir(source.get("default_download_dir"), client_id)),
        "cookie_mode": normalize_cookie_mode(source.get("cookie_mode", DEFAULT_SETTINGS["cookie_mode"])),
        "browser_cookie_source": normalize_browser_cookie_source(
            source.get("browser_cookie_source", DEFAULT_SETTINGS["browser_cookie_source"])
        ),
        "model_provider": normalize_model_provider(source.get("model_provider", DEFAULT_SETTINGS["model_provider"])),
        "analysis_base_url": str(source.get("analysis_base_url") or DEFAULT_SETTINGS["analysis_base_url"]).strip()
        or DEFAULT_SETTINGS["analysis_base_url"],
        "analysis_api_key": str(source.get("analysis_api_key") or "").strip(),
        "analysis_model": str(source.get("analysis_model") or DEFAULT_SETTINGS["analysis_model"]).strip(),
        "model_connections": model_connections,
        "active_model_connection_id": active_model_connection_id,
        "active_model_connection": selected_connection,
    }


def get_user_settings(client_id: str) -> dict:
    ensure_user_dirs(client_id)
    settings_file = user_settings_path(client_id)

    if not settings_file.exists():
        return normalize_settings({"default_download_dir": str(user_default_downloads_dir(client_id))}, client_id)

    try:
        parsed = json.loads(settings_file.read_text(encoding="utf-8"))
        return normalize_settings(parsed, client_id)
    except Exception:
        return normalize_settings({"default_download_dir": str(user_default_downloads_dir(client_id))}, client_id)


def save_user_settings(client_id: str, settings: dict) -> None:
    ensure_user_dirs(client_id)
    persisted_settings = dict(settings)
    persisted_settings.pop("active_model_connection", None)
    user_settings_path(client_id).write_text(json.dumps(persisted_settings, ensure_ascii=False, indent=2), encoding="utf-8")
