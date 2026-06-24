// src/app/api/v1/clans/[clanId]/requests/route.ts
// Beitrittsanfragen verwalten — nur Leader/Officer.
//   GET  -> offene Anfragen dieses Clans (mit Profil des Anfragenden)
//   POST -> { requestId, action: 'approve' | 'reject' }

import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient }    from '@/lib/supabase/admin'
import { GAME_CONSTANTS }    from '@/lib/constants/game'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Eigene Rolle im Clan laden + auf Leader/Officer gaten.
async function requireManager(db: ReturnType<typeof getAdminClient>, clanId: string, userId: string) {
  const { data } = await db
    .from('clan_members').select('role')
    .eq('clan_id', clanId).eq('user_id', userId).maybeSingle()
  const role = (data?.role as 'leader' | 'officer' | 'member' | undefined) ?? null
  return role === 'leader' || role === 'officer' ? role : null
}

export const GET = withAuth(async (ctx) => {
  const clanId = ctx.params?.clanId
  if (!clanId) return err('Clan ID missing', 'MISSING_ID')

  const db   = getAdminClient()
  const role = await requireManager(db, clanId, ctx.userId)
  if (!role) return err('Only leaders and officers can view requests', 'FORBIDDEN', 403)

  const { data, error } = await db
    .from('clan_join_requests')
    .select('id, user_id, message, created_at, users(telegram_first_name, telegram_username, telegram_photo_url, level)')
    .eq('clan_id', clanId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) return err('Failed to load requests', 'DB_ERROR', 500)

  const requests = (data ?? []).map((r: any) => ({
    id:         r.id,
    userId:     r.user_id,
    name:       r.users?.telegram_first_name || r.users?.telegram_username || 'Member',
    avatar:     r.users?.telegram_photo_url ?? null,
    level:      r.users?.level ?? 1,
    message:    r.message ?? null,
    createdAt:  r.created_at,
  }))

  return ok({ requests, count: requests.length })
})

export const POST = withAuth(async (ctx) => {
  const clanId = ctx.params?.clanId
  if (!clanId) return err('Clan ID missing', 'MISSING_ID')

  let body: { requestId?: string; action?: 'approve' | 'reject' }
  try { body = await ctx.req.json() }
  catch { return err('Invalid body', 'BAD_REQUEST') }

  const { requestId, action } = body
  if (!requestId || !action) return err('requestId and action required', 'MISSING_FIELDS')
  if (!['approve', 'reject'].includes(action)) return err('Invalid action', 'INVALID_ACTION')

  const db   = getAdminClient()
  const role = await requireManager(db, clanId, ctx.userId)
  if (!role) return err('Only leaders and officers can decide requests', 'FORBIDDEN', 403)

  // Anfrage laden + auf diesen Clan + pending verifizieren.
  const { data: req } = await db
    .from('clan_join_requests')
    .select('id, clan_id, user_id, status')
    .eq('id', requestId)
    .maybeSingle()

  if (!req || req.clan_id !== clanId) return err('Request not found', 'NOT_FOUND', 404)
  if (req.status !== 'pending')        return err('Request already decided', 'ALREADY_DECIDED', 409)

  const now = new Date().toISOString()

  // ── REJECT ────────────────────────────────────────────────────────────────
  if (action === 'reject') {
    await db.from('clan_join_requests')
      .update({ status: 'declined', decided_by: ctx.userId, decided_at: now })
      .eq('id', requestId)
    return ok({ decided: 'rejected', requestId })
  }

  // ── APPROVE ───────────────────────────────────────────────────────────────
  // Re-Checks zum Entscheidungszeitpunkt (Zustand kann sich geändert haben).
  const { data: clan } = await db
    .from('clans').select('member_count, is_active').eq('id', clanId).single()
  if (!clan || !clan.is_active) return err('Clan not found', 'NOT_FOUND', 404)
  if (clan.member_count >= GAME_CONSTANTS.CLAN_MAX_MEMBERS) {
    return err('Clan is full — cannot approve', 'CLAN_FULL', 409)
  }

  // Anfragender inzwischen schon woanders Mitglied?
  const { data: alreadyMember } = await db
    .from('clan_members').select('clan_id').eq('user_id', req.user_id).maybeSingle()
  if (alreadyMember) {
    // Anfrage als erledigt markieren, aber nicht beitreten.
    await db.from('clan_join_requests')
      .update({ status: 'declined', decided_by: ctx.userId, decided_at: now })
      .eq('id', requestId)
    return err('User already joined another clan', 'ALREADY_IN_CLAN', 409)
  }

  // Beitritt (member_count pflegt der Trigger trg_clan_member_count).
  const { error: insErr } = await db.from('clan_members')
    .insert({ clan_id: clanId, user_id: req.user_id, role: 'member' })
  if (insErr) return err(`Failed to add member: ${insErr.message}`, 'DB_ERROR', 500)

  await db.from('clan_join_requests')
    .update({ status: 'accepted', decided_by: ctx.userId, decided_at: now })
    .eq('id', requestId)

  return ok({ decided: 'approved', requestId, userId: req.user_id })
})
