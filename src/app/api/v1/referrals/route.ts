// src/app/api/v1/referrals/route.ts
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

  const { data: user } = await supabase
    .from('users')
    .select('referral_code, referral_eligible, level, xp_total')
    .eq('id', ctx.userId).single()

  // Check wallet
  const { data: walletData } = await supabase
    .from('wallets')
    .select('address')
    .eq('user_id', ctx.userId)
    .eq('status', 'connected')
    .maybeSingle()

  const { data: referrals } = await supabase
    .from('referrals')
    .select(`
      id, is_valid, created_at, validated_at,
      referee:users!referrals_referee_id_fkey(
        telegram_first_name, telegram_username, telegram_photo_url,
        level, league, last_active_at
      )
    `)
    .eq('referrer_id', ctx.userId)
    .order('created_at', { ascending: false })

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? ''
  const referralCode = (user as any)?.referral_code ?? ''

  // FIX: ?startapp= statt ?start= für Mini Apps
  const referralLink = `https://t.me/${botUsername}?startapp=${referralCode}`

  const list = (referrals ?? []).map((r: any) => ({
    id:          r.id,
    isValid:     r.is_valid,
    createdAt:   r.created_at,
    validatedAt: r.validated_at,
    referee: {
      firstName: r.referee?.telegram_first_name,
      username:  r.referee?.telegram_username,
      photoUrl:  r.referee?.telegram_photo_url,
      level:     r.referee?.level,
      league:    r.referee?.league,
    },
  }))

  const userLevel   = (user as any)?.level    ?? 1
  const userXp      = (user as any)?.xp_total ?? 0
  const hasWallet   = !!walletData?.address

  const levelMet  = userLevel >= 5
  const xpMet     = userXp   >= 2000
  const walletMet = hasWallet

  // Live berechnen — nicht auf DB-Spalte vertrauen
  const isEligible = levelMet && xpMet && walletMet

  // DB-Spalte aktualisieren falls nötig
  if (isEligible && !(user as any)?.referral_eligible) {
    await supabase.from('users')
      .update({ referral_eligible: true })
      .eq('id', ctx.userId)
  }

  const validCount = list.filter((r: any) => r.isValid).length

  // Meilenstein-Daten laden
  const { data: grantedMs } = await supabase
    .from('referral_milestones')
    .select('milestone, xp_reward, granted_at')
    .eq('user_id', ctx.userId)

  const MILESTONE_DEFS = [
    { threshold: 5,  xp: 2500  },
    { threshold: 10, xp: 6000  },
    { threshold: 25, xp: 18000 },
    { threshold: 50, xp: 40000 },
  ]
  const grantedSet = new Set((grantedMs ?? []).map((m: any) => m.milestone))

  const milestones = MILESTONE_DEFS.map(m => ({
    threshold: m.threshold,
    xpReward:  m.xp,
    reached:   validCount >= m.threshold,
    granted:   grantedSet.has(m.threshold),
  }))

  // Nächster offener Meilenstein
  const nextMilestone = MILESTONE_DEFS.find(m => validCount < m.threshold) ?? null

  return ok({
    referralCode,
    referralLink,
    referralEligible: isEligible,
    totalReferrals:   list.length,
    validReferrals:   validCount,
    referrals:        list,
    milestones,
    nextMilestone: nextMilestone ? {
      threshold: nextMilestone.threshold,
      xpReward:  nextMilestone.xp,
      remaining: nextMilestone.threshold - validCount,
    } : null,
    requirements: {
      level: {
        current:  userLevel,
        required: 5,
        met:      levelMet,
      },
      xp: {
        current:  userXp,
        required: 2000,
        met:      xpMet,
      },
      wallet: {
        met: walletMet,
      },
    },
  })
})
