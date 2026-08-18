// src/app/api/v1/users/xp-daily/route.ts
// Tages-XP-Summen fuer die Sparkline in Profil und XP-Verlauf.
//
// Ersetzt die frueher clientseitige Buendelung der letzten 100 Eintraege —
// die deckte bei aktiven Nutzern nur ein bis zwei Tage ab, weshalb das
// Diagramm fast leer aussah.
import { withAuth, ok } from '@/app/api/v1/_lib/handler'
import { getAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withAuth(async (ctx) => {
  const url  = new URL(ctx.req.url)
  const days = Math.min(Math.max(Number(url.searchParams.get('days') ?? 14) || 14, 1), 90)

  const db = getAdminClient() as any
  const { data, error } = await db.rpc('xp_daily_totals', {
    p_user_id: ctx.userId,
    p_days:    days,
  })

  // Bei einem Fehler lieber leer ausliefern als den Screen blockieren —
  // die Sparkline ist Beiwerk, kein Kerninhalt.
  if (error || !Array.isArray(data)) return ok({ days: [] })

  return ok({
    days: data.map((r: { tag: string; xp: number | string }) => ({
      date: r.tag,
      xp:   Number(r.xp) || 0,
    })),
  })
})
