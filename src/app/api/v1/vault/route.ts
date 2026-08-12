// src/app/api/v1/vault/route.ts
// GET  — Zustand des Weekly Vault fuer den angemeldeten Nutzer:
//        { enabled, state: 'off' | 'idle' | 'open' | 'result', ... }
//          'off'    → Feature-Flag aus (Frontend blendet den Vault komplett aus)
//          'open'   → laufende Runde: Jackpot, eigene Lose, Los-Quellen des Tages
//          'result' → ungelesener Gewinn aus der letzten Ziehung
//          'idle'   → Flag an, aber keine offene Runde (z.B. zwischen Ziehung
//                     Sonntag 21:00 und Rundenstart Montag 00:20)
// POST — { roundId } bestaetigt den Gewinn-Screen (acknowledged = true)
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient }    from '@/lib/supabase/admin'
import { VAULT_RULES }       from '@/lib/constants/vault'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** UTC-Datum als YYYY-MM-DD — identisch zur Logik in der DB */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Naechster Montag 00:20 UTC (Rundenstart), fuer den Idle-Countdown */
function nextRoundStart(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dow = (d.getUTCDay() + 6) % 7            // Mo=0 … So=6
  d.setUTCDate(d.getUTCDate() + (7 - dow))
  d.setUTCHours(0, 20, 0, 0)
  if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 7)
  return d.toISOString()
}

export const GET = withAuth(async (ctx) => {
  const db = getAdminClient() as any

  // Feature-Flag
  const { data: flag } = await db
    .from('app_config').select('value').eq('key', 'weekly_vault_enabled').maybeSingle()

  if (flag?.value !== 'true') return ok({ enabled: false, state: 'off' })

  // ── Ungelesener Gewinn? (hat Vorrang, damit das Popup zuverlaessig kommt)
  const { data: win } = await db
    .from('vault_winners')
    .select('round_id, rank, prize_xp, ticket_count')
    .eq('user_id', ctx.userId)
    .eq('acknowledged', false)
    .order('granted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (win) {
    const { data: round } = await db
      .from('vault_rounds')
      .select('round_number, tickets_total, jackpot_total, seed, seed_hash, drawn_at')
      .eq('id', win.round_id).single()

    return ok({
      enabled: true,
      state: 'result',
      roundId: win.round_id,
      roundNumber: round?.round_number ?? null,
      rank: win.rank,
      prizeXp: win.prize_xp,
      myTickets: win.ticket_count,
      totalTickets: round?.tickets_total ?? 0,
      jackpot: round?.jackpot_total ?? 0,
      seed: round?.seed ?? null,           // nach der Ziehung veroeffentlicht
      seedHash: round?.seed_hash ?? null,
      drawnAt: round?.drawn_at ?? null,
    })
  }

  // ── Laufende Runde
  const nowIso = new Date().toISOString()
  const { data: round } = await db
    .from('vault_rounds')
    .select('id, round_number, status, starts_at, draw_at, tickets_total, jackpot_total, seed_hash')
    .eq('status', 'open')
    .lte('starts_at', nowIso)
    .gt('draw_at', nowIso)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!round) {
    return ok({ enabled: true, state: 'idle', nextRoundAt: nextRoundStart(), rules: VAULT_RULES })
  }

  const today = todayUtc()

  const [{ data: myTickets }, { count: adsToday }, { data: dailyQ }, { data: weeklyQ }, { data: clanM }] =
    await Promise.all([
      db.from('vault_tickets').select('source, source_date')
        .eq('round_id', round.id).eq('user_id', ctx.userId),
      db.from('ad_views').select('id', { count: 'exact', head: true })
        .eq('user_id', ctx.userId).eq('view_date', today),
      db.from('daily_quest_assignments').select('status')
        .eq('user_id', ctx.userId).eq('quest_date', today),
      db.from('weekly_quest_assignments').select('status')
        .eq('user_id', ctx.userId)
        .eq('iso_year',  new Date().getUTCFullYear())
        .eq('iso_week',  isoWeek(new Date())),
      db.from('clan_missions').select('status')
        .eq('user_id', ctx.userId).eq('assigned_date', today),
    ])

  const tickets = myTickets ?? []
  const earnedToday = (src: string) =>
    tickets.some(t => t.source === src && t.source_date === today)

  const doneOf = (rows: { status: string }[] | null) =>
    (rows ?? []).filter(r => r.status === 'completed').length

  return ok({
    enabled: true,
    state: 'open',
    roundId: round.id,
    roundNumber: round.round_number,
    startsAt: round.starts_at,
    drawAt: round.draw_at,
    jackpot: round.jackpot_total,
    totalTickets: round.tickets_total,
    seedHash: round.seed_hash,
    myTickets: tickets.length,
    maxTickets: VAULT_RULES.maxTickets,
    // Gewinnchance grob: eigene Lose gegen alle Lose (nur Anzeige)
    oddsOneIn: tickets.length > 0
      ? Math.max(1, Math.round(round.tickets_total / tickets.length))
      : null,
    sources: [
      { key: 'daily_quests', tickets: 1, earned: earnedToday('daily_quests'),
        current: doneOf(dailyQ), target: (dailyQ ?? []).length },
      { key: 'streak', tickets: 1, earned: earnedToday('streak'),
        current: earnedToday('streak') ? 1 : 0, target: 1 },
      { key: 'ads', tickets: 1, earned: earnedToday('ads'),
        current: Math.min(adsToday ?? 0, 5), target: 5 },
      { key: 'clan_missions', tickets: 1, earned: earnedToday('clan_missions'),
        current: doneOf(clanM), target: (clanM ?? []).length },
      { key: 'weekly_quest', tickets: 2,
        earned: tickets.some(t => t.source === 'weekly_quest'),
        current: doneOf(weeklyQ), target: (weeklyQ ?? []).length },
    ],
    prizes: VAULT_RULES.prizeSplit.map(p => ({
      ...p, xp: Math.floor(round.jackpot_total * p.pct),
    })),
    rules: VAULT_RULES,
  })
})

export const POST = withAuth(async (ctx) => {
  let body: { roundId?: string }
  try { body = await ctx.req.json() }
  catch { return err('Invalid body', 'BAD_REQUEST') }

  if (!body.roundId || !uuidRe.test(body.roundId)) {
    return err('roundId required', 'MISSING_FIELDS')
  }

  const db = getAdminClient() as any
  await db.from('vault_winners')
    .update({ acknowledged: true })
    .eq('round_id', body.roundId)
    .eq('user_id', ctx.userId)

  return ok({ acknowledged: true })
})

/** ISO-Kalenderwoche — identisch zur Berechnung im Rest der App */
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
