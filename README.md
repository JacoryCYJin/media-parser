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
