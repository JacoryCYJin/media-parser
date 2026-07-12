# Versioning

Media Parser uses Semantic Versioning in the `x.y.z` format.

## Version Segments

`x.0.0` is the major version.

Update the major version when the app architecture or core capability changes in a way that may break compatibility with existing local data, configuration, automation, or packaged releases.

Examples:

- Replacing the desktop runtime or media-core service contract.
- Changing persisted download task data in a non-compatible way.
- Removing or replacing a core capability such as video parsing or local download management.

`0.x.0` is the minor version.

Update the minor version when adding a meaningful user-facing capability while keeping existing behavior compatible.

Examples:

- Making the download list fully usable.
- Adding podcast transcription.
- Adding batch download tasks.
- Adding a new supported media platform or a new parser mode.

`0.1.x` is the patch version.

Update the patch version for fixes and small improvements that do not change the main capability set.

Examples:

- UI adjustments and copy changes.
- Bug fixes.
- Compatibility fixes.
- Small performance improvements.
- Packaging or build fixes that do not change user-facing behavior.

## Current Version

The current desktop app version is defined in `apps/desktop/package.json`.

When the version changes, keep these surfaces aligned:

- `apps/desktop/package.json`
- Desktop sidebar version label
- Release notes or GitHub Release title, when publishing a release

## Pre-Release Check

Before publishing a release, confirm:

- The version segment matches the actual change scope.
- Local runtime data, downloads, cookies, and environment files are not included.
- Desktop validation passes with `cd apps/desktop && npm run build`.
- Media-core validation passes when Python service code changed: `cd services/media-core && .venv/bin/python -m compileall app`.

## Downloadable Release

The first downloadable desktop release line starts at `v0.2.5`.

Release builds must not package local runtime data:

- `services/media-core/.env`
- `services/media-core/.venv`
- `services/media-core/data/`
- `services/media-core/downloads/`
- cookies, generated media files, logs, and local caches

The packaged app must include runtime media tools so users do not need to install them manually:

- `yt-dlp` is prepared by `apps/desktop/scripts/prepare-release-tools.mjs`.
- `ffmpeg` is copied from the `ffmpeg-static` package by the same script.
- Electron injects the packaged `bin/` directory into `PATH` and passes `YTDLP_BIN` to the Python media core.

The packaged Python media core is built with PyInstaller:

```bash
cd services/media-core
.venv/bin/python -m pip install -r requirements.txt

cd ../../apps/desktop
npm run dist:mac
```

The first update path is a checked update prompt:

- GitHub Releases is the update source.
- The app checks for updates after launch in packaged builds.
- When a newer version exists, the app opens the GitHub Releases page for manual download.
- Fully automatic in-app replacement can be added later after code signing and notarization are settled.
