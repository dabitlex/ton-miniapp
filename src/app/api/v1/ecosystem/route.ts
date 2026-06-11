// src/app/api/v1/ecosystem/route.ts
import { withAuth, ok } from '@/app/api/v1/_lib/handler'
import { getAdminClient } from '@/lib/supabase/admin'
import { ECOSYSTEM_TIERS } from '@/lib/constants/game'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withAuth(async (ctx) => {
  const db = getAdminClient()

  // Aktiver Boost
  const { data: boost } = await db
    .from('ecosystem_support')
    .select(`
      tier, ton_amount, xp_boost_percent,
      boost_active_from, boost_active_until,
      tx:ton_transactions(tx_hash)
    `)
    .eq('user_id', ctx.userId)
    .eq('is_active', true)
    .lte('boost_active_from', new Date().toISOString())
    .gte('boost_active_until', new Date().toISOString())
    .order('xp_boost_percent', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Pending TX prüfen — verhindert Doppelkauf
  const { data: pendingSupport } = await db
    .from('ecosystem_support')
    .select(`
      tier, xp_boost_percent,
      tx:ton_transactions(status)
    `)
    .eq('user_id', ctx.userId)
    .eq('is_active', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const hasPendingTx = (pendingSupport?.tx as any)?.status === 'pending'

  // Offene Kauf-Sperre prüfen (verhindert Doppelkauf, übersteht App-Neustart)
  const LOCK_MINUTES = 15
  const { data: lockUser } = await db
    .from('users')
    .select('purchase_intent_at, purchase_intent_tier')
    .eq('id', ctx.userId)
    .maybeSingle()

  const intentAt = lockUser?.purchase_intent_at ? new Date(lockUser.purchase_intent_at).getTime() : 0
  const lockActive = intentAt > 0 && (Date.now() - intentAt) < LOCK_MINUTES * 60_000


  // History
  const { data: history } = await db
    .from('ecosystem_support')
    .select(`
      id, tier, ton_amount, xp_boost_percent,
      is_active, boost_active_from, boost_active_until, created_at,
      tx:ton_transactions(tx_hash, status, amount_ton)
    `)
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(10)

  return ok({
    tiers: ECOSYSTEM_TIERS,
    activeBoost: boost ? {
      tier:             boost.tier,
      boostPercent:     boost.xp_boost_percent,
      tonAmount:        boost.ton_amount,
      boostActiveFrom:  boost.boost_active_from,
      boostActiveUntil: boost.boost_active_until,
      txHash:           (boost.tx as any)?.tx_hash ?? null,
    } : null,
    // Pending TX → UI zeigt "Bestätigung ausstehend" und blockiert neue Käufe
    pendingBoost: hasPendingTx ? {
      tier:        pendingSupport!.tier,
      boostPercent:pendingSupport!.xp_boost_percent,
    } : null,
    // Offene Kauf-Sperre → UI deaktiviert Kauf-Buttons + zeigt "wird verarbeitet"
    purchaseInProgress: lockActive ? {
      tier: lockUser!.purchase_intent_tier,
      at:   lockUser!.purchase_intent_at,
    } : null,
    history: (history ?? []).map(h => ({
      id:          h.id,
      tier:        h.tier,
      tonAmount:   h.ton_amount,
      boostPercent:h.xp_boost_percent,
      isActive:    h.is_active,
      boostUntil:  h.boost_active_until,
      createdAt:   h.created_at,
      txStatus:    (h.tx as any)?.status ?? 'unknown',
    })),
  })
})
