// src/app/api/v1/users/me/route.ts
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { createClient }     from '@supabase/supabase-js'

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
  const supabase = db()

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', ctx.userId)
    .single()

  if (error || !user) return err('User nicht gefunden', 'NOT_FOUND', 404)

  // Energie berechnen ohne DB-Schreibzugriff
  const now          = Date.now()
  const lastUpdated  = new Date((user as any).energy_last_updated).getTime()
  const secondsElapsed = Math.floor((now - lastUpdated) / 1000)
  const ticks        = Math.floor(secondsElapsed / 900)
  const energyCurrent= Math.min(100, (user as any).energy_current + ticks)
  const tickedAt     = new Date(lastUpdated + ticks * 900_000).toISOString()
  const secondsToFull= energyCurrent >= 100 ? 0 : (100 - energyCurrent) * 900
  const nextRegenAt  = energyCurrent >= 100 ? null
    : new Date(lastUpdated + (ticks + 1) * 900_000).toISOString()

  // Wallet laden
  const { data: wallet } = await supabase
    .from('wallets')
    .select('address, address_friendly, status, connected_at')
    .eq('user_id', ctx.userId)
    .eq('status', 'connected')
    .maybeSingle()

  // Clan-Mitgliedschaft laden
  const { data: clanMember } = await supabase
    .from('clan_members')
    .select('clan_id, role, contributed_xp, joined_at, clan:clans(id, name, slug, avatar_url, level, season_xp, member_count)')
    .eq('user_id', ctx.userId)
    .maybeSingle()

  const u = user as any

  return ok({
    id:                   u.id,
    telegramId:           u.telegram_id,
    telegramUsername:     u.telegram_username,
    telegramFirstName:    u.telegram_first_name,
    telegramLastName:     u.telegram_last_name,
    telegramPhotoUrl:     u.telegram_photo_url,
    telegramIsPremium:    u.telegram_is_premium,
    level:                u.level,
    xpTotal:              u.xp_total,
    xpCurrentLevel:       u.xp_current_level,
    league:               u.league,
    seasonXp:             u.season_xp,
    streakCurrent:        u.streak_current,
    streakLongest:        u.streak_longest,
    streakLastActiveDate: u.streak_last_active_date,
    xpEarnedToday:        u.xp_earned_today,
    isNewUser:            false,
    onboardingCompleted:  u.onboarding_completed,
    referralCode:         u.referral_code,
    referralEligible:     u.referral_eligible,
    // Energie (live berechnet)
    energy: {
      current:       energyCurrent,
      max:           100,
      usedToday:     u.energy_used_today,
      lastUpdated:   tickedAt,
      nextRegenAt,
      secondsToFull,
    },
    // Wallet
    wallet: wallet ? {
      address:         wallet.address,
      addressFriendly: wallet.address_friendly,
      connectedAt:     wallet.connected_at,
    } : null,
    // Clan
    clan: clanMember ? {
      clanId:        (clanMember.clan as any)?.id,
      name:          (clanMember.clan as any)?.name,
      slug:          (clanMember.clan as any)?.slug,
      avatarUrl:     (clanMember.clan as any)?.avatar_url,
      level:         (clanMember.clan as any)?.level,
      seasonXp:      (clanMember.clan as any)?.season_xp,
      memberCount:   (clanMember.clan as any)?.member_count,
      role:          clanMember.role,
      contributedXp: clanMember.contributed_xp,
      joinedAt:      clanMember.joined_at,
    } : null,
  })
})

// PATCH /api/v1/users/me — Profil aktualisieren
export const PATCH = withAuth(async (ctx) => {
  let body: Record<string, any>
  try { body = await ctx.req.json() }
  catch { return err('Ungültiger Body', 'BAD_REQUEST') }

  const allowed = ['telegram_photo_url', 'telegram_username', 'onboarding_completed']
  const updates: Record<string, any> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return err('Keine gültigen Felder', 'NO_VALID_FIELDS')
  }

  const supabase = db()
  await supabase.from('users').update(updates).eq('id', ctx.userId)

  return ok({ updated: true })
})
