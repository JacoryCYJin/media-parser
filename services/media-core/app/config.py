import os
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#"):
            continue
        if "=" not in trimmed:
            continue
        key, raw_value = trimmed.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue
        os.environ[key] = raw_value.strip().strip("\"'")


load_env_file(BACKEND_ROOT / ".env")

PORT = int(os.environ.get("MEDIA_CORE_PORT", "5011"))
DATA_DIR = BACKEND_ROOT / "data"
USERS_DIR = DATA_DIR / "users"
DOWNLOADS_ROOT_DIR = BACKEND_ROOT / "downloads"
SYSTEM_DOWNLOADS_DIR = Path.home() / "Downloads"
LOCAL_STT_MODEL = os.environ.get("LOCAL_STT_MODEL", "small").strip() or "small"
LOCAL_STT_DEVICE = os.environ.get("LOCAL_STT_DEVICE", "cpu").strip() or "cpu"
LOCAL_STT_COMPUTE_TYPE = os.environ.get("LOCAL_STT_COMPUTE_TYPE", "int8").strip() or "int8"
LOCAL_STT_MAX_AUDIO_BYTES = int(os.environ.get("LOCAL_STT_MAX_AUDIO_BYTES", str(300 * 1024 * 1024)))

PREFERRED_YTDLP_BINS = [
    os.environ.get("YTDLP_BIN"),
    "/opt/homebrew/bin/yt-dlp",
    "/usr/local/bin/yt-dlp",
    "yt-dlp",
]

YTDLP_BIN = next(
    (binary for binary in PREFERRED_YTDLP_BINS if binary and (binary == "yt-dlp" or Path(binary).exists())),
    "yt-dlp",
)

SILICONFLOW_BASE_URL = os.environ.get("SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1").rstrip("/")
SILICONFLOW_MODEL = os.environ.get("SILICONFLOW_MODEL", "").strip()
SILICONFLOW_API_KEY = os.environ.get("SILICONFLOW_API_KEY", "").strip()
SILICONFLOW_MOCK_OUTLINE = os.environ.get("SILICONFLOW_MOCK_OUTLINE", "").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def ensure_runtime_dirs() -> None:
    USERS_DIR.mkdir(parents=True, exist_ok=True)
    DOWNLOADS_ROOT_DIR.mkdir(parents=True, exist_ok=True)
    SYSTEM_DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
