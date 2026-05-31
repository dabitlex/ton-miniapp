// src/app/api/v1/ecosystem/support/route.ts
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient }    from '@/lib/supabase/admin'
import { ECOSYSTEM_TIERS }   from '@/lib/constants/game'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withAuth(async (ctx) => {
  let body: { txHash?: string; tonAmount?: string | number; source?: string }
  try { body = await ctx.req.json() }
  catch { return err('Invalid body', 'BAD_REQUEST') }

  const { txHash, tonAmount: rawAmount, source } = body
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
  if (!tier) return err('Minimum 1 TON required for Ecosystem Support', 'BELOW_MIN')

  // Active season required
  const { data: season } = await db
    .from('seasons')
    .select('id, ends_at')
    .eq('status', 'active')
    .maybeSingle()

  if (!season) return err('No active season', 'NO_SEASON', 404)

  // TX via TONapi Polling gefunden = bereits on-chain bestätigt
  // TX via Webhook = ebenfalls bestätigt
  // Nur wenn source unbekannt → pending
  const isConfirmedOnChain = source === 'tonapi_poll' || source === 'tonapi'
  const txStatus = isConfirmedOnChain ? 'confirmed' : 'pending'

  console.log(`[EcoSupport] TX ${txHash} source=${source} status=${txStatus}`)

  // TON Transaction speichern
  const { data: tx, error: txErr } = await db
    .from('ton_transactions')
    .insert({
      tx_hash:           txHash,
      sender_address:    wallet.address,
      recipient_address: process.env.NEXT_PUBLIC_TON_TREASURY_WALLET ?? 'treasury',
      amount_nano:       Math.round(tonAmount * 1e9),
      status:            txStatus,
      confirmed_at:      isConfirmedOnChain ? new Date().toISOString() : null,
      detected_via:      source ?? 'user_report',
    })
    .select('id')
    .single()

  if (txErr) {
    if (txErr.code === '23505') return err('Transaction already registered', 'DUPLICATE_TX', 409)
    return err(`Transaction record failed: ${txErr.message}`, 'DB_ERROR', 500)
  }

  // Ecosystem Support erstellen
  // Wenn TX bereits bestätigt → Boost sofort aktivieren
  await db.from('ecosystem_support').insert({
    user_id:           ctx.userId,
    season_id:         season.id,
    tx_id:             tx.id,
    tier:              tier.key,
    ton_amount:        tonAmount,
    xp_boost_percent:  tier.boostPercent,
    boost_active_from: new Date().toISOString(),
    boost_active_until:season.ends_at,
    is_active:         isConfirmedOnChain, // ← sofort aktiv wenn on-chain bestätigt
  })

  if (isConfirmedOnChain) {
    console.log(`[EcoSupport] ✅ Boost sofort aktiviert: ${tier.key} +${tier.boostPercent}% für User ${ctx.userId}`)
    return ok({
      activated:  true,
      tier:       tier.key,
      boostPct:   tier.boostPercent,
      message:    'Boost aktiviert!',
    })
  }

  return ok({
    pending:  true,
    tier:     tier.key,
    boostPct: tier.boostPercent,
    message:  'Transaction submitted. Boost activates after confirmation (~30s).',
  })
})
