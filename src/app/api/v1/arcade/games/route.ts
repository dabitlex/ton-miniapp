// src/app/api/v1/arcade/games/route.ts 
// Übersicht aller Spiele für den Sammlungs-Screen.
import { withAuth, ok } from '@/app/api/v1/_lib/handler'
import { getAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withAuth(async (ctx) => {
  const db = getAdminClient() as any
  const { data, error } = await db.rpc('arcade_games', { p_user_id: ctx.userId })

  if (error || !Array.isArray(data)) return ok({ games: [] })

  return ok({
    games: data.map((r: any) => ({
      game:      String(r.game),
      enabled:   !!r.enabled,
      runsLeft:  Number(r.runs_left ?? 0),
      bestScore: Number(r.best_score ?? 0),
    })),
  })
})
