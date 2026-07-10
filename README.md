# Media Parser

Local-first media parsing software for video, podcast, transcript, and blog drafting workflows.

This repository is being split out from Jacory Space so releases can be published as downloadable software instead of a hosted website tool.

## Target Stack

- Desktop shell: Electron
- Frontend: Vue 3 + Vite + Tailwind CSS
- Desktop bridge: Electron main process + preload IPC
- Media core: Python
- Media tooling: yt-dlp, FFmpeg, faster-whisper

See [docs/architecture.md](docs/architecture.md) for the target architecture and [docs/migration.md](docs/migration.md) for the migration plan from `site/`.

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

Validation:

```bash
cd apps/desktop
npm run typecheck
npm run build

cd ../../services/media-core
.venv/bin/python -m compileall app
```
