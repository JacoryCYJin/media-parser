import argparse
import os
import signal
import sys

import uvicorn

from app.config import PORT


def daemonize() -> None:
    if os.fork() > 0:
        sys.exit(0)

    os.setsid()
    signal.signal(signal.SIGHUP, signal.SIG_IGN)

    if os.fork() > 0:
        sys.exit(0)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--daemon", action="store_true")
    args = parser.parse_args()

    if args.daemon:
        daemonize()

    uvicorn.run(
        "app.main:app",
        host=os.environ.get("MEDIA_CORE_HOST", "127.0.0.1"),
        port=PORT,
        log_level="info",
    )


if __name__ == "__main__":
    main()
