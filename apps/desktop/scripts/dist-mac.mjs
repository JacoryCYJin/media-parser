import { existsSync, rmSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const desktopRoot = resolve(__dirname, '..')

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: desktopRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function outputDir() {
  const result = spawnSync(process.execPath, ['scripts/release-output-dir.mjs', 'mac'], {
    cwd: desktopRoot,
    encoding: 'utf-8'
  })

  if (result.status !== 0) {
    process.stderr.write(result.stderr || 'Failed to create release output directory name.')
    process.exit(result.status ?? 1)
  }

  return result.stdout.trim()
}

function cleanReleaseFolder(relativeOutputDir) {
  const absoluteOutputDir = resolve(desktopRoot, relativeOutputDir)
  const removableNames = ['mac-arm64', '.icon-icns', 'builder-debug.yml', 'builder-effective-config.yaml']

  for (const name of removableNames) {
    rmSync(resolve(absoluteOutputDir, name), { recursive: true, force: true })
  }

  for (const name of readdirSync(absoluteOutputDir)) {
    if (name.endsWith('.dmg.blockmap')) {
      rmSync(resolve(absoluteOutputDir, name), { force: true })
    }
  }

  console.log(`Cleaned release folder: ${relativeOutputDir}`)
}

const releaseOutputDir = outputDir()

run('npm', ['run', 'build:media-core'])
run('npm', ['run', 'prepare:release-tools'])
run('npm', ['run', 'build'])
run('npx', ['electron-builder', '--mac', `--config.directories.output=${releaseOutputDir}`])

if (existsSync(resolve(desktopRoot, releaseOutputDir))) {
  cleanReleaseFolder(releaseOutputDir)
}
