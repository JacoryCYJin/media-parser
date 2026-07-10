import json
import re
from pathlib import Path

from app.config import BACKEND_ROOT, DOWNLOADS_ROOT_DIR, SYSTEM_DOWNLOADS_DIR, USERS_DIR


COOKIE_MODES = {"manual", "browser", "none"}
BROWSER_COOKIE_SOURCES = {"chrome", "safari", "firefox", "edge"}


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


def get_user_settings(client_id: str) -> dict:
    ensure_user_dirs(client_id)
    settings_file = user_settings_path(client_id)

    if not settings_file.exists():
        return {
            "default_download_dir": str(user_default_downloads_dir(client_id)),
            "cookie_mode": "browser",
            "browser_cookie_source": "chrome",
        }

    try:
        parsed = json.loads(settings_file.read_text(encoding="utf-8"))
        return {
            "default_download_dir": str(normalize_output_dir(parsed.get("default_download_dir"), client_id)),
            "cookie_mode": normalize_cookie_mode(parsed.get("cookie_mode")),
            "browser_cookie_source": normalize_browser_cookie_source(parsed.get("browser_cookie_source")),
        }
    except Exception:
        return {
            "default_download_dir": str(user_default_downloads_dir(client_id)),
            "cookie_mode": "browser",
            "browser_cookie_source": "chrome",
        }


def save_user_settings(client_id: str, settings: dict) -> None:
    ensure_user_dirs(client_id)
    user_settings_path(client_id).write_text(json.dumps(settings, ensure_ascii=False, indent=2), encoding="utf-8")
