import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { backendDir } from './paths.js'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function backendConfig() {
  const port = Number(process.env.NCM_API_PORT || 3300)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid NCM_API_PORT: ${process.env.NCM_API_PORT}`)
  }
  return {
    port,
    baseUrl: process.env.NCM_API_BASE_URL || `http://127.0.0.1:${port}`,
    external: process.env.NCM_BACKEND_EXTERNAL === '1',
  }
}

export async function backendIsReady(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/search?keywords=test&limit=1`, {
      signal: AbortSignal.timeout(2500),
    })
    return response.ok
  } catch {
    return false
  }
}

export class BackendManager {
  constructor() {
    this.child = null
    this.owned = false
    this.config = backendConfig()
  }

  async start() {
    if (await backendIsReady(this.config.baseUrl)) return this.config
    if (this.config.external) {
      throw new Error(`External backend is not reachable at ${this.config.baseUrl}`)
    }
    if (!fs.existsSync(path.join(backendDir, 'node_modules'))) {
      throw new Error('Backend dependencies are missing. Run: pnpm --dir api-enhanced install')
    }

    this.child = spawn(process.execPath, ['app.js'], {
      cwd: backendDir,
      env: {
        ...process.env,
        PORT: String(this.config.port),
        HOST: '127.0.0.1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    this.owned = true
    this.child.stdout.on('data', (chunk) => process.stderr.write(`[api-enhanced] ${chunk}`))
    this.child.stderr.on('data', (chunk) => process.stderr.write(`[api-enhanced] ${chunk}`))

    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (this.child.exitCode !== null) {
        throw new Error(`api-enhanced exited during startup (code ${this.child.exitCode})`)
      }
      if (await backendIsReady(this.config.baseUrl)) return this.config
      await delay(250)
    }
    await this.stop()
    throw new Error(`api-enhanced did not become ready at ${this.config.baseUrl}`)
  }

  async stop() {
    if (!this.owned || !this.child || this.child.exitCode !== null) return
    const child = this.child
    child.kill('SIGTERM')
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      delay(3000),
    ])
    if (child.exitCode === null) child.kill('SIGKILL')
    this.child = null
    this.owned = false
  }
}

