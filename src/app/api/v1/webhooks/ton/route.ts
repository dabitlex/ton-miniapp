// src/app/api/v1/webhooks/ton/route.ts 
// Empfängt Transaktions-Events von TONapi.io
import { NextRequest, NextResponse } from 'next/server'
import { ok, err }        from '@/app/api/v1/_lib/handler'
import { createClient }   from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(req: NextRequest) {
  // ── Sicherheit: Secret-Token in URL prüfen ────────────────
  const url    = new URL(req.url)
  const secret = url.searchParams.get('secret')

  if (!secret || secret !== process.env.TON_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: any
  try { payload = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // ── TONapi.io Webhook Format ──────────────────────────────
  // TONapi sendet Events in verschiedenen Formaten je nach Subscription-Typ
  // Wir unterstützen beide gängigen Formate:

  let txHash: string | null     = null
  let senderAddress: string | null  = null
  let recipientAddress: string | null = null
  let amountNano: string | null  = null

  // Format 1: TONapi.io account_transaction event
  if (payload.event_id === 'account_transaction' || payload.account_id) {
    const tx = payload.data?.lt ? payload.data : payload
    txHash          = tx.hash          ?? tx.tx_hash       ?? null
    senderAddress   = tx.in_msg?.source?.address           ?? null
    recipientAddress= tx.account?.address ?? tx.in_msg?.destination?.address ?? null
    amountNano      = tx.in_msg?.value  ?? tx.amount_nano  ?? null
  }

  // Format 2: Direktes Format (z.B. eigener Poller)
  if (!txHash && payload.tx_hash) {
    txHash          = payload.tx_hash
    senderAddress   = payload.sender       ?? null
    recipientAddress= payload.recipient    ?? null
    amountNano      = payload.amount_nano  ?? null
  }

  // Format 3: TON Center Format
  if (!txHash && payload.hash) {
    txHash          = payload.hash
    senderAddress   = payload.in_msg?.source   ?? null
    recipientAddress= payload.in_msg?.destination ?? null
    amountNano      = payload.in_msg?.value    ?? null
  }

  if (!txHash) {
    console.log('[TON Webhook] Kein TX Hash gefunden:', JSON.stringify(payload).slice(0, 200))
    return NextResponse.json({ handled: false, reason: 'No tx_hash' })
  }

  const supabase = db()

  // ── Transaktion in DB aktualisieren ──────────────────────
  const { data: existingTx } = await supabase
    .from('ton_transactions')
    .select('id, status')
    .eq('tx_hash', txHash)
    .maybeSingle()

  if (!existingTx) {
    // TX nicht in unserer DB → ignorieren (fremde Transaktion)
    return NextResponse.json({ handled: false, reason: 'Unknown tx' })
  }

  if (existingTx.status === 'confirmed') {
    // Bereits bestätigt → idempotent
    return NextResponse.json({ handled: true, reason: 'Already confirmed' })
  }

  // Transaktion als bestätigt markieren
  await supabase.from('ton_transactions').update({
    status:            'confirmed',
    confirmed_at:      new Date().toISOString(),
    sender_address:    senderAddress,
    recipient_address: recipientAddress,
    amount_nano:       amountNano,
    raw_data:          payload,
  }).eq('tx_hash', txHash)

  // ── Ecosystem Boost aktivieren ────────────────────────────
  const { data: support } = await supabase
    .from('ecosystem_support')
    .update({ is_active: true })
    .eq('tx_id', existingTx.id)
    .select('user_id, xp_boost_percent, tier')
    .maybeSingle()

  if (support) {
    // System-Event loggen
    await supabase.from('system_events').insert({
      event_type: 'ecosystem_boost_activated',
      payload: {
        user_id:          support.user_id,
        tier:             support.tier,
        xp_boost_percent: support.xp_boost_percent,
        tx_hash:          txHash,
      },
      success: true,
    }).catch(() => {}) // Non-critical

    console.log(`[TON Webhook] Boost aktiviert: ${support.tier} für User ${support.user_id}`)
  }

  return NextResponse.json({ handled: true, tx_hash: txHash })
}

// GET für Webhook-Verification (TONapi.io prüft ob URL erreichbar)
export async function GET(req: NextRequest) {
  const url    = new URL(req.url)
  const secret = url.searchParams.get('secret')
  if (secret === process.env.TON_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: true, service: 'VEXALGO TON Webhook' })
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
