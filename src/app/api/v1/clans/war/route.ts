// src/app/api/v1/clans/war/route.ts
// GET  — Kriegs-Status des eigenen Clans:
//          { state: 'no_clan' | 'idle' | 'live' | 'result', ... }
//        'live'   → laufender Krieg mit Scores, Per-Capita, eigenem Beitrag,
//                   Top-Kämpfern beider Seiten und Reward-Tabelle
//        'result' → letzter ausgewerteter Krieg, den der Nutzer noch nicht
//                   bestätigt hat (acknowledged=false) → Result-Popup
//        'idle'   → kein Krieg; nextWarAt = nächster Montag 00:15 UTC
// POST — { warId } bestätigt das Result-Popup (acknowledged=true)
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient }    from '@/lib/supabase/admin'
import { WAR_RULES }         from '@/lib/constants/war'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function nextMonday0015UTC(): string {
  const now = new Date()
  const d   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dow = (d.getUTCDay() + 6) % 7               // Mo=0 … So=6
  const daysAhead = dow === 0 && now.getUTCHours() < 1 ? 0 : 7 - dow
  d.setUTCDate(d.getUTCDate() + daysAhead)
  d.setUTCHours(0, 15, 0, 0)
  if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 7)
  return d.toISOString()
}

interface ClanRow { id: string; name: string; slug: string; avatar_url: string | null; level: number }

function mapClan(c: ClanRow | null, memberCount: number, score: number) {
  const perCapita = memberCount > 0 ? Math.round(score / memberCount) : 0
  return {
    id: c?.id ?? null, name: c?.name ?? 'Unknown', slug: c?.slug ?? '',
    avatarUrl: c?.avatar_url ?? null, level: c?.level ?? 1,
    memberCount, score, perCapita,
  }
}

export const GET = withAuth(async (ctx) => {
  const db = getAdminClient()

  // 1. Clan-Mitgliedschaft
  const { data: membership } = await db
    .from('clan_members').select('clan_id')
    .eq('user_id', ctx.userId).maybeSingle()

  if (!membership) return ok({ state: 'no_clan' })
  const myClanId = membership.clan_id as string

  // 2a. Unbestätigtes Ergebnis? (hat Vorrang, damit das Popup zuverlässig kommt)
  const { data: pendingResult } = await db
    .from('clan_war_participants')
    .select('war_id, clan_id, result, reward_xp, xp_contributed')
    .eq('user_id', ctx.userId)
    .eq('acknowledged', false)
    .not('reward_granted_at', 'is', null)
    .order('reward_granted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 2b. Aktiver Krieg des Clans
  const nowIso = new Date().toISOString()
  const { data: liveWar } = await db
    .from('clan_wars')
    .select('id, clan_a_id, clan_b_id, status, starts_at, ends_at, clan_a_score, clan_b_score, clan_a_member_count, clan_b_member_count')
    .eq('status', 'active')
    .lte('starts_at', nowIso)
    .gt('ends_at', nowIso)
    .or(`clan_a_id.eq.${myClanId},clan_b_id.eq.${myClanId}`)
    .maybeSingle()

  // ── RESULT-STATE ─────────────────────────────────────────────
  if (pendingResult && !liveWar) {
    const { data: war } = await db
      .from('clan_wars')
      .select('id, clan_a_id, clan_b_id, status, clan_a_score, clan_b_score, clan_a_member_count, clan_b_member_count, winner_clan_id, ends_at')
      .eq('id', pendingResult.war_id)
      .single()

    if (war) {
      const iAmA     = war.clan_a_id === pendingResult.clan_id
      const rivalId  = iAmA ? war.clan_b_id : war.clan_a_id
      const { data: clans } = await db
        .from('clans').select('id, name, slug, avatar_url, level')
        .in('id', [pendingResult.clan_id, rivalId])

      const mine  = (clans ?? []).find(c => c.id === pendingResult.clan_id) ?? null
      const rival = (clans ?? []).find(c => c.id === rivalId) ?? null

      // Eigener Rang unter den Beitragenden des eigenen Clans
      const { data: mates } = await db
        .from('clan_war_participants')
        .select('user_id, xp_contributed')
        .eq('war_id', war.id).eq('clan_id', pendingResult.clan_id)
        .order('xp_contributed', { ascending: false })
      const myRank = (mates ?? []).findIndex(m => m.user_id === ctx.userId) + 1

      return ok({
        state: 'result',
        warId: war.id,
        result: pendingResult.result,                       // 'win' | 'loss' | 'draw'
        rewardXp: pendingResult.reward_xp ?? 0,
        myContribution: pendingResult.xp_contributed,
        myRankInClan: myRank > 0 ? myRank : null,
        endedAt: war.ends_at,
        myClan:  mapClan(mine,  iAmA ? war.clan_a_member_count : war.clan_b_member_count,
                                iAmA ? war.clan_a_score        : war.clan_b_score),
        rival:   mapClan(rival, iAmA ? war.clan_b_member_count : war.clan_a_member_count,
                                iAmA ? war.clan_b_score        : war.clan_a_score),
      })
    }
  }

  // ── IDLE-STATE ───────────────────────────────────────────────
  if (!liveWar) {
    return ok({ state: 'idle', nextWarAt: nextMonday0015UTC(), rules: WAR_RULES })
  }

  // ── LIVE-STATE ───────────────────────────────────────────────
  const iAmA    = liveWar.clan_a_id === myClanId
  const rivalId = iAmA ? liveWar.clan_b_id : liveWar.clan_a_id

  const [{ data: clans }, { data: myPart }, { data: topAll }] = await Promise.all([
    db.from('clans').select('id, name, slug, avatar_url, level').in('id', [myClanId, rivalId]),
    db.from('clan_war_participants')
      .select('xp_contributed, contributed_today, contrib_date')
      .eq('war_id', liveWar.id).eq('user_id', ctx.userId).maybeSingle(),
    db.from('clan_war_participants')
      .select('clan_id, xp_contributed, user:users(telegram_first_name, telegram_username, telegram_photo_url, level)')
      .eq('war_id', liveWar.id)
      .gt('xp_contributed', 0)
      .order('xp_contributed', { ascending: false })
      .limit(40),
  ])

  const mine  = (clans ?? []).find(c => c.id === myClanId) ?? null
  const rival = (clans ?? []).find(c => c.id === rivalId)  ?? null

  const today = new Date().toISOString().slice(0, 10)
  const contributedToday = myPart && myPart.contrib_date === today ? myPart.contributed_today : 0

  const mapTop = (clanId: string) => (topAll ?? [])
    .filter(t => t.clan_id === clanId)
    .slice(0, 3)
    .map((t: any) => ({
      firstName: t.user?.telegram_first_name ?? '—',
      username:  t.user?.telegram_username ?? null,
      photoUrl:  t.user?.telegram_photo_url ?? null,
      level:     t.user?.level ?? 1,
      xp:        t.xp_contributed,
    }))

  const myScore    = iAmA ? liveWar.clan_a_score : liveWar.clan_b_score
  const rivalScore = iAmA ? liveWar.clan_b_score : liveWar.clan_a_score
  const myCount    = iAmA ? liveWar.clan_a_member_count : liveWar.clan_b_member_count
  const rivalCount = iAmA ? liveWar.clan_b_member_count : liveWar.clan_a_member_count

  // Frontlinie: Anteil des eigenen Clans an der Summe der Per-Capita-Werte
  const pcMine  = myCount    > 0 ? myScore    / myCount    : 0
  const pcRival = rivalCount > 0 ? rivalScore / rivalCount : 0
  const frontline = pcMine + pcRival > 0 ? pcMine / (pcMine + pcRival) : 0.5

  return ok({
    state: 'live',
    warId: liveWar.id,
    startsAt: liveWar.starts_at,
    endsAt: liveWar.ends_at,
    myClan: mapClan(mine, myCount, myScore),
    rival:  mapClan(rival, rivalCount, rivalScore),
    frontline,                                            // 0..1, Anteil des eigenen Clans
    myContribution: {
      total: myPart?.xp_contributed ?? 0,
      today: contributedToday,
      dailyCap: WAR_RULES.dailyCap,
      isParticipant: !!myPart,                            // false = nach Kriegsstart beigetreten
    },
    topMine:  mapTop(myClanId),
    topRival: mapTop(rivalId),
    rules: WAR_RULES,
  })
})

export const POST = withAuth(async (ctx) => {
  let body: { warId?: string }
  try { body = await ctx.req.json() }
  catch { return err('Invalid body', 'BAD_REQUEST') }

  if (!body.warId || !uuidRe.test(body.warId)) return err('warId required', 'MISSING_FIELDS')

  const db = getAdminClient()
  await db.from('clan_war_participants')
    .update({ acknowledged: true })
    .eq('war_id', body.warId)
    .eq('user_id', ctx.userId)

  return ok({ acknowledged: true })
})
