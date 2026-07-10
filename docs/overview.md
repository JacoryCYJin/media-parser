# Media Parser

Media Parser is the local-first software version of the media parsing tools that currently live in `../site/`.

The project should become a downloadable desktop app, not a hosted web tool. The desktop app owns process orchestration, filesystem access, download management, transcription tasks, logs, and release packaging.

The selected final stack is:

- Electron for the desktop shell and process orchestration
- Vue 3 + Vite + Tailwind CSS for the renderer UI
- Python for media parsing, downloading, transcription, and content generation
- yt-dlp, FFmpeg, and faster-whisper for media processing

`site/` remains untouched until this repository reaches functional parity.
