// src/app/api/v1/ecosystem/support/route.ts 
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient }    from '@/lib/supabase/admin'
import { ECOSYSTEM_TIERS }   from '@/lib/constants/game'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withAuth(async (ctx) => {
  let body: { txHash?: string; tonAmount?: string | number }
  try { body = await ctx.req.json() }
  catch { return err('Invalid body', 'BAD_REQUEST') }

  const { txHash, tonAmount: rawAmount } = body
  if (!txHash || !rawAmount) return err('txHash and tonAmount required', 'MISSING_FIELDS')

  const tonAmount = parseFloat(String(rawAmount))
  if (isNaN(tonAmount) || tonAmount <= 0) return err('Invalid tonAmount', 'INVALID_AMOUNT')

  // Wallet required
  const db = getAdminClient()
  const { data: wallet } = await db
    .from('wallets')
    .select('address')
    .eq('user_id', ctx.userId)
    .eq('status', 'connected')
    .maybeSingle()

  if (!wallet) return err('Connect a TON wallet first', 'NO_WALLET', 403)

  // Classify tier
  const sorted = [...ECOSYSTEM_TIERS].sort((a, b) => b.tonAmount - a.tonAmount)
  const tier   = sorted.find(t => tonAmount >= t.tonAmount)
  if (!tier) return err(`Minimum 1 TON required for Ecosystem Support`, 'BELOW_MIN')

  // Active season required
  const { data: season } = await db
    .from('seasons')
    .select('id, ends_at')
    .eq('status', 'active')
    .maybeSingle()

  if (!season) return err('No active season', 'NO_SEASON', 404)

  // Create pending TON transaction record
  const { data: tx, error: txErr } = await db
    .from('ton_transactions')
    .insert({
      tx_hash:           txHash,
      sender_address:    wallet.address,
      recipient_address: process.env.NEXT_PUBLIC_TON_TREASURY_WALLET ?? 'treasury',
      amount_nano:       Math.round(tonAmount * 1e9),
      status:            'pending',
      detected_via:      'user_report',
    })
    .select('id')
    .single()

  if (txErr) {
    if (txErr.code === '23505') return err('Transaction already registered', 'DUPLICATE_TX', 409)
    return err(`Transaction record failed: ${txErr.message}`, 'DB_ERROR', 500)
  }

  // Create ecosystem support record (inactive until confirmed)
  await db.from('ecosystem_support').insert({
    user_id:           ctx.userId,
    season_id:         season.id,
    tx_id:             tx.id,
    tier:              tier.key,
    ton_amount:        tonAmount,
    xp_boost_percent:  tier.boostPercent,
    boost_active_from: new Date().toISOString(),
    boost_active_until:season.ends_at,
    is_active:         false, // activated on webhook confirmation
  })

  return ok({
    pending:    true,
    tier:       tier.key,
    boostPct:   tier.boostPercent,
    message:    'Transaction submitted. Your XP boost will activate after network confirmation (~30s).',
  })
})
