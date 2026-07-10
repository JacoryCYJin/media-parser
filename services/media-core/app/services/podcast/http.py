import urllib.request
import re


DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)


def fetch_bytes(url: str, accept: str = "*/*", timeout: int = 30) -> tuple[bytes, dict]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": DEFAULT_USER_AGENT,
            "Accept": accept,
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        headers = dict(response.headers.items())
        return response.read(), headers


def fetch_text(url: str, accept: str = "*/*", timeout: int = 30) -> tuple[str, dict]:
    body, headers = fetch_bytes(url, accept=accept, timeout=timeout)
    content_type = headers.get("Content-Type") or headers.get("content-type") or ""
    charset = "utf-8"
    for item in content_type.split(";"):
        item = item.strip()
        if item.lower().startswith("charset="):
            charset = item.split("=", 1)[1].strip() or "utf-8"
            break
    return body.decode(charset, errors="replace"), headers


def head_url(url: str, timeout: int = 15) -> dict:
    request = urllib.request.Request(
        url,
        method="HEAD",
        headers={
            "User-Agent": DEFAULT_USER_AGENT,
            "Accept": "*/*",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return dict(response.headers.items())


def range_headers(url: str, timeout: int = 15) -> dict:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": DEFAULT_USER_AGENT,
            "Accept": "*/*",
            "Range": "bytes=0-0",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return dict(response.headers.items())


def sanitize_headers(headers: dict | None) -> dict:
    sanitized = {}
    blocked = ("cookie", "authorization", "auth", "token", "secret", "credential", "key")
    for key, value in (headers or {}).items():
        normalized_key = str(key or "").strip()
        if not normalized_key:
            continue
        if any(part in normalized_key.lower() for part in blocked):
            continue
        sanitized[normalized_key] = str(value)
    return sanitized


def parse_content_length_from_headers(headers: dict | None) -> int | None:
    headers = headers or {}
    content_length = headers.get("Content-Length") or headers.get("content-length")
    if content_length and str(content_length).isdigit():
        length = int(content_length)
        if length > 1:
            return length

    content_range = headers.get("Content-Range") or headers.get("content-range") or ""
    match = re.search(r"/(\d+)$", content_range)
    if match:
        return int(match.group(1))
    return None


def probe_content_length(url: str) -> int | None:
    for fetcher in [head_url, range_headers]:
        try:
            headers = fetcher(url)
            length = parse_content_length_from_headers(headers)
            if length:
                return length
        except Exception:
            continue
    return None
