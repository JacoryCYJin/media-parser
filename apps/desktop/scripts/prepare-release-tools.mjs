import { createWriteStream, existsSync, mkdirSync, rmSync, chmodSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { get } from 'node:https'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const desktopRoot = resolve(__dirname, '..')
const binTarget = resolve(desktopRoot, 'build/resources/bin')
const ffmpegSource = require('ffmpeg-static')

function ytdlpAssetName() {
  if (process.platform === 'darwin') return 'yt-dlp_macos'
  if (process.platform === 'win32') return 'yt-dlp.exe'
  return 'yt-dlp_linux'
}

function ytdlpTargetName() {
  return process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
}

function download(url, targetPath, redirects = 0) {
  return new Promise((resolveDownload, rejectDownload) => {
    const request = get(url, (response) => {
      const status = response.statusCode || 0
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume()
        if (redirects > 5) {
          rejectDownload(new Error(`Too many redirects for ${url}`))
          return
        }
        download(response.headers.location, targetPath, redirects + 1).then(resolveDownload, rejectDownload)
        return
      }

      if (status !== 200) {
        response.resume()
        rejectDownload(new Error(`Download failed with HTTP ${status}: ${url}`))
        return
      }

      const file = createWriteStream(targetPath)
      response.pipe(file)
      file.on('finish', () => {
        file.close(resolveDownload)
      })
      file.on('error', rejectDownload)
    })

    request.on('error', rejectDownload)
  })
}

if (!ffmpegSource || !existsSync(ffmpegSource)) {
  console.error('ffmpeg-static did not provide a local ffmpeg binary.')
  process.exit(1)
}

rmSync(binTarget, { recursive: true, force: true })
mkdirSync(binTarget, { recursive: true })

const ffmpegTarget = resolve(binTarget, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
copyFileSync(ffmpegSource, ffmpegTarget)
chmodSync(ffmpegTarget, 0o755)

const ytdlpTarget = resolve(binTarget, ytdlpTargetName())
const ytdlpUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytdlpAssetName()}`
await download(ytdlpUrl, ytdlpTarget)
chmodSync(ytdlpTarget, 0o755)

console.log(`Prepared ffmpeg: ${ffmpegTarget}`)
console.log(`Prepared yt-dlp: ${ytdlpTarget}`)
