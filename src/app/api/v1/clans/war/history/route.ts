// src/app/api/v1/clans/war/history/route.ts
// GET — die letzten (max. 10) ausgewerteten Kriege des eigenen Clans,
//        inkl. Gegner, Ergebnis und persönlicher Belohnung.
import { withAuth, ok } from '@/app/api/v1/_lib/handler'
import { getAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withAuth(async (ctx) => {
  const db = getAdminClient()

  const { data: membership } = await db
    .from('clan_members').select('clan_id')
    .eq('user_id', ctx.userId).maybeSingle()

  if (!membership) return ok({ wars: [] })
  const myClanId = membership.clan_id as string

  const { data: wars } = await db
    .from('clan_wars')
    .select('id, clan_a_id, clan_b_id, status, ends_at, clan_a_score, clan_b_score, clan_a_member_count, clan_b_member_count, winner_clan_id')
    .in('status', ['completed', 'draw'])
    .or(`clan_a_id.eq.${myClanId},clan_b_id.eq.${myClanId}`)
    .order('ends_at', { ascending: false })
    .limit(10)

  if (!wars || wars.length === 0) return ok({ wars: [] })

  // Gegner-Namen + eigene Rewards in zwei Batches laden
  const rivalIds = Array.from(new Set(
    wars.map(w => (w.clan_a_id === myClanId ? w.clan_b_id : w.clan_a_id))
  ))
  const warIds = wars.map(w => w.id)

  const [{ data: rivals }, { data: myParts }] = await Promise.all([
    db.from('clans').select('id, name, avatar_url').in('id', rivalIds),
    db.from('clan_war_participants')
      .select('war_id, result, reward_xp, xp_contributed')
      .eq('user_id', ctx.userId).in('war_id', warIds),
  ])

  const rivalMap = new Map((rivals ?? []).map(r => [r.id, r]))
  const partMap  = new Map((myParts ?? []).map(p => [p.war_id, p]))

  const list = wars.map(w => {
    const iAmA    = w.clan_a_id === myClanId
    const rival   = rivalMap.get(iAmA ? w.clan_b_id : w.clan_a_id)
    const myPart  = partMap.get(w.id)
    const outcome = w.status === 'draw' ? 'draw'
                  : w.winner_clan_id === myClanId ? 'win' : 'loss'
    return {
      warId:        w.id,
      endedAt:      w.ends_at,
      outcome,                                             // Clan-Sicht
      myResult:     myPart?.result ?? null,                // persönliche Teilnahme
      myRewardXp:   myPart?.reward_xp ?? 0,
      myContribution: myPart?.xp_contributed ?? 0,
      rival: { name: rival?.name ?? 'Unknown', avatarUrl: rival?.avatar_url ?? null },
      myPerCapita:    Math.round((iAmA ? w.clan_a_score : w.clan_b_score) /
                                 Math.max(1, iAmA ? w.clan_a_member_count : w.clan_b_member_count)),
      rivalPerCapita: Math.round((iAmA ? w.clan_b_score : w.clan_a_score) /
                                 Math.max(1, iAmA ? w.clan_b_member_count : w.clan_a_member_count)),
    }
  })

  return ok({ wars: list })
})
