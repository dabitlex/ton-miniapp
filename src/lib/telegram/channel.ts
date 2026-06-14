// src/lib/telegram/channel.ts
// Checks via the Telegram Bot API whether a user is a member of a
// channel. Prerequisite: the bot must be an administrator of the
// channel, otherwise getChatMember can incorrectly return 'left'
// for users who are actually members.

const TELEGRAM_API = 'https://api.telegram.org'

// @vexalgo — official VEXALGO channel. Bot has been an admin since June 2026.
export const VEXALGO_CHANNEL = '@vexalgo'

const MEMBER_STATUSES = new Set(['member', 'administrator', 'creator', 'restricted'])

/**
 * Checks whether telegramId is a member of VEXALGO_CHANNEL.
 *
 * Returns:
 *   true  -> is a member (member/administrator/creator/restricted)
 *   false -> is NOT a member (left/kicked)
 *   null  -> check not technically possible (missing token, API
 *            error, network error) — callers MUST treat this as
 *            "not verifiable" and must NOT treat it as true
 *            (fail-closed, same pattern as K2/M2).
 */
export async function checkChannelMembership(telegramId: number): Promise<boolean | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    console.warn('[ChannelCheck] TELEGRAM_BOT_TOKEN missing — skipping')
    return null
  }

  try {
    const url = `${TELEGRAM_API}/bot${botToken}/getChatMember`
      + `?chat_id=${encodeURIComponent(VEXALGO_CHANNEL)}`
      + `&user_id=${telegramId}`

    const res  = await fetch(url)
    const json = await res.json()

    if (!json.ok) {
      console.error('[ChannelCheck] Telegram API error:', json.description)
      return null
    }

    const status = json.result?.status as string | undefined
    if (!status) return null

    return MEMBER_STATUSES.has(status)
  } catch (e: any) {
    console.error('[ChannelCheck] Network error:', e?.message)
    return null
  }
}
