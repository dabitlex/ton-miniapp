// src/app/api/v1/users/me/route.ts 
import { NextResponse } from 'next/server'
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient } from '@/lib/supabase/admin'
import { GAME_CONSTANTS } from '@/lib/constants/game'
import { todayUTC } from '@/lib/utils'
import type { UserProfile, EnergyState } from '@/types/game'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withAuth(async (ctx) => {
  const db = getAdminClient()

  // Fetch user + wallet + clan in parallel
  const [userResult, walletResult, clanResult, boostResult] = await Promise.all([
    db.from('users').select('*').eq('id', ctx.userId).single(),
    db.from('wallets')
      .select('address, address_friendly, wallet_version, status, connected_at')
      .eq('user_id', ctx.userId)
      .eq('status', 'connected')
      .maybeSingle(),
    db.from('clan_members')
      .select('clan_id, role, joined_at, contributed_xp, clans(name)')
      .eq('user_id', ctx.userId)
      .maybeSingle(),
    db.from('ecosystem_support')
      .select('xp_boost_percent')
      .eq('user_id', ctx.userId)
      .eq('is_active', true)
      .lte('boost_active_from', new Date().toISOString())
      .gte('boost_active_until', new Date().toISOString())
      .order('xp_boost_percent', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!userResult.data) return err('User not found', 'NOT_FOUND', 404)

  const u = userResult.data
  const today = todayUTC()

  // Compute energy from timestamps (no DB write)
  const energy = computeEnergy(u.energy_current, u.energy_last_updated)

  // Update last_active_at + reset daily XP counter if stale (fire-and-forget)
  const updates: Record<string, unknown> = { last_active_at: new Date().toISOString() }
  if (u.xp_earned_today_date < today) {
    updates['xp_earned_today'] = 0
    updates['xp_earned_today_date'] = today
  }
  db.from('users').update(updates).eq('id', ctx.userId).then(() => {})

  // Update daily stats (fire-and-forget)
  db.from('user_daily_stats')
    .upsert({ user_id: ctx.userId, stat_date: today, was_active: true, login_count: 1 },
      { onConflict: 'user_id,stat_date' })
    .then(() => {})

  const profile: UserProfile = {
    id: u.id,
    telegramId: u.telegram_id,
    telegramUsername: u.telegram_username,
    telegramFirstName: u.telegram_first_name,
    telegramLastName: u.telegram_last_name,
    telegramPhotoUrl: u.telegram_photo_url,
    telegramIsPremium: u.telegram_is_premium,
    level: u.level,
    xpTotal: u.xp_total,
    xpCurrentLevel: u.xp_current_level,
    league: u.league,
    energy: {
      ...energy,
      usedToday: u.energy_date === today ? u.energy_used_today : 0,
    },
    streakCurrent: u.streak_current,
    streakLongest: u.streak_longest,
    streakLastActiveDate: u.streak_last_active_date,
    streakMissEligibleAt: u.streak_miss_eligible_at,
    xpEarnedToday: u.xp_earned_today_date === today ? u.xp_earned_today : 0,
    isFlagged: u.is_flagged,
    isBanned: u.is_banned,
    currentSeasonId: u.current_season_id,
    seasonXp: u.season_xp,
    referralCode: u.referral_code,
    referralEligible: u.referral_eligible,
    onboardingCompleted: u.onboarding_completed,
    lastActiveAt: u.last_active_at,
    createdAt: u.created_at,
    wallet: walletResult.data
      ? {
          address: walletResult.data.address,
          addressFriendly: walletResult.data.address_friendly,
          walletVersion: walletResult.data.wallet_version,
          status: walletResult.data.status as 'connected',
          connectedAt: walletResult.data.connected_at,
        }
      : undefined,
    clan: clanResult.data
      ? {
          clanId: clanResult.data.clan_id,
          clanName: (clanResult.data.clans as any)?.name ?? '',
          role: clanResult.data.role as any,
          joinedAt: clanResult.data.joined_at,
          contributedXp: clanResult.data.contributed_xp,
        }
      : undefined,
    ecosystemBoost: boostResult.data?.xp_boost_percent ?? undefined,
  }

  return ok(profile)
})

function computeEnergy(
  current: number,
  lastUpdatedISO: string
): Omit<EnergyState, 'usedToday'> {
  const lastUpdated = new Date(lastUpdatedISO)
  const now = new Date()
  const secondsElapsed = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000)
  const ticks = Math.floor(secondsElapsed / GAME_CONSTANTS.ENERGY_REGEN_INTERVAL_SEC)
  const newEnergy = Math.min(GAME_CONSTANTS.MAX_ENERGY, current + ticks) as number
  const lastTickAt = new Date(lastUpdated.getTime() + ticks * GAME_CONSTANTS.ENERGY_REGEN_INTERVAL_SEC * 1000)
  const nextRegenAt =
    newEnergy < GAME_CONSTANTS.MAX_ENERGY
      ? new Date(lastTickAt.getTime() + GAME_CONSTANTS.ENERGY_REGEN_INTERVAL_SEC * 1000)
      : null
  const secondsToFull =
    newEnergy >= GAME_CONSTANTS.MAX_ENERGY
      ? 0
      : (GAME_CONSTANTS.MAX_ENERGY - newEnergy) * GAME_CONSTANTS.ENERGY_REGEN_INTERVAL_SEC

  return {
    current: newEnergy,
    max: 100,
    lastUpdated: lastUpdatedISO,
    nextRegenAt: nextRegenAt?.toISOString() ?? null,
    secondsToFull,
  }
}
