// src/app/api/v1/clans/[clanId]/members/[userId]/info/route.ts
// Mitglieder-Detailinfos — NUR Leader/Officer.
//   GET -> { joinedAt, lastOnlineAt, lastClanActivityAt }
// "lastClanActivityAt" = jüngstes von letzter Clan-Chat-Nachricht und letzter
// abgeschlossener Clan-Mission. Der Gate sitzt server-seitig: nur Leader/Officer
// des Clans bekommen diese Infos.

import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { createClient }      from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export const GET = withAuth(async (ctx) => {
  const clanId = ctx.params?.clanId
  const userId = ctx.params?.userId
  if (!clanId || !userId) return err('Missing params', 'MISSING_ID')

  const supabase = db()

  // Viewer muss Leader/Officer dieses Clans sein.
  const { data: me } = await supabase
    .from('clan_members').select('role')
    .eq('clan_id', clanId).eq('user_id', ctx.userId).maybeSingle()
  if (!me || (me.role !== 'leader' && me.role !== 'officer')) {
    return err('Only leaders and officers can view member info', 'FORBIDDEN', 403)
  }

  // Ziel muss Mitglied desselben Clans sein.
  const { data: target } = await supabase
    .from('clan_members').select('joined_at')
    .eq('clan_id', clanId).eq('user_id', userId).maybeSingle()
  if (!target) return err('Member not found', 'NOT_FOUND', 404)

  // Zuletzt online (allgemeine App-Aktivität).
  const { data: u } = await supabase
    .from('users').select('last_active_at').eq('id', userId).maybeSingle()

  // Letzte Clan-Aktivität: jüngste Chat-Nachricht ODER abgeschlossene Mission.
  const { data: lastMsg } = await supabase
    .from('clan_chat_messages').select('created_at')
    .eq('clan_id', clanId).eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()

  const { data: lastMission } = await supabase
    .from('clan_missions').select('completed_at')
    .eq('clan_id', clanId).eq('user_id', userId).eq('status', 'completed')
    .order('completed_at', { ascending: false }).limit(1).maybeSingle()

  const candidates = [lastMsg?.created_at, lastMission?.completed_at].filter(Boolean) as string[]
  const lastClanActivityAt = candidates.length
    ? candidates.sort().slice(-1)[0]   // ISO-Strings sortieren chronologisch
    : null

  return ok({
    joinedAt:           target.joined_at,
    lastOnlineAt:       u?.last_active_at ?? null,
    lastClanActivityAt,
  })
})
