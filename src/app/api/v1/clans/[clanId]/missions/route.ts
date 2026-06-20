// src/app/api/v1/clans/[clanId]/missions/route.ts
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { createClient }      from '@supabase/supabase-js'
import { checkAchievements } from '@/app/api/v1/_lib/achievements'
import { todayUTC }          from '@/lib/utils'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export const GET = withAuth(async (ctx) => {
  const clanId = ctx.params?.clanId
  if (!clanId) return err('Clan-ID fehlt', 'MISSING_ID')

  const supabase = db()
  const today    = todayUTC()

  // Mitgliedschaft prüfen
  const { data: member } = await supabase
    .from('clan_members').select('role')
    .eq('clan_id', clanId).eq('user_id', ctx.userId).maybeSingle()
  if (!member) return err('Nicht Mitglied dieses Clans', 'NOT_MEMBER', 403)

  // Bestehende Missionen laden
  const { data: existing } = await supabase
    .from('clan_missions')
    .select(`
      id, status, energy_cost, xp_reward, xp_clan_reward,
      assigned_date, completed_at, xp_granted,
      template:quest_templates(id, title, description, difficulty, icon_key)
    `)
    .eq('clan_id', clanId)
    .eq('user_id', ctx.userId)
    .eq('assigned_date', today)

  if (!existing || existing.length === 0) {
    // Templates holen
    const { data: templates } = await supabase
      .from('quest_templates')
      .select('id, xp_reward')
      .eq('quest_type', 'clan_mission')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (!templates || templates.length === 0) return ok([])

    // Missionen einzeln einfügen
    for (const t of templates.slice(0, 3)) {
      await supabase.from('clan_missions').insert({
        clan_id:        clanId,
        user_id:        ctx.userId,
        template_id:    t.id,
        title:          'Clan-Mission',
        description:    '',
        energy_cost:    15,
        xp_reward:      t.xp_reward,
        xp_clan_reward: Math.floor(t.xp_reward * 0.5),
        assigned_date:  today,
        status:         'available',
      })
    }

    // Neu laden
    const { data: fresh } = await supabase
      .from('clan_missions')
      .select(`
        id, status, energy_cost, xp_reward, xp_clan_reward,
        assigned_date, completed_at, xp_granted,
        template:quest_templates(id, title, description, difficulty, icon_key)
      `)
      .eq('clan_id', clanId)
      .eq('user_id', ctx.userId)
      .eq('assigned_date', today)

    return ok(mapMissions(fresh ?? []))
  }

  return ok(mapMissions(existing))
})

export const POST = withAuth(async (ctx) => {
  const clanId = ctx.params?.clanId
  if (!clanId) return err('Clan-ID fehlt', 'MISSING_ID')

  let body: { missionId?: string; nonce?: string }
  try { body = await ctx.req.json() }
  catch { return err('Ungültiger Body', 'BAD_REQUEST') }

  const { missionId, nonce } = body
  if (!missionId || !nonce) return err('missionId und nonce erforderlich', 'MISSING_FIELDS')

  const supabase = db()

  const { data: mission } = await supabase
    .from('clan_missions')
    .select('id, status, energy_cost, xp_reward, xp_clan_reward')
    .eq('id', missionId).eq('clan_id', clanId).eq('user_id', ctx.userId)
    .single()

  if (!mission) return err('Mission nicht gefunden', 'NOT_FOUND', 404)
  if (mission.status !== 'available') return err('Mission bereits abgeschlossen', 'ALREADY_DONE')

  const { data: energyResult } = await supabase.rpc('consume_energy', {
    p_user_id: ctx.userId,
    p_amount:  mission.energy_cost,
    p_reason:  'clan_mission',
    p_ref_id:  missionId,
  })
  const energyRes = (energyResult as any[])?.[0]
  if (!energyRes?.success) {
    return err(energyRes?.failure_reason ?? 'Nicht genug Energie', 'NO_ENERGY')
  }

  const { data: xpResult } = await supabase.rpc('grant_xp', {
    p_user_id:       ctx.userId,
    p_xp_base:       mission.xp_reward,
    p_source_type:   'clan_mission',
    p_source_ref_id: missionId,
  })
  const xp = (xpResult as any[])?.[0]

  await supabase.from('clan_missions').update({
    status:       'completed',
    completed_at: new Date().toISOString(),
    xp_granted:   xp?.xp_granted ?? mission.xp_reward,
  }).eq('id', missionId)

  await supabase.rpc('increment_clan_xp' as any, {
    p_clan_id: clanId,
    p_xp:      mission.xp_clan_reward,
    p_user_id: ctx.userId,
  })

  await supabase.rpc('increment_member_xp' as any, {
    p_clan_id: clanId,
    p_user_id: ctx.userId,
    p_xp:      mission.xp_clan_reward,
  })

  const newAchievements = await checkAchievements(supabase, ctx.userId)

  return ok({
    xpGranted:    xp?.xp_granted ?? mission.xp_reward,
    clanXpGained: mission.xp_clan_reward,
    leveledUp:    xp?.leveled_up ?? false,
    newLevel:     xp?.new_level ?? null,
    energyAfter:  energyRes.energy_after,
    newAchievements,
  })
})

function mapMissions(missions: any[]) {
  return missions.map(m => ({
    id:           m.id,
    status:       m.status,
    energyCost:   m.energy_cost,
    xpReward:     m.xp_reward,
    xpClanReward: m.xp_clan_reward,
    assignedDate: m.assigned_date,
    completedAt:  m.completed_at,
    xpGranted:    m.xp_granted,
    template: {
      id:          m.template?.id,
      title:       m.template?.title,
      description: m.template?.description,
      difficulty:  m.template?.difficulty,
      iconKey:     m.template?.icon_key,
    },
  }))
}
