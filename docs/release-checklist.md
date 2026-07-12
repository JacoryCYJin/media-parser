# Release Checklist

## Scope

- Current release line: `v0.2.5`.
- Target package: macOS downloadable app.
- Download list page is not part of this release.
- Video parsing, podcast parsing, settings, cookies, and single-file downloads remain in scope.

## Local Data Safety

Confirm the release package does not include:

- `services/media-core/.env`
- `services/media-core/.venv`
- `services/media-core/data/`
- `services/media-core/downloads/`
- cookies, logs, generated media, or local caches

Packaged runtime data is written under Electron `app.getPath("userData")`.

## Build

```bash
cd services/media-core
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m compileall app

cd ../../apps/desktop
npm install
npm run typecheck
npm run dist:mac
```

`npm run dist:mac` performs these steps:

- builds `services/media-core` with PyInstaller
- prepares packaged `ffmpeg` and `yt-dlp`
- builds the Electron app
- creates macOS `dmg` and `zip` artifacts
- removes intermediate builder folders and debug files

Each run writes to a timestamped folder:

```text
apps/desktop/release/mac-<version>-<timestamp>/
```

Example:

```text
apps/desktop/release/mac-0.2.5-20260712T083000/
```

If a package is worth keeping, rename that folder manually, for example from `mac-0.2.5-20260712T083000` to `mac-0.2.5`.
Do not delete the whole `release/` directory when removing a bad package; delete only the specific timestamped folder.

The cleaned release folder should contain only:

```text
Media Parser-<version>-arm64.dmg
Media Parser-<version>-arm64-mac.zip
Media Parser-<version>-arm64-mac.zip.blockmap
latest-mac.yml
```

## Manual QA

- Open the packaged app, not the dev app.
- Confirm the sidebar shows `v0.2.5`.
- Confirm video parsing works.
- Confirm podcast parsing works.
- Confirm cookies settings can be opened and saved.
- Confirm default download directory can be selected.
- Confirm a single video/audio download works without installing ffmpeg or yt-dlp manually.
- Confirm downloaded files go to the selected user directory.
- Confirm quitting the app stops the media-core process.
- Confirm the independent download list page is not visible in the sidebar.

## GitHub Release

- Tag: `v0.2.5`
- Title: `Media Parser v0.2.5`
- Mark as pre-release for the first downloadable package.
- Upload artifacts from the selected folder under `apps/desktop/release/`.
- Users should download the `.dmg`.
- The `.zip`, `.blockmap`, and `latest-mac.yml` files are for the updater.

## Release Notes Draft

```markdown
## Media Parser v0.2.5

First downloadable desktop package.

### Included

- Video parsing
- Podcast parsing
- Cookie settings
- Download directory settings
- Single-file media downloads
- Packaged ffmpeg and yt-dlp
- GitHub Release update prompt

### Not included yet

- Download list page
- Fully automatic background app replacement

### Notes

This is the first pre-release desktop package. Runtime data, cookies, local settings, and downloads are stored on the user's machine and are not bundled into the release package.
```
