import { spawn } from 'node:child_process'

const command = process.argv[2] ?? 'dev'
const env = { ...process.env }

delete env.ELECTRON_RUN_AS_NODE

const executable = process.platform === 'win32' ? 'electron-vite.cmd' : 'electron-vite'
const child = spawn(executable, [command], {
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit'
})

let shuttingDown = false

const shutdown = (signal = 'SIGTERM') => {
  if (shuttingDown) return
  shuttingDown = true

  if (child.exitCode === null && !child.killed) {
    child.kill(signal)
  }

  setTimeout(() => {
    process.exit(signal === 'SIGINT' ? 130 : 143)
  }, 3000).unref()
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))

child.on('exit', (code, signal) => {
  if (shuttingDown) {
    process.exit(code ?? (signal === 'SIGINT' ? 130 : 0))
    return
  }
  process.exit(code ?? 0)
})
