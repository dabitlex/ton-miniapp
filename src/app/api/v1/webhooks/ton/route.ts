// src/app/api/v1/webhooks/ton/route.ts
// Receives confirmed transaction events from TON Center webhook
import { NextRequest }    from 'next/server'
import { withWebhook, ok, err } from '../../_lib/handler'
import { getAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withWebhook(async (_req: NextRequest, rawBody: string) => {
  let payload: any
  try { payload = JSON.parse(rawBody) }
  catch { return err('Invalid JSON payload', 'BAD_REQUEST') }

  const { tx_hash, event_type, sender, recipient, amount_nano, block_seq_no } = payload

  if (!tx_hash) return ok({ handled: false, reason: 'No tx_hash' })

  const db = getAdminClient()

  // Update transaction status to confirmed
  await db.from('ton_transactions').update({
    status:            'confirmed',
    confirmed_at:      new Date().toISOString(),
    sender_address:    sender    ?? null,
    recipient_address: recipient ?? null,
    amount_nano:       amount_nano ?? null,
    block_seq_no:      block_seq_no ?? null,
    raw_data:          payload,
  }).eq('tx_hash', tx_hash)

  // Find linked ecosystem support record
  const { data: txRecord } = await db
    .from('ton_transactions')
    .select('id, amount_nano')
    .eq('tx_hash', tx_hash)
    .single()

  if (txRecord) {
    // Activate ecosystem boost
    const updated = await db
      .from('ecosystem_support')
      .update({ is_active: true })
      .eq('tx_id', txRecord.id)
      .select('user_id, xp_boost_percent, tier')

    if (updated.data?.[0]) {
      const { user_id, xp_boost_percent, tier } = updated.data[0]
      // Log system event
      await db.from('system_events').insert({
        event_type: 'ecosystem_boost_activated',
        payload: { user_id, tier, xp_boost_percent, tx_hash },
        success: true,
      })
    }
  }

  return ok({ handled: true, tx_hash })
}, 'TON_WEBHOOK_SECRET')