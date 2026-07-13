# Media Parser

Local-first desktop software for video parsing, podcast parsing, single-file media downloads, transcription, and structured note workflows.

Current downloadable release: `v0.2.5`

- GitHub Release: <https://github.com/JacoryCYJin/media-parser/releases/tag/v0.2.5>
- User download: `Media Parser-0.2.5-arm64.dmg`
- Platform: macOS Apple Silicon pre-release

## What It Does

- Parse video links and inspect available media formats.
- Parse podcast RSS/audio sources and collect episode metadata.
- Download single media files to a user-selected local folder.
- Manage cookie/platform login settings locally.
- Prepare local transcription and structured note workflows.
- Check for new releases from the About settings panel.

The app packages `ffmpeg` and `yt-dlp`, so users do not need to install those tools manually for the packaged macOS build.

## Local Data

Release packages must not include local runtime data.

The following stay on the user's machine and are not uploaded or bundled into GitHub Releases:

- `.env`
- cookies and platform login data
- user settings
- downloaded media
- user-selected download folders
- local runtime caches and logs

Packaged builds write media-core runtime data under Electron `app.getPath("userData")`.

## Stack

- Desktop shell: Electron
- Frontend: Vue 3 + Vite + Tailwind CSS
- Desktop bridge: Electron main process + preload IPC
- Media core: Python + FastAPI
- Media tooling: yt-dlp, FFmpeg, faster-whisper
- Packaging: electron-builder + PyInstaller

See [docs/architecture.md](docs/architecture.md) for the target architecture, [docs/versioning.md](docs/versioning.md) for version rules, and [docs/release-checklist.md](docs/release-checklist.md) for the release workflow.

## Local Development

Install desktop dependencies:

```bash
cd apps/desktop
npm install
```

Install Python media core dependencies:

```bash
cd services/media-core
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

Run the desktop app:

```bash
cd apps/desktop
npm run dev
```

The desktop app starts the Python media core through Electron when the UI requests it. The media core defaults to `127.0.0.1:5011`.

## Validation

```bash
cd apps/desktop
npm run typecheck
npm run build

cd ../../services/media-core
.venv/bin/python -m compileall app
```

## Release Build

```bash
cd apps/desktop
npm run dist:mac
```

Each macOS build writes to:

```text
apps/desktop/release/mac-<version>-<timestamp>/
```

The cleaned release folder keeps:

- `.dmg` for user downloads
- `.zip`, `.zip.blockmap`, and `latest-mac.yml` for the updater

The current first public pre-release is `v0.2.5`.
