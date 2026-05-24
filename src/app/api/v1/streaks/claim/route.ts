// src/app/api/v1/streaks/claim/route.ts
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient } from '@/lib/supabase/admin'
import { todayUTC } from '@/lib/utils'
import { XP_REWARDS, GAME_CONSTANTS } from '@/lib/constants/game'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withAuth(async (ctx) => {
  const db = getAdminClient()
  const today = todayUTC()
  const todayDate = new Date(today)

  // Get user streak state
  const { data: user, error: userErr } = await db
    .from('users')
    .select('streak_current, streak_longest, streak_last_active_date, streak_miss_used_at, streak_miss_eligible_at')
    .eq('id', ctx.userId)
    .single()

  if (userErr || !user) return err('User not found', 'NOT_FOUND', 404)

  const lastActive = user.streak_last_active_date
    ? new Date(user.streak_last_active_date)
    : null

  // Already claimed today
  if (lastActive && lastActive.toISOString().split('T')[0] === today) {
    return err('Streak already claimed today', 'ALREADY_CLAIMED')
  }

  let newStreak = user.streak_current
  let missUsed = false

  if (!lastActive) {
    // First ever claim
    newStreak = 1
  } else {
    const daysDiff = Math.floor(
      (todayDate.getTime() - lastActive.getTime()) / 86400_000
    )

    if (daysDiff === 1) {
      // Consecutive day — streak continues
      newStreak = user.streak_current + 1
    } else if (daysDiff === 2) {
      // Missed 1 day — check miss protection
      const missEligible = user.streak_miss_eligible_at
        ? new Date(user.streak_miss_eligible_at) <= todayDate
        : true // No prior miss — eligible

      if (missEligible) {
        // Use miss protection
        newStreak = user.streak_current + 1
        missUsed = true
      } else {
        // Miss protection on cooldown — reset streak
        newStreak = 1
      }
    } else {
      // Missed 2+ days — always reset
      newStreak = 1
    }
  }

  const newLongest = Math.max(newStreak, user.streak_longest)
  const xpGranted = Math.min(
    XP_REWARDS.STREAK_BASE + (newStreak - 1) * 10, // scaling bonus
    500 // cap at 500 XP per streak claim
  )

  // Compute next miss-eligible date (14 days from today if miss was used)
  const newMissEligibleAt = missUsed
    ? new Date(todayDate.getTime() + GAME_CONSTANTS.STREAK_MISS_PROTECTION_DAYS * 86400_000)
        .toISOString()
        .split('T')[0]
    : user.streak_miss_eligible_at

  // Update user streak state
  await db.from('users').update({
    streak_current:         newStreak,
    streak_longest:         newLongest,
    streak_last_active_date:today,
    streak_miss_eligible_at:newMissEligibleAt,
  }).eq('id', ctx.userId)

  // Grant XP for streak
  if (xpGranted > 0) {
    await db.rpc('grant_xp', {
      p_user_id:       ctx.userId,
      p_xp_base:       xpGranted,
      p_source_type:   'streak_bonus',
      p_source_ref_id: null,
    })
  }

  return ok({
    streakCurrent: newStreak,
    streakLongest: newLongest,
    xpGranted,
    missUsed,
  })
})
