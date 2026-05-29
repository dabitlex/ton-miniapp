// src/app/api/v1/quests/daily/route.ts 
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient } from '@/lib/supabase/admin'
import { todayUTC } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withAuth(async (ctx) => {
  const db = getAdminClient()
  const today = todayUTC()

  const { data, error } = await db
    .from('daily_quest_assignments')
    .select(`
      id,
      template_id,
      quest_date,
      status,
      expired_at,
      xp_granted,
      energy_spent,
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
    .eq('quest_date', today)
    .order('template(sort_order)', { ascending: true })

  if (error) return err(`Failed to fetch quests: ${error.message}`, 'DB_ERROR', 500)

  const quests = (data ?? []).map(row => ({
    id: row.id,
    templateId: row.template_id,
    questDate: row.quest_date,
    status: row.status,
    expiresAt: row.expired_at,
    xpGranted: row.xp_granted,
    energySpent: row.energy_spent,
    template: mapTemplate(row.template),
  }))

  return ok(quests)
})

function mapTemplate(t: any) {
  return {
    id: t.id,
    internalCode: t.internal_code,
    title: t.title,
    description: t.description,
    difficulty: t.difficulty,
    questType: t.quest_type,
    energyCost: t.energy_cost,
    xpReward: t.xp_reward,
    tokenReward: t.token_reward,
    iconKey: t.icon_key,
    sortOrder: t.sort_order,
  }
}
