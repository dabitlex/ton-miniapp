// src/app/api/v1/ads/status/route.ts
// Liefert dem Frontend den Ad-Stand des Nutzers: heute gesehen / Tages-Limit
// und Wochen-Fortschritt (für die "Watch Ad"-Button-Anzeige + Weekly-Quest).
import { NextResponse } from 'next/server'
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DAILY_AD_LIMIT = 5
const WEEKLY_TARGET   = 20
const XP_PER_AD       = 50

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

// Montag (ISO-Wochenstart) dieser Woche in UTC, als YYYY-MM-DD
function isoWeekMondayUTC(): string {
  const now = new Date()
  const dow = (now.getUTCDay() + 6) % 7 // Mo=0 … So=6
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow))
  return monday.toISOString().slice(0, 10)
}

export const GET = withAuth(async (ctx) => {
  const db = getAdminClient()

  const [{ count: todayCount, error: e1 }, { count: weekCount, error: e2 }] = await Promise.all([
    db.from('ad_views').select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.userId).eq('view_date', todayUTC()),
    db.from('ad_views').select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.userId).gte('view_date', isoWeekMondayUTC()),
  ])

  if (e1 || e2) return err('DB error', 'DB_ERROR', 500)

  const watchedToday = todayCount ?? 0
  const weeklyCount  = weekCount ?? 0

  return ok({
    watchedToday,
    dailyLimit:    DAILY_AD_LIMIT,
    remainingToday: Math.max(0, DAILY_AD_LIMIT - watchedToday),
    weeklyCount,
    weeklyTarget:  WEEKLY_TARGET,
    xpPerAd:       XP_PER_AD,
  })
})
