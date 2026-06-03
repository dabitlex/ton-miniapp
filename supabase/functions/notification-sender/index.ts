// supabase/functions/notification-sender/index.ts
// Cron: "*/1 * * * *" — läuft jede Minute, arbeitet die notification_queue ab

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const BOT_TOKEN    = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const TELEGRAM_API = 'https://api.telegram.org'
const MAX_ATTEMPTS = 3

// ── Nachrichten-Vorlagen ─────────────────────────────────────
function buildMessage(kind: string, p: any): string | null {
  switch (kind) {
    case 'boost_confirmed': {
      const date = new Date(p.until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      return `💎 <b>Boost Activated!</b>\n\nYour <b>${p.tier_name}</b> relic is now live — <b>+${p.boost_pct}% XP</b> for the entire season (until ${date}).\n\nYour support powers the VEXALGO ecosystem. 🚀`
    }
    case 'referral_success':
      return `🎉 <b>New Recruit!</b>\n\nA friend just joined VEXALGO through your link — you earned <b>+${Number(p.xp_bonus).toLocaleString()} XP</b>!\n\nKeep sharing to climb the leaderboard. 🔥`
    case 'season_reward':
      return `🏆 <b>Season ${p.season_number} Reward!</b>\n\nYou finished <b>#${p.rank}</b> globally and earned <b>+${Number(p.xp_reward).toLocaleString()} XP</b> on your total!\n\nOpen the app to see your new standing. 🎮`
    default:
      return null
  }
}

Deno.serve(async () => {
  const results: string[] = []

  // Pending-Einträge laden (max 50 pro Lauf)
  const { data: queue } = await db
    .from('notification_queue')
    .select('id, user_id, kind, payload, bypass_optout, attempts')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50)

  if (!queue || queue.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let sent = 0, failed = 0, skipped = 0

  for (const item of queue) {
    try {
      // User + Opt-out laden
      const { data: user } = await db
        .from('users').select('telegram_id').eq('id', item.user_id).single()

      if (!user?.telegram_id) {
        await markFailed(item.id, item.attempts)
        failed++; continue
      }

      // Opt-out prüfen (außer bypass)
      if (!item.bypass_optout) {
        const { data: settings } = await db
          .from('user_settings').select('notifications_enabled')
          .eq('user_id', item.user_id).maybeSingle()
        if (settings && settings.notifications_enabled === false) {
          // Nutzer hat deaktiviert → als "sent" markieren (nicht erneut versuchen)
          await db.from('notification_queue')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', item.id)
          skipped++; continue
        }
      }

      const text = buildMessage(item.kind, item.payload)
      if (!text) { await markFailed(item.id, item.attempts); failed++; continue }

      const res = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/sendMessage`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: user.telegram_id, text,
          parse_mode: 'HTML', disable_web_page_preview: true,
        }),
      })

      if (res.ok) {
        await db.from('notification_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', item.id)
        sent++
      } else {
        // 403 = Bot blockiert → nicht erneut versuchen
        if (res.status === 403) {
          await db.from('notification_queue').update({ status: 'failed' }).eq('id', item.id)
        } else {
          await markFailed(item.id, item.attempts)
        }
        failed++
      }
    } catch (_e) {
      await markFailed(item.id, item.attempts)
      failed++
    }
  }

  results.push(`sent=${sent} failed=${failed} skipped=${skipped}`)
  return new Response(JSON.stringify({ ok: true, processed: queue.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

// Bei Fehler: attempts hochzählen, ab MAX_ATTEMPTS → failed
async function markFailed(id: string, attempts: number) {
  const next = (attempts ?? 0) + 1
  if (next >= MAX_ATTEMPTS) {
    await db.from('notification_queue').update({ status: 'failed', attempts: next }).eq('id', id)
  } else {
    await db.from('notification_queue').update({ attempts: next }).eq('id', id)
  }
}
