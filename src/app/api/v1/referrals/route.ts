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

  return ok({
    referralCode,
    referralLink,
    referralEligible: (user as any)?.referral_eligible,
    totalReferrals:   list.length,
    validReferrals:   list.filter((r: any) => r.isValid).length,
    referrals:        list,
    requirements: {
      level: {
        current:  (user as any)?.level     ?? 1,
        required: 5,
        met:      ((user as any)?.level    ?? 1) >= 5,
      },
      xp: {
        current:  (user as any)?.xp_total  ?? 0,
        required: 2000,
        met:      ((user as any)?.xp_total ?? 0) >= 2000,
      },
    },
  })
})
