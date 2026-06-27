// src/app/api/v1/users/xp-history/route.ts
// XP-Verlauf des angemeldeten Nutzers — paginiert (Cursor über created_at).
//   GET ?limit=30&before=<ISO>  ->  { entries: [...], nextCursor }
// Liest ausschließlich xp_logs (XP-Ereignisse). Service-Role-Client; der Nutzer
// wird über das Token (ctx.userId) bestimmt, daher filtern wir explizit auf user_id.

import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { createClient }      from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export const GET = withAuth(async (ctx) => {
  const sp        = new URL(ctx.req.url).searchParams
  const before    = sp.get('before')              // ISO-Cursor (created_at der letzten Zeile)
  const rawLimit  = Number(sp.get('limit') ?? 30)
  const limit     = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 30, 1), 50)

  const supabase = db()
  let q = supabase
    .from('xp_logs')
    .select('id, created_at, source_type, xp_granted, boost_percent, level_after, leveled_up')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .order('id',         { ascending: false })
    .limit(limit + 1)                              // +1 = "gibt es noch mehr?"
  if (before) q = q.lt('created_at', before)

  const { data, error } = await q
  if (error) return err('Could not load XP history', 'DB_ERROR', 500)

  const rows    = data ?? []
  const hasMore = rows.length > limit
  const slice   = hasMore ? rows.slice(0, limit) : rows

  const entries = slice.map((r) => ({
    id:           r.id,
    createdAt:    r.created_at,
    source:       r.source_type,
    xp:           r.xp_granted,
    boostPercent: r.boost_percent ?? 0,
    level:        r.leveled_up ? r.level_after : null,
    leveledUp:    r.leveled_up,
  }))

  const nextCursor = hasMore ? slice[slice.length - 1].created_at : null
  return ok({ entries, nextCursor })
})
