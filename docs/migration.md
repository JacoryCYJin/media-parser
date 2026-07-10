# Migration Plan

## Goal

Move the media parsing experience from a hosted site tool into a downloadable desktop app while keeping `../site/` unchanged until parity is verified.

## Phase 1: Desktop Foundation

- Create `apps/desktop` with Electron + Vue 3 + Vite + Tailwind CSS.
- Use `electron-vite` for main, preload, and renderer builds.
- Keep the default electron-vite process split: `src/main`, `src/preload`, and `src/renderer`.
- Add a minimal shell with task navigation:
  - Video parsing
  - Podcast parsing
  - Transcript / outline
  - Blog draft generation
- Define preload IPC contracts before wiring real media work.
- First IPC probe: `window.mediaParser.health()` from renderer to preload to Electron main.

## Phase 2: Media Core Copy

- Copy the current media backend from `../site/jacory-space-backend/media-backend` into `services/media-core`.
- Keep the Python behavior as close as possible to the source version.
- Run the copied backend locally on a separate port during development.
- Do not remove or redirect `site/` functionality during this phase.
- Default media-core port: `5011`.
- Electron main process owns startup and health checks through `mediaCoreService`.
- Renderer calls media operations through `window.mediaParser`, not direct HTTP.

## Phase 3: Process Orchestration

- Move task orchestration into Electron main process.
- Start, stop, and monitor Python tasks from Electron.
- Stream stdout, stderr, progress, and terminal events to the renderer.
- Add task cancellation and app shutdown cleanup.
- Add download directory selection and open-in-folder behavior.

## Phase 4: UI Parity

- Copy the existing parser UI patterns from `../site/jacory-space-frontend`.
- Adapt API calls to the Electron preload API.
- Preserve existing behavior before redesigning screens.
- Keep the renderer free of Node and direct filesystem access.

## Phase 5: Packaging

- Add electron-builder.
- Package platform resources:
  - Python runtime or packaged Python executable
  - yt-dlp
  - FFmpeg
  - faster-whisper dependencies
- Add GitHub Release workflow after local packaging works.

## Phase 6: Site Integration

- After the desktop app is usable, update `../site/` tool pages into software introduction pages.
- Link to the `media-parser` repository and latest release.
- Decide whether the hosted parser remains available or becomes documentation only.
