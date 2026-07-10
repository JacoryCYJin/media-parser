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

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
