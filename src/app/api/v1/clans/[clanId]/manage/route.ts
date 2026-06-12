// src/app/api/v1/clans/[clanId]/manage/route.ts
// Kick, Promote, Demote — nur Leader/Officer
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient }    from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withAuth(async (ctx) => {
  const clanId = ctx.params?.clanId
  if (!clanId) return err('Clan ID missing', 'MISSING_ID')

  let body: { action: 'kick' | 'promote' | 'demote'; targetUserId: string }
  try { body = await ctx.req.json() }
  catch { return err('Invalid body', 'BAD_REQUEST') }

  const { action, targetUserId } = body
  if (!action || !targetUserId) return err('action and targetUserId required', 'MISSING_FIELDS')
  if (!['kick', 'promote', 'demote'].includes(action)) return err('Invalid action', 'INVALID_ACTION')
  if (targetUserId === ctx.userId) return err('Cannot perform action on yourself', 'SELF_ACTION')

  const db = getAdminClient()

  // Eigene Rolle laden
  const { data: myMembership } = await db
    .from('clan_members')
    .select('role')
    .eq('clan_id', clanId)
    .eq('user_id', ctx.userId)
    .maybeSingle()

  if (!myMembership) return err('You are not in this clan', 'NOT_MEMBER', 403)

  const myRole = myMembership.role as 'leader' | 'officer' | 'member'

  // Ziel-Mitglied laden
  const { data: targetMembership } = await db
    .from('clan_members')
    .select('role')
    .eq('clan_id', clanId)
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (!targetMembership) return err('Target user is not in this clan', 'NOT_MEMBER', 404)

  const targetRole = targetMembership.role as 'leader' | 'officer' | 'member'

  // ── Berechtigungen ────────────────────────────────────────
  // Niemand kann den Leader kicken/demoten
  if (targetRole === 'leader') {
    return err('Cannot perform action on clan leader', 'FORBIDDEN', 403)
  }

  // Officer darf nur Members kicken, nicht andere Officers
  if (myRole === 'officer') {
    if (action !== 'kick') return err('Officers can only kick members', 'FORBIDDEN', 403)
    if (targetRole !== 'member') return err('Officers can only kick regular members', 'FORBIDDEN', 403)
  }

  // Member hat keine Rechte
  if (myRole === 'member') {
    return err('No permission', 'FORBIDDEN', 403)
  }

  // ── Aktionen ausführen ────────────────────────────────────
  if (action === 'kick') {
    const { error: kickErr } = await db.from('clan_members')
      .delete()
      .eq('clan_id', clanId)
      .eq('user_id', targetUserId)

    if (kickErr) return err('Failed to remove member', 'DB_ERROR', 500)

    // member_count wird vom AFTER-DELETE-Trigger fn_sync_clan_member_count
    // automatisch und sicher (GREATEST(0, …)) heruntergezählt. Beim Kick eines
    // Leaders übernimmt der Trigger zudem die Nachfolge. KEIN manuelles Update
    // hier — das wäre eine doppelte Dekrementierung.

    console.log(`[ClanManage] ${ctx.userId} kicked ${targetUserId} from clan ${clanId}`)
    return ok({ action: 'kicked', targetUserId })
  }

  if (action === 'promote') {
    // Nur Leader kann promoten
    if (myRole !== 'leader') return err('Only the leader can promote members', 'FORBIDDEN', 403)
    if (targetRole !== 'member') return err('Can only promote regular members to officer', 'INVALID_TARGET')

    await db.from('clan_members')
      .update({ role: 'officer' })
      .eq('clan_id', clanId)
      .eq('user_id', targetUserId)

    console.log(`[ClanManage] ${ctx.userId} promoted ${targetUserId} to officer in clan ${clanId}`)
    return ok({ action: 'promoted', targetUserId, newRole: 'officer' })
  }

  if (action === 'demote') {
    // Nur Leader kann demoten
    if (myRole !== 'leader') return err('Only the leader can demote officers', 'FORBIDDEN', 403)
    if (targetRole !== 'officer') return err('Can only demote officers', 'INVALID_TARGET')

    await db.from('clan_members')
      .update({ role: 'member' })
      .eq('clan_id', clanId)
      .eq('user_id', targetUserId)

    console.log(`[ClanManage] ${ctx.userId} demoted ${targetUserId} to member in clan ${clanId}`)
    return ok({ action: 'demoted', targetUserId, newRole: 'member' })
  }

  return err('Unknown action', 'UNKNOWN_ACTION')
})
