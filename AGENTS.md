# AGENTS.md

This is the local-first media parser software repository inside the Jacory Space workspace.

Before working here, follow the workspace rules in `../AGENTS.md` and the shared rules under `../.agents/` and `../.cursor/`.

## Repository

- Keep this repository focused on downloadable/local software.
- Do not depend on the hosted `site/` runtime unless a cross-repository integration is explicitly planned.
- Keep generated downloads, local data, credentials, cookies, and build artifacts out of Git.
- Target desktop stack: Electron + Vue 3 + Vite + Tailwind CSS.
- Target media stack: Python media core with yt-dlp, FFmpeg, and faster-whisper.
- Preserve behavior while migrating from `../site/`: copy first, then refactor after parity is verified.
- Keep Electron renderer, preload, main process, and Python media core responsibilities separate.
