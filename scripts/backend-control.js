#!/usr/bin/env node
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { backendConfig, backendIsReady } from '../src/backend.js'
import { backendDir, backendLogFile, pidFile } from '../src/paths.js'

const action = process.argv[2]
const config = backendConfig()
const readPid = () => {
  try { return JSON.parse(fs.readFileSync(pidFile, 'utf8')) } catch { return null }
}
const alive = (pid) => {
  try { process.kill(pid, 0); return true } catch { return false }
}

if (action === 'start') {
  const current = readPid()
  if (current?.pid && alive(current.pid)) {
    console.log(`后端已在运行（PID ${current.pid}，${config.baseUrl}）`)
  } else if (await backendIsReady(config.baseUrl)) {
    console.log(`端口上已有可用后端：${config.baseUrl}（不是由本脚本启动，不会接管）`)
  } else {
    if (!fs.existsSync(path.join(backendDir, 'node_modules'))) {
      throw new Error('后端依赖未安装，请运行 pnpm --dir api-enhanced install')
    }
    fs.mkdirSync(path.dirname(backendLogFile), { recursive: true })
    const logFd = fs.openSync(backendLogFile, 'a')
    const child = spawn(process.execPath, ['app.js'], {
      cwd: backendDir,
      env: { ...process.env, PORT: String(config.port), HOST: '127.0.0.1' },
      detached: true,
      stdio: ['ignore', logFd, logFd],
      windowsHide: true,
    })
    child.unref()
    fs.closeSync(logFd)
    fs.writeFileSync(pidFile, `${JSON.stringify({ pid: child.pid, startedAt: new Date().toISOString(), baseUrl: config.baseUrl }, null, 2)}\n`)
    for (let i = 0; i < 30 && !(await backendIsReady(config.baseUrl)); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    if (!(await backendIsReady(config.baseUrl))) throw new Error(`后端启动失败，请检查 ${backendLogFile}`)
    console.log(`后端已启动（PID ${child.pid}，${config.baseUrl}）`)
  }
} else if (action === 'stop') {
  const current = readPid()
  if (!current?.pid) {
    console.log('没有本脚本记录的后端进程，不执行停止。')
  } else if (!alive(current.pid)) {
    console.log(`记录的 PID ${current.pid} 已不存在，清理陈旧 PID 文件。`)
    fs.rmSync(pidFile)
  } else {
    console.log(`即将停止本脚本启动的后端：PID ${current.pid}，${current.baseUrl}`)
    process.kill(current.pid, 'SIGTERM')
    for (let i = 0; i < 20 && alive(current.pid); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    if (alive(current.pid)) throw new Error(`PID ${current.pid} 未能正常停止，请手动检查，未强制终止。`)
    fs.rmSync(pidFile)
    console.log('后端已停止。')
  }
} else if (action === 'status') {
  const current = readPid()
  const ready = await backendIsReady(config.baseUrl)
  console.log(JSON.stringify({ ready, baseUrl: config.baseUrl, managedProcess: current, processAlive: current?.pid ? alive(current.pid) : false }, null, 2))
} else {
  console.error('用法：node scripts/backend-control.js <start|stop|status>')
  process.exitCode = 2
}

