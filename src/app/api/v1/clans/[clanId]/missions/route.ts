// src/app/api/v1/clans/[clanId]/missions/route.ts
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { createClient }      from '@supabase/supabase-js'
import { todayUTC }          from '@/lib/utils'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET — Heutige Clan-Missionen
export const GET = withAuth(async (ctx, routeCtx) => {
  const clanId = (routeCtx as any).params?.clanId
  if (!clanId) return err('Clan-ID fehlt', 'MISSING_ID')

  const supabase = db()
  const today    = todayUTC()

  // Mitgliedschaft prüfen
  const { data: member } = await supabase
    .from('clan_members').select('role')
    .eq('clan_id', clanId).eq('user_id', ctx.userId).maybeSingle()
  if (!member) return err('Nicht Mitglied dieses Clans', 'NOT_MEMBER', 403)

  // Missionen laden
  const { data: missions } = await supabase
    .from('clan_missions')
    .select(`
      id, status, energy_cost, xp_reward, xp_clan_reward,
      assigned_date, completed_at, xp_granted,
      template:quest_templates(id, title, description, difficulty, icon_key)
    `)
    .eq('clan_id', clanId)
    .eq('user_id', ctx.userId)
    .eq('assigned_date', today)

  // Falls keine Missionen: automatisch zuweisen
  if (!missions || missions.length === 0) {
    await assignClanMissions(supabase, clanId, ctx.userId, today)
    const { data: newMissions } = await supabase
      .from('clan_missions')
      .select(`
        id, status, energy_cost, xp_reward, xp_clan_reward,
        assigned_date, completed_at, xp_granted,
        template:quest_templates(id, title, description, difficulty, icon_key)
      `)
      .eq('clan_id', clanId)
      .eq('user_id', ctx.userId)
      .eq('assigned_date', today)
    return ok(mapMissions(newMissions ?? []))
  }

  return ok(mapMissions(missions))
})

// POST — Clan-Mission abschließen
export const POST = withAuth(async (ctx, routeCtx) => {
  const clanId = (routeCtx as any).params?.clanId
  if (!clanId) return err('Clan-ID fehlt', 'MISSING_ID')

  let body: { missionId?: string; nonce?: string }
  try { body = await ctx.req.json() }
  catch { return err('Ungültiger Body', 'BAD_REQUEST') }

  const { missionId, nonce } = body
  if (!missionId || !nonce) return err('missionId und nonce erforderlich', 'MISSING_FIELDS')

  const supabase = db()

  // Mission laden
  const { data: mission } = await supabase
    .from('clan_missions')
    .select('id, status, energy_cost, xp_reward, xp_clan_reward, clan_id, user_id')
    .eq('id', missionId)
    .eq('clan_id', clanId)
    .eq('user_id', ctx.userId)
    .single()

  if (!mission) return err('Mission nicht gefunden', 'NOT_FOUND', 404)
  if (mission.status !== 'available') {
    return err(`Mission ist bereits ${mission.status}`, 'ALREADY_DONE')
  }

  // Energie verbrauchen
  const { data: energyResult } = await supabase.rpc('consume_energy', {
    p_user_id: ctx.userId,
    p_amount:  mission.energy_cost,
    p_reason:  'clan_mission',
    p_ref_id:  missionId,
  })
  const energyRes = (energyResult as any[])[0]
  if (!energyRes?.success) {
    return err(energyRes?.failure_reason ?? 'Nicht genug Energie', 'NO_ENERGY')
  }

  // XP für User vergeben
  const { data: xpResult } = await supabase.rpc('grant_xp', {
    p_user_id:       ctx.userId,
    p_xp_base:       mission.xp_reward,
    p_source_type:   'clan_mission',
    p_source_ref_id: missionId,
  })
  const xp = (xpResult as any[])[0]

  // Mission abschließen
  await supabase.from('clan_missions').update({
    status:       'completed',
    completed_at: new Date().toISOString(),
    xp_granted:   xp.xp_granted,
  }).eq('id', missionId)

  // Clan-XP erhöhen
  await supabase.from('clans').update({
    season_xp: supabase.rpc('season_xp' as any, {}) as any,
    xp_total:  supabase.rpc('xp_total' as any, {}) as any,
  }).eq('id', clanId)

  // Direkt mit UPDATE
  await supabase.rpc('increment_clan_xp' as any, {
    p_clan_id: clanId,
    p_xp:      mission.xp_clan_reward,
    p_user_id: ctx.userId,
  }).catch(() => {
    // Fallback falls Funktion fehlt
    supabase.from('clans').update({
      season_xp: (supabase as any).raw('season_xp + ' + mission.xp_clan_reward),
    }).eq('id', clanId)
  })

  // contributed_xp des Mitglieds erhöhen
  await (supabase as any).rpc('increment_member_xp', {
    p_clan_id: clanId,
    p_user_id: ctx.userId,
    p_xp:      mission.xp_clan_reward,
  }).catch(async () => {
    // Direktes Update als Fallback
    const { data: current } = await supabase
      .from('clan_members')
      .select('contributed_xp')
      .eq('clan_id', clanId).eq('user_id', ctx.userId).single()
    await supabase.from('clan_members').update({
      contributed_xp: ((current as any)?.contributed_xp ?? 0) + mission.xp_clan_reward,
    }).eq('clan_id', clanId).eq('user_id', ctx.userId)
  })

  return ok({
    xpGranted:    xp.xp_granted,
    clanXpGained: mission.xp_clan_reward,
    leveledUp:    xp.leveled_up,
    newLevel:     xp.new_level,
    energyAfter:  energyRes.energy_after,
  })
})

async function assignClanMissions(supabase: any, clanId: string, userId: string, today: string) {
  const { data: templates } = await supabase
    .from('quest_templates')
    .select('id, difficulty, energy_cost, xp_reward')
    .eq('quest_type', 'clan_mission')
    .eq('is_active', true)

  if (!templates?.length) return

  await supabase.from('clan_missions').upsert(
    templates.slice(0, 3).map((t: any) => ({
      clan_id:        clanId,
      user_id:        userId,
      template_id:    t.id,
      energy_cost:    15,
      xp_reward:      t.xp_reward,
      xp_clan_reward: Math.floor(t.xp_reward * 0.5),
      assigned_date:  today,
      status:         'available',
    })),
    { onConflict: 'clan_id,user_id,template_id,assigned_date' }
  )
}

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
