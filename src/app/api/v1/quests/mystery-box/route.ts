// src/app/api/v1/quests/mystery-box/route.ts
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient }    from '@/lib/supabase/admin'
import { todayUTC }          from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET — Status: ist die Box heute verfügbar / schon geöffnet?
export const GET = withAuth(async (ctx) => {
  const db = getAdminClient()

  // Schon heute geöffnet?
  const { data: claim } = await db
    .from('mystery_box_claims')
    .select('tier, xp_reward, claimed_at')
    .eq('user_id', ctx.userId)
    .eq('claim_date', todayUTC())
    .maybeSingle()

  if (claim) {
    return ok({
      available:  false,
      claimed:    true,
      tier:       claim.tier,
      xpReward:   claim.xp_reward,
    })
  }

  // Alle Daily Quests abgeschlossen?
  const { data: allComplete } = await db.rpc('all_daily_quests_complete', {
    p_user_id: ctx.userId,
  })

  return ok({
    available: allComplete === true,
    claimed:   false,
  })
})

// POST — Box öffnen (server-autoritativ: würfelt + vergibt XP)
export const POST = withAuth(async (ctx) => {
  const db = getAdminClient()

  // Sicherheit: nur öffnen wenn wirklich alle Daily Quests fertig
  const { data: allComplete } = await db.rpc('all_daily_quests_complete', {
    p_user_id: ctx.userId,
  })
  if (allComplete !== true) {
    return err('Complete all daily quests first', 'NOT_ELIGIBLE', 403)
  }

  // Box öffnen (gewichtete Zufallsauswahl in der DB)
  const { data: result, error } = await db.rpc('open_mystery_box', {
    p_user_id: ctx.userId,
  })
  if (error) return err(`Box error: ${error.message}`, 'DB_ERROR', 500)

  const r = (result as any[])?.[0]
  if (!r) return err('No result', 'DB_ERROR', 500)

  if (r.out_already) {
    return err('Box already opened today', 'ALREADY_CLAIMED', 409)
  }

  return ok({
    tier:     r.out_tier,
    xpReward: r.out_xp,
  })
})
