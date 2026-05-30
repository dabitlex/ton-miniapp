// src/app/api/v1/clans/[clanId]/route.ts
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { createClient }     from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/v1/clans/:clanId — Clan-Details mit Mitgliedern
export const GET = withAuth(async (ctx, routeCtx) => {
  const clanId = (routeCtx as any).params?.clanId
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

  // Eigene Mitgliedschaft prüfen
  const myMembership = members.find((m: any) => m.userId === ctx.userId)

  return ok({ clan: clanRes.data, members, myRole: myMembership?.role ?? null })
})
