# Architecture

## Decision

Media Parser uses Electron as the final desktop framework.

The target stack is:

```text
Electron + Vue 3 + Vite + Tailwind CSS
Python media core
yt-dlp + FFmpeg + faster-whisper
```

This is a local desktop media task orchestrator. Its main complexity is not the UI shell; it is managing Python tasks, external binaries, downloads, logs, cancellation, temporary files, and application shutdown behavior.

## Why Electron

Electron fits the process model directly:

```text
Vue renderer
  -> preload IPC API
  -> Electron main process
  -> Node child_process
  -> Python / yt-dlp / FFmpeg / faster-whisper
  -> stdout / stderr / progress events
  -> Electron main process
  -> renderer UI
```

The Electron main process can own:

- App lifecycle and windows
- Python service or CLI startup
- Child process tracking and cancellation
- stdout/stderr log streaming
- Download directory selection
- Cache and temporary file cleanup
- Local settings and secure configuration
- Release packaging resources

Tauri remains viable, but it adds Rust, sidecar naming, permissions, and platform-specific WebView behavior around a Python-heavy core. For this project, Electron's direct Node process-management layer is the better tradeoff.

## Repository Shape

Target structure:

```text
media-parser/
  apps/
    desktop/
      src/
        main/
        preload/
        renderer/
      electron.vite.config.ts

  services/
    media-core/

  resources/
    ffmpeg/
    binaries/

  docs/
    architecture.md
    migration.md
```

## Responsibilities

### Renderer

The renderer is the Vue application.

It should only handle:

- Screens and navigation
- Forms and user input
- Task status display
- Logs and progress UI
- Local UI state

It should not call Node APIs, Python, FFmpeg, or yt-dlp directly.

### Preload

The preload layer exposes a small typed API to the renderer.

It should only expose intentional capabilities such as:

- `parseVideo(input)`
- `parsePodcast(input)`
- `startDownload(task)`
- `cancelTask(taskId)`
- `selectDirectory()`
- `openPath(path)`
- `onTaskEvent(callback)`

### Main Process

The main process owns desktop and operating-system work.

It should handle:

- IPC request validation
- Task lifecycle
- Child process spawning
- Python service startup or Python CLI execution
- Streaming logs and progress events
- File picker and filesystem actions
- App shutdown cleanup

### Media Core

The Python media core owns media behavior.

It should handle:

- URL parsing and platform resolution
- yt-dlp integration
- FFmpeg integration
- Audio extraction
- Transcript fetching
- faster-whisper transcription
- Prompt-based outline and blog draft generation

The first implementation may copy the existing FastAPI backend from `../site/`. After parity is reached, the media core can be simplified into a CLI, long-running local API, or hybrid worker model.

## First Milestone

The first milestone is functional parity, not architectural purity.

Rules:

- Do not move code out of `site/`; copy it.
- Keep the existing site working.
- Keep media behavior stable before refactoring internals.
- Prefer explicit process boundaries over clever shared abstractions.
- Add packaging only after local development flow is reliable.
