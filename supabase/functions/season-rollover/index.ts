// supabase/functions/season-rollover/index.ts
// Cron: "5 0 * * *" — runs daily at 00:05 UTC (after quest-assignment)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  const now   = new Date().toISOString()
  const today = new Date().toISOString().split('T')[0]!
  const results: string[] = []

  // ── 1. Reset daily XP counters for all users ───────────────────────
  const { count: xpReset } = await db
    .from('users')
    .update({ xp_earned_today: 0, xp_earned_today_date: today })
    .lt('xp_earned_today_date', today)
    .select('id', { count: 'exact', head: true })
  results.push(`xp_reset: ${xpReset ?? 0} users`)

  // ── 2. Reset daily energy counters ────────────────────────────────
  await db
    .from('users')
    .update({ energy_used_today: 0, energy_date: today })
    .lt('energy_date', today)
  results.push('energy_counters_reset')

  // ── 3. Reset antibot daily XP cap hits ─────────────────────────────
  await db.from('antibot_scores').update({ xp_cap_hits_today: 0 }).gte('xp_cap_hits_today', 0)
  results.push('antibot_caps_reset')

  // ── 4. Prune old request logs (>24h) ──────────────────────────────
  await db
    .from('request_logs')
    .delete()
    .lt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
  results.push('request_logs_pruned')

  // ── 5. Active → Off-season transition ────────────────────────────
  const { data: endedSeasons } = await db
    .from('seasons')
    .select('id, season_number, off_season_ends_at')
    .eq('status', 'active')
    .lte('ends_at', now)

  for (const s of endedSeasons ?? []) {
    await db.from('seasons').update({ status: 'off_season' }).eq('id', s.id)
    await createSeasonRewards(s.id)
    await db.from('system_events').insert({
      event_type: 'season_ended',
      payload: { season_id: s.id, season_number: s.season_number },
    })
    results.push(`season ${s.season_number} → off_season`)
  }

  // ── 6. Off-season → Ended ─────────────────────────────────────────
  const { data: expiredOffSeasons } = await db
    .from('seasons')
    .select('id, season_number')
    .eq('status', 'off_season')
    .lte('off_season_ends_at', now)

  for (const s of expiredOffSeasons ?? []) {
    await db.from('seasons').update({ status: 'ended' }).eq('id', s.id)
    // Reset season XP for all users in this season
    await db.from('users')
      .update({ season_xp: 0, current_season_id: null })
      .eq('current_season_id', s.id)
    results.push(`season ${s.season_number} → ended`)
  }

  // ── 7. Log ────────────────────────────────────────────────────────
  await db.from('system_events').insert({
    event_type: 'daily_rollover',
    payload:    { date: today, results },
    success:    true,
  })

  return new Response(JSON.stringify({ date: today, results }), { status: 200 })
})

async function createSeasonRewards(seasonId: string) {
  const { data: topUsers } = await db
    .from('users')
    .select('id, season_xp, level, league')
    .eq('current_season_id', seasonId)
    .eq('is_flagged', false)
    .eq('is_banned', false)
    .order('season_xp', { ascending: false })
    .limit(1000)

  if (!topUsers?.length) return

  const { data: season } = await db
    .from('seasons')
    .select('off_season_ends_at, token_pool_total')
    .eq('id', seasonId)
    .single()

  if (!season) return

  const rewards = topUsers.map((u, i) => ({
    season_id:       seasonId,
    user_id:         u.id,
    final_rank:      i + 1,
    final_league:    u.league,
    final_season_xp: u.season_xp,
    token_amount:    calcReward(i + 1, season.token_pool_total),
    status:          'pending',
    claim_deadline:  season.off_season_ends_at,
    has_wallet:      false,
    meets_min_xp:    u.season_xp >= 100,
    not_flagged:     true,
  }))

  // Batch insert
  const CHUNK = 100
  for (let i = 0; i < rewards.length; i += CHUNK) {
    await db.from('season_rewards' as any)
      .upsert(rewards.slice(i, i + CHUNK), { onConflict: 'season_id,user_id' })
  }
}

function calcReward(rank: number, pool: number): number {
  // Simple distribution: top ranks get larger share
  if (rank === 1)      return Math.floor(pool * 0.05)
  if (rank <= 3)       return Math.floor(pool * 0.03)
  if (rank <= 10)      return Math.floor(pool * 0.015)
  if (rank <= 50)      return Math.floor(pool * 0.005)
  if (rank <= 100)     return Math.floor(pool * 0.002)
  if (rank <= 500)     return Math.floor(pool * 0.0005)
  return Math.floor(pool * 0.0001)
}