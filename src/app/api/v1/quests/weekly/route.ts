// src/app/api/v1/quests/weekly/route.ts 
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient }    from '@/lib/supabase/admin'
import { getISOWeek }        from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Ad-Quest: Fortschritt + Energie werden in TS behandelt (nicht über die
// SQL-Progress-RPC, die ad_views nicht kennt).
const AD_CODE   = 'weekly_med_ads'
const AD_TARGET = 20

export const GET = withAuth(async (ctx) => {
  const db = getAdminClient()
  const { year, week } = getISOWeek(new Date())

  const { data, error } = await db
    .from('weekly_quest_assignments')
    .select(`
      id,
      template_id,
      iso_year,
      iso_week,
      status,
      xp_granted,
      energy_spent,
      completed_at,
      template:quest_templates (
        id,
        internal_code,
        title,
        description,
        difficulty,
        quest_type,
        energy_cost,
        xp_reward,
        token_reward,
        icon_key,
        sort_order
      )
    `)
    .eq('user_id', ctx.userId)
    .eq('iso_year', year)
    .eq('iso_week', week)
    .order('template(sort_order)', { ascending: true })

  if (error) return err(`Failed to fetch weekly quests: ${error.message}`, 'DB_ERROR', 500)

  // If no weekly quests assigned yet, assign them now
  if (!data || data.length === 0) {
    await assignWeeklyQuests(ctx.userId, year, week)

    // Re-fetch after assignment
    const { data: newData } = await db
      .from('weekly_quest_assignments')
      .select(`
        id, template_id, iso_year, iso_week, status, xp_granted, energy_spent, completed_at,
        template:quest_templates (id, internal_code, title, description, difficulty, quest_type,
          energy_cost, xp_reward, token_reward, icon_key, sort_order)
      `)
      .eq('user_id', ctx.userId)
      .eq('iso_year', year)
      .eq('iso_week', week)

    return ok(await attachProgress((newData ?? []).map(mapRow), ctx.userId))
  }

  return ok(await attachProgress(data.map(mapRow), ctx.userId))
})

// Weekly quest pools — every user gets the SAME 5 quests in the same
// ISO week (fairness), but the medium/hard pick rotates week to week
// via a deterministic seed derived ONLY from (isoYear, isoWeek).
//
//   1x AD_CODE        (always — "watch ads")
//   2x EASY_CODES     (always — both easy quests)
//   1x from MEDIUM_POOL (rotates)
//   1x from HARD_POOL   (rotates)
//   = 5 total (WEEKLY_QUESTS_PER_USER)
//
// This replaces the previous `others.slice(0, 4)` selection, which had
// no ORDER BY and no real rotation — as a result, two hard-tier quests
// (weekly_hard_clan, the old weekly_hard_referral) were NEVER assigned
// to anyone, ever. The explicit pools below guarantee every pool member
// gets picked roughly 1-in-N weeks.
const EASY_CODES   = ['weekly_easy_login', 'weekly_easy_energy']
const MEDIUM_POOL  = ['weekly_med_xp', 'weekly_med_quests', 'weekly_med_level']
const HARD_POOL    = ['weekly_hard_streak', 'weekly_hard_clan', 'weekly_hard_referral3']

async function assignWeeklyQuests(userId: string, isoYear: number, isoWeek: number) {
  const db = getAdminClient()

  // Get active season
  const { data: season } = await db
    .from('seasons')
    .select('id')
    .eq('status', 'active')
    .maybeSingle()

  // Deterministic per-week pick — same for every user, rotates weekly.
  // Different multipliers for medium/hard so the two picks don't move
  // in lockstep when both pools happen to have the same length.
  const seed       = isoYear * 100 + isoWeek
  const mediumPick = MEDIUM_POOL[seed % MEDIUM_POOL.length]
  const hardPick   = HARD_POOL[Math.floor(seed * 7 / MEDIUM_POOL.length) % HARD_POOL.length]

  const codesToAssign = [AD_CODE, ...EASY_CODES, mediumPick, hardPick]

  // Fetch only the active templates we actually want this week.
  // If a code is no longer active (e.g. deactivated later), it's
  // silently skipped — assigns fewer than 5 rather than erroring.
  const { data: templates } = await db
    .from('quest_templates')
    .select('id, internal_code')
    .eq('quest_type', 'weekly')
    .eq('is_active', true)
    .in('internal_code', codesToAssign)

  if (!templates || templates.length === 0) return

  await db.from('weekly_quest_assignments').upsert(
    templates.map(t => ({
      user_id:    userId,
      template_id:t.id,
      season_id:  season?.id ?? null,
      iso_year:   isoYear,
      iso_week:   isoWeek,
      status:     'available',
    })),
    { onConflict: 'user_id,template_id,iso_year,iso_week' }
  )
}

async function attachProgress(quests: any[], userId: string) {
  const db = getAdminClient()

  // Ad-Quest separat behandeln (ad_views zählen), NICHT an die SQL-RPC geben
  let adProgress: any = undefined
  const hasAdQuest = quests.some(q => q.template.internalCode === AD_CODE && q.status !== 'completed')
  if (hasAdQuest) {
    const { year, week } = getISOWeek(new Date())
    const { count } = await db
      .from('ad_views')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('iso_year', year)
      .eq('iso_week', week)
    const current = count ?? 0
    adProgress = { current, target: AD_TARGET, type: 'countable', isMet: current >= AD_TARGET }
  }

  const codes = quests
    .filter(q => q.status !== 'completed' && q.template.internalCode !== AD_CODE)
    .map(q => q.template.internalCode)

  const map: Record<string, any> = {}
  if (codes.length > 0) {
    const { data: prog } = await db.rpc('get_quests_progress_batch' as any, {
      p_user_id: userId, p_codes: codes,
    })
    for (const p of (prog as any[] ?? [])) {
      map[p.quest_code] = {
        current: Number(p.current_value), target: Number(p.required_value),
        type: p.progress_type, isMet: p.is_met,
      }
    }
  }

  return quests.map(q => ({
    ...q,
    progress: q.template.internalCode === AD_CODE
      ? adProgress
      : (map[q.template.internalCode] ?? undefined),
  }))
}

function mapRow(row: any) {
  return {
    id:          row.id,
    templateId:  row.template_id,
    isoYear:     row.iso_year,
    isoWeek:     row.iso_week,
    status:      row.status,
    xpGranted:   row.xp_granted,
    energySpent: row.energy_spent,
    completedAt: row.completed_at,
    template: {
      id:           row.template.id,
      internalCode: row.template.internal_code,
      title:        row.template.title,
      description:  row.template.description,
      difficulty:   row.template.difficulty,
      questType:    row.template.quest_type,
      energyCost:   row.template.internal_code === AD_CODE ? 0 : row.template.energy_cost,
      xpReward:     row.template.xp_reward,
      tokenReward:  row.template.token_reward,
      iconKey:      row.template.icon_key,
      sortOrder:    row.template.sort_order,
    },
  }
}
