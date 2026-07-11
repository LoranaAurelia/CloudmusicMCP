#!/usr/bin/env node
import qrcode from 'qrcode-terminal'
import open from 'open'
import { BackendManager } from '../src/backend.js'
import { NcmClient, saveSession } from '../src/client.js'

const backend = new BackendManager()

try {
  const { baseUrl } = await backend.start()
  const api = new NcmClient(baseUrl)
  const keyResult = await api.call('/login/qr/key', {}, { authenticated: false })
  const key = keyResult.data?.unikey || keyResult.data?.data?.unikey
  if (!key) throw new Error(`Could not obtain QR login key: ${JSON.stringify(keyResult)}`)

  const qrResult = await api.call('/login/qr/create', { key }, { authenticated: false })
  const qrUrl = qrResult.data?.qrurl || qrResult.data?.data?.qrurl
  if (!qrUrl) throw new Error('Could not create QR login URL')

  console.log('请使用网易云音乐 App 扫描二维码并确认登录。二维码有效期内会自动等待：\n')
  qrcode.generate(qrUrl, { small: true })
  console.log(`\n如果终端二维码无法扫描，请打开：${qrUrl}\n`)
  try { await open(qrUrl) } catch { /* The terminal QR remains available. */ }

  const deadline = Date.now() + 3 * 60 * 1000
  let lastCode
  while (Date.now() < deadline) {
    const result = await api.call('/login/qr/check', { key }, {
      authenticated: false,
      allowBusinessError: true,
    })
    const code = result.code
    if (code !== lastCode) {
      const messages = { 800: '二维码已过期', 801: '等待扫码', 802: '已扫码，等待手机确认', 803: '登录成功' }
      console.log(messages[code] || `登录状态：${code ?? '未知'}`)
      lastCode = code
    }
    if (code === 803 && result.cookie) {
      saveSession(result.cookie)
      const status = await api.call('/login/status')
      const profile = status.data?.profile
      saveSession(result.cookie, profile || null)
      console.log(`登录信息已安全保存到本机。用户：${profile?.nickname || profile?.userId || '已登录'}`)
      process.exitCode = 0
      break
    }
    if (code === 800) throw new Error('二维码已过期，请重新运行 .\\login.ps1')
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  if (lastCode !== 803) throw new Error('等待登录超时，请重新运行 .\\login.ps1')
} catch (error) {
  console.error(`登录失败：${error.message}`)
  process.exitCode = 1
} finally {
  await backend.stop()
}
