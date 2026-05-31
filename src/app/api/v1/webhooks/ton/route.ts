// src/app/api/v1/webhooks/ton/route.ts
// Empfängt TX-Events von TONapi.io Webhook
import { NextRequest, NextResponse } from 'next/server'
import { createClient }   from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Hash normalisieren → lowercase Hex (gleiche Funktion wie in resolve-tx)
function normalizeHash(hash: string): string {
  if (/^[0-9a-fA-F]{64}$/.test(hash)) return hash.toLowerCase()
  try {
    const normalized = hash.replace(/-/g, '+').replace(/_/g, '/')
    const padded     = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=')
    const binary     = atob(padded)
    const hex = Array.from(binary)
      .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
    return hex.toLowerCase()
  } catch {
    return hash.toLowerCase()
  }
}

export async function POST(req: NextRequest) {
  // Secret prüfen
  const url    = new URL(req.url)
  const secret = url.searchParams.get('secret')
  if (!secret || secret !== process.env.TON_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: any
  try { payload = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // ── TONapi Webhook Format ─────────────────────────────────
  // Dokumentiertes Format: { account_id, lt, tx_hash }
  let txHash: string | null = null

  // Primär: tx_hash direkt (TONapi Standard-Format)
  if (payload.tx_hash) {
    txHash = normalizeHash(payload.tx_hash)
  }
  // Fallback: hash Feld
  else if (payload.hash) {
    txHash = normalizeHash(payload.hash)
  }
  // Fallback: verschachteltes Format
  else if (payload.account_id && payload.data?.tx_hash) {
    txHash = normalizeHash(payload.data.tx_hash)
  }

  if (!txHash) {
    console.log('[TON Webhook] Kein TX Hash:', JSON.stringify(payload).slice(0, 200))
    return NextResponse.json({ handled: false, reason: 'No tx_hash' })
  }

  console.log(`[TON Webhook] Empfangen TX: ${txHash}`)

  const supabase = db()

  // TX in DB suchen (beide Hashes sind jetzt Hex-normalisiert)
  const { data: existingTx } = await supabase
    .from('ton_transactions')
    .select('id, status')
    .eq('tx_hash', txHash)
    .maybeSingle()

  if (!existingTx) {
    console.log(`[TON Webhook] Unbekannte TX: ${txHash}`)
    return NextResponse.json({ handled: false, reason: 'Unknown tx' })
  }

  if (existingTx.status === 'confirmed') {
    return NextResponse.json({ handled: true, reason: 'Already confirmed' })
  }

  // TX als confirmed markieren → Trigger fn_activate_boost_on_tx_confirm feuert
  await supabase.from('ton_transactions').update({
    status:       'confirmed',
    confirmed_at: new Date().toISOString(),
    raw_data:     payload,
  }).eq('tx_hash', txHash)

  console.log(`[TON Webhook] TX bestätigt + Boost aktiviert: ${txHash}`)
  return NextResponse.json({ handled: true, tx_hash: txHash })
}

// GET für Webhook-Verification
export async function GET(req: NextRequest) {
  const url    = new URL(req.url)
  const secret = url.searchParams.get('secret')
  if (secret === process.env.TON_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: true, service: 'VEXALGO TON Webhook' })
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
