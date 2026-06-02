// src/app/api/v1/season-rewards/route.ts
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

// GET — unbestätigte Belohnungen abrufen (für Popup)
export const GET = withAuth(async (ctx) => {
  const supabase = db()

  const { data: rewards } = await supabase
    .from('season_rewards')
    .select('id, season_number, final_rank, final_season_xp, xp_reward, acknowledged, granted_at')
    .eq('user_id', ctx.userId)
    .eq('acknowledged', false)
    .order('granted_at', { ascending: false })

  // Aktuellen xp_total für "neuer Total"-Anzeige
  const { data: user } = await supabase
    .from('users')
    .select('xp_total')
    .eq('id', ctx.userId)
    .single()

  const pending = (rewards ?? []).map(r => ({
    id:            r.id,
    seasonNumber:  r.season_number,
    finalRank:     r.final_rank,
    finalSeasonXp: r.final_season_xp,
    xpReward:      r.xp_reward,
    grantedAt:     r.granted_at,
  }))

  return ok({
    pendingRewards: pending,
    hasPending:     pending.length > 0,
    currentXpTotal: user?.xp_total ?? 0,
  })
})

// POST — Belohnung als gesehen markieren (Popup geschlossen)
export const POST = withAuth(async (ctx) => {
  let body: { rewardId?: string }
  try { body = await ctx.req.json() }
  catch { return err('Invalid body', 'BAD_REQUEST') }

  const supabase = db()

  if (body.rewardId) {
    // Einzelne Belohnung bestätigen
    await supabase
      .from('season_rewards')
      .update({ acknowledged: true })
      .eq('id', body.rewardId)
      .eq('user_id', ctx.userId)
  } else {
    // Alle bestätigen
    await supabase
      .from('season_rewards')
      .update({ acknowledged: true })
      .eq('user_id', ctx.userId)
      .eq('acknowledged', false)
  }

  return ok({ acknowledged: true })
})
