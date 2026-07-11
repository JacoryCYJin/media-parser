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
