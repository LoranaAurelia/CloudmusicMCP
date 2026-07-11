import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const backendDir = path.join(rootDir, 'api-enhanced')
export const sessionFile = path.join(rootDir, 'data', 'session.json')
export const pidFile = path.join(rootDir, 'data', 'backend.pid.json')
export const backendLogFile = path.join(rootDir, 'data', 'backend.log')

