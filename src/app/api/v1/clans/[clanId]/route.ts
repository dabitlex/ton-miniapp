// src/app/api/v1/clans/[clanId]/route.ts
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { createClient }      from '@supabase/supabase-js'

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

  const [clanRes, membersRes] = await Promise.all([
    supabase.from('clans').select('*').eq('id', clanId).single(),
    supabase.from('clan_members').select(`
      user_id, role, joined_at, contributed_xp,
      user:users(id, telegram_first_name, telegram_username, telegram_photo_url, level, league, last_active_at)
    `).eq('clan_id', clanId).order('contributed_xp', { ascending: false }),
  ])

  if (!clanRes.data) return err('Clan nicht gefunden', 'NOT_FOUND', 404)

  const members = (membersRes.data ?? []).map((m: any) => ({
    userId:           m.user_id,
    role:             m.role,
    joinedAt:         m.joined_at,
    contributedXp:    m.contributed_xp,
    telegramFirstName:m.user?.telegram_first_name,
    telegramUsername: m.user?.telegram_username,
    telegramPhotoUrl: m.user?.telegram_photo_url,
    level:            m.user?.level,
    league:           m.user?.league,
    lastActiveAt:     m.user?.last_active_at,
  }))

  const myMembership = members.find((m: any) => m.userId === ctx.userId)

  return ok({ clan: clanRes.data, members, myRole: myMembership?.role ?? null })
})

// PATCH — Clan-Einstellungen ändern (nur Leader): join_policy und/oder description.
export const PATCH = withAuth(async (ctx) => {
  const clanId = ctx.params?.clanId
  if (!clanId) return err('Clan-ID fehlt', 'MISSING_ID')

  let body: { joinPolicy?: 'open' | 'request'; description?: string }
  try { body = await ctx.req.json() }
  catch { return err('Invalid body', 'BAD_REQUEST') }

  const update: Record<string, unknown> = {}

  if (body.joinPolicy !== undefined) {
    if (!['open', 'request'].includes(body.joinPolicy)) {
      return err('joinPolicy must be "open" or "request"', 'INVALID_POLICY')
    }
    update.join_policy = body.joinPolicy
  }

  if (body.description !== undefined) {
    // Leeren erlaubt (= Beschreibung löschen). Spalte ist NOT NULL default ''.
    const desc = String(body.description).replace(/\s+/g, ' ').trim()
    if (desc.length > 280) return err('Description too long (max 280)', 'DESC_TOO_LONG')
    update.description = desc
  }

  if (Object.keys(update).length === 0) {
    return err('Nothing to update', 'NO_FIELDS')
  }

  const supabase = db()

  // Nur der Leader darf Clan-Einstellungen ändern.
  const { data: membership } = await supabase
    .from('clan_members').select('role')
    .eq('clan_id', clanId).eq('user_id', ctx.userId).maybeSingle()
  if (membership?.role !== 'leader') {
    return err('Only the clan leader can edit the clan', 'FORBIDDEN', 403)
  }

  const { error } = await supabase.from('clans').update(update).eq('id', clanId)
  if (error) return err('Failed to update clan', 'DB_ERROR', 500)

  return ok({ updated: Object.keys(update) })
})
