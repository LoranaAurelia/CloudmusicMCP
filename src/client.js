import fs from 'node:fs'
import path from 'node:path'
import { sessionFile } from './paths.js'

export function loadSession() {
  if (!fs.existsSync(sessionFile)) return null
  const value = JSON.parse(fs.readFileSync(sessionFile, 'utf8'))
  return typeof value.cookie === 'string' && value.cookie ? value : null
}

export function saveSession(cookie, profile = null) {
  fs.mkdirSync(path.dirname(sessionFile), { recursive: true })
  fs.writeFileSync(
    sessionFile,
    `${JSON.stringify({ cookie, profile, savedAt: new Date().toISOString() }, null, 2)}\n`,
    { encoding: 'utf8', mode: 0o600 },
  )
}

export class NcmClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  async call(route, params = {}, { authenticated = true, allowBusinessError = false } = {}) {
    const body = { ...params, timestamp: Date.now() }
    if (authenticated) {
      const session = loadSession()
      if (!session) throw new Error('Not logged in. Run .\\login.ps1 first.')
      body.cookie = session.cookie
    }
    const response = await fetch(`${this.baseUrl}${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
    const text = await response.text()
    let result
    try {
      result = JSON.parse(text)
    } catch {
      throw new Error(`${route} returned non-JSON (HTTP ${response.status})`)
    }
    if (!response.ok || (!allowBusinessError && typeof result.code === 'number' && result.code >= 400)) {
      throw new Error(`${route} failed: ${result.message || result.msg || `HTTP ${response.status}`}`)
    }
    return result
  }
}
