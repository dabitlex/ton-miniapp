// src/app/api/v1/clans/my/route.ts
// Gibt die eigene Clan-Mitgliedschaft + Clan-Details zurück
import { withAuth, ok } from '@/app/api/v1/_lib/handler'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export const GET = withAuth(async (ctx) => {
  const supabase = db()

  // Mitgliedschaft laden
  const { data: membership } = await supabase
    .from('clan_members')
    .select('clan_id, role, contributed_xp, joined_at')
    .eq('user_id', ctx.userId)
    .maybeSingle()

  if (!membership) return ok(null)

  // Clan-Details laden
  const { data: clan } = await supabase
    .from('clans')
    .select('id, name, slug, description, avatar_url, member_count, season_xp, xp_total, level, wins, losses, is_public, leader_id')
    .eq('id', membership.clan_id)
    .single()

  if (!clan) return ok(null)

  // Mitglieder laden
  const { data: members } = await supabase
    .from('clan_members')
    .select(`
      user_id, role, contributed_xp, joined_at,
      user:users(id, telegram_first_name, telegram_username, telegram_photo_url, level, league, last_active_at)
    `)
    .eq('clan_id', membership.clan_id)
    .order('contributed_xp', { ascending: false })

  return ok({
    role:          membership.role,
    contributedXp: membership.contributed_xp,
    joinedAt:      membership.joined_at,
    clan: {
      id:          (clan as any).id,
      name:        (clan as any).name,
      slug:        (clan as any).slug,
      description: (clan as any).description,
      avatarUrl:   (clan as any).avatar_url,
      memberCount: (clan as any).member_count,
      seasonXp:    (clan as any).season_xp,
      xpTotal:     (clan as any).xp_total,
      level:       (clan as any).level,
      wins:        (clan as any).wins,
      losses:      (clan as any).losses,
      isPublic:    (clan as any).is_public,
      leaderId:    (clan as any).leader_id,
    },
    members: (members ?? []).map((m: any) => ({
      userId:           m.user_id,
      role:             m.role,
      contributedXp:    m.contributed_xp,
      joinedAt:         m.joined_at,
      telegramFirstName:m.user?.telegram_first_name,
      telegramUsername: m.user?.telegram_username,
      telegramPhotoUrl: m.user?.telegram_photo_url,
      level:            m.user?.level,
      league:           m.user?.league,
      lastActiveAt:     m.user?.last_active_at ?? null,
    })),
  })
})
