import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJsonPath = resolve(__dirname, '..', 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
const platform = process.argv[2] || process.platform
const normalizedPlatform = platform === 'darwin' ? 'mac' : platform
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '')

process.stdout.write(`release/${normalizedPlatform}-${packageJson.version}-${timestamp}`)
