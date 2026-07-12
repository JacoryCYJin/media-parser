import json
import re
from pathlib import Path

from app.config import BACKEND_ROOT, DOWNLOADS_ROOT_DIR, SYSTEM_DOWNLOADS_DIR, USERS_DIR


COOKIE_MODES = {"manual", "browser", "none"}
BROWSER_COOKIE_SOURCES = {"chrome", "safari", "firefox", "edge"}
MODEL_PROVIDERS = {"api"}


DEFAULT_SETTINGS = {
    "cookie_mode": "browser",
    "browser_cookie_source": "chrome",
    "model_provider": "api",
    "analysis_base_url": "https://api.siliconflow.cn/v1",
    "analysis_api_key": "",
    "analysis_model": "",
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


def normalize_settings(parsed: dict | None, client_id: str) -> dict:
    source = parsed if isinstance(parsed, dict) else {}
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
    user_settings_path(client_id).write_text(json.dumps(settings, ensure_ascii=False, indent=2), encoding="utf-8")
