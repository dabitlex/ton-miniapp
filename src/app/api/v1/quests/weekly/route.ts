// src/app/api/v1/quests/weekly/route.ts 
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient }    from '@/lib/supabase/admin'
import { getISOWeek }        from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

    return ok((newData ?? []).map(mapRow))
  }

  return ok(data.map(mapRow))
})

async function assignWeeklyQuests(userId: string, isoYear: number, isoWeek: number) {
  const db = getAdminClient()

  // Get active season
  const { data: season } = await db
    .from('seasons')
    .select('id')
    .eq('status', 'active')
    .maybeSingle()

  // Pick 5 weekly templates (mix of difficulties)
  const { data: templates } = await db
    .from('quest_templates')
    .select('id, difficulty')
    .eq('quest_type', 'weekly')
    .eq('is_active', true)
    .limit(10)

  if (!templates || templates.length === 0) return

  const toAssign = templates.slice(0, 5)

  await db.from('weekly_quest_assignments').upsert(
    toAssign.map(t => ({
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
      energyCost:   row.template.energy_cost,
      xpReward:     row.template.xp_reward,
      tokenReward:  row.template.token_reward,
      iconKey:      row.template.icon_key,
      sortOrder:    row.template.sort_order,
    },
  }
}
