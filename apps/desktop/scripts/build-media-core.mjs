import { existsSync, rmSync, cpSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const desktopRoot = resolve(__dirname, '..')
const repoRoot = resolve(desktopRoot, '../..')
const coreRoot = resolve(repoRoot, 'services/media-core')
const pythonBin = process.env.PYTHON_BIN || resolve(coreRoot, '.venv/bin/python')
const distSource = resolve(coreRoot, 'dist/media-core')
const resourcesTarget = resolve(desktopRoot, 'build/resources/media-core')

if (!existsSync(pythonBin)) {
  console.error(`Missing Python runtime: ${pythonBin}`)
  console.error('Create services/media-core/.venv and install requirements before building a release.')
  process.exit(1)
}

rmSync(resolve(coreRoot, 'build'), { recursive: true, force: true })
rmSync(resolve(coreRoot, 'dist'), { recursive: true, force: true })
rmSync(resourcesTarget, { recursive: true, force: true })

const result = spawnSync(
  pythonBin,
  ['-m', 'PyInstaller', '--clean', '--noconfirm', 'media-core.spec'],
  {
    cwd: coreRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      PYTHONPATH: coreRoot
    }
  }
)

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

if (!existsSync(distSource)) {
  console.error(`PyInstaller output not found: ${distSource}`)
  process.exit(1)
}

cpSync(distSource, resourcesTarget, { recursive: true })
