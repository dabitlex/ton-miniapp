// src/lib/telegram/notifications.ts
// Zentrale Funktion zum Senden von Telegram-Push-Nachrichten via Bot
import { getAdminClient } from '@/lib/supabase/admin'

const TELEGRAM_API = 'https://api.telegram.org'

interface SendOptions {
  /** Falls true, wird notifications_enabled NICHT geprüft (z.B. kritische Zahlungs-Bestätigung) */
  bypassOptOut?: boolean
}

/**
 * Sendet eine Telegram-Nachricht an einen Nutzer (per interner user_id).
 * Prüft notifications_enabled (Opt-out) außer bei bypassOptOut.
 * Schlägt niemals hart fehl — Fehler werden geloggt, nie geworfen.
 */
export async function notifyUser(
  userId: string,
  text: string,
  options: SendOptions = {}
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    console.warn('[Notify] TELEGRAM_BOT_TOKEN fehlt — überspringe')
    return false
  }

  try {
    const db = getAdminClient()

    // telegram_id + Opt-out Einstellung laden
    const { data: user } = await db
      .from('users')
      .select('telegram_id')
      .eq('id', userId)
      .single()

    if (!user?.telegram_id) {
      console.warn(`[Notify] Kein telegram_id für User ${userId}`)
      return false
    }

    // Opt-out prüfen (außer bypass)
    if (!options.bypassOptOut) {
      const { data: settings } = await db
        .from('user_settings')
        .select('notifications_enabled')
        .eq('user_id', userId)
        .maybeSingle()

      // Default ist TRUE — nur bei explizitem false abbrechen
      if (settings && settings.notifications_enabled === false) {
        console.log(`[Notify] User ${userId} hat Benachrichtigungen deaktiviert`)
        return false
      }
    }

    // Nachricht senden
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    user.telegram_id,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      // 403 = Bot wurde vom Nutzer blockiert — kein echter Fehler
      if (res.status === 403) {
        console.log(`[Notify] User ${userId} hat den Bot blockiert`)
      } else {
        console.warn(`[Notify] Telegram API ${res.status}: ${errText}`)
      }
      return false
    }

    console.log(`[Notify] ✅ Nachricht an User ${userId} gesendet`)
    return true

  } catch (e: any) {
    console.warn(`[Notify] Fehler beim Senden an ${userId}: ${e.message}`)
    return false
  }
}

// ── Vordefinierte Nachrichten-Vorlagen ───────────────────────

export function boostConfirmedMessage(tierName: string, boostPct: number, until: string): string {
  const date = new Date(until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `💎 <b>Boost Activated!</b>\n\nYour <b>${tierName}</b> relic is now live — <b>+${boostPct}% XP</b> for the entire season (until ${date}).\n\nYour support powers the VEXALGO ecosystem. 🚀`
}

export function referralSuccessMessage(xpBonus: number): string {
  return `🎉 <b>New Recruit!</b>\n\nA friend just joined VEXALGO through your link — you earned <b>+${xpBonus.toLocaleString()} XP</b>!\n\nKeep sharing to climb the leaderboard. 🔥`
}

export function seasonRewardMessage(rank: number, xpReward: number, seasonNumber: number): string {
  return `🏆 <b>Season ${seasonNumber} Reward!</b>\n\nYou finished <b>#${rank}</b> globally and earned <b>+${xpReward.toLocaleString()} XP</b> on your total!\n\nOpen the app to see your new standing. 🎮`
}
