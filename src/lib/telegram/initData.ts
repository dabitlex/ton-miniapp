// src/lib/telegram/initData.ts
import crypto from 'crypto'
import type { ParsedInitData, TelegramWebAppUser } from '@/types/telegram'

const MAX_AGE_SECONDS = 3600 // 1 hour — reject stale initData

/**
 * Validate Telegram WebApp initData using HMAC-SHA256.
 * Must run server-side only. Never expose bot token to client.
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string
): { valid: boolean; reason?: string } {
  if (!initData || !botToken) {
    return { valid: false, reason: 'Missing initData or botToken' }
  }

  let params: URLSearchParams
  try {
    params = new URLSearchParams(initData)
  } catch {
    return { valid: false, reason: 'Malformed initData string' }
  }

  const hash = params.get('hash')
  if (!hash) return { valid: false, reason: 'Missing hash field' }

  // Freshness check — prevents replay attacks with old tokens
  const authDate = Number(params.get('auth_date') ?? '0')
  if (!authDate) return { valid: false, reason: 'Missing auth_date' }
  const age = Math.floor(Date.now() / 1000) - authDate
  if (age > MAX_AGE_SECONDS) {
    return { valid: false, reason: `initData expired: ${age}s old (max ${MAX_AGE_SECONDS}s)` }
  }

  // Build data-check-string: sort params alphabetically, exclude hash
  params.delete('hash')
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  // Derive secret key: HMAC-SHA256("WebAppData", bot_token)
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()

  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  // Timing-safe comparison — prevents timing attacks
  try {
    const hashBuf = Buffer.from(hash, 'hex')
    const expectBuf = Buffer.from(expectedHash, 'hex')
    if (hashBuf.length !== expectBuf.length) {
      return { valid: false, reason: 'Hash length mismatch' }
    }
    const isValid = crypto.timingSafeEqual(hashBuf, expectBuf)
    return isValid ? { valid: true } : { valid: false, reason: 'Signature mismatch' }
  } catch {
    return { valid: false, reason: 'Hash comparison failed' }
  }
}

export function parseTelegramInitData(initData: string): ParsedInitData {
  const params = new URLSearchParams(initData)
  const userStr = params.get('user')

  let user: TelegramWebAppUser | undefined
  if (userStr) {
    try {
      user = JSON.parse(decodeURIComponent(userStr)) as TelegramWebAppUser
    } catch {
      throw new Error('Failed to parse user field in initData')
    }
  }

  return {
    user,
    chat_instance: params.get('chat_instance') ?? undefined,
    chat_type: (params.get('chat_type') as ParsedInitData['chat_type']) ?? undefined,
    auth_date: Number(params.get('auth_date') ?? '0'),
    hash: params.get('hash') ?? '',
    start_param: params.get('start_param') ?? undefined,
    query_id: params.get('query_id') ?? undefined,
  }
}