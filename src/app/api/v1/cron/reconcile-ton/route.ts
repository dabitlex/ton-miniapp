// src/app/api/v1/cron/reconcile-ton/route.ts 
// Serverseitiges Auffangnetz für TON-Boost-Zahlungen.
// Gleicht die letzten Treasury-Eingänge (tonapi) mit `ton_transactions` ab und
// trägt fehlende Zahlungen nach: Absender-Wallet → Nutzer, Betrag → Tier, Boost aktivieren.
// UNABHÄNGIG von Frontend UND Webhook. Idempotent über UNIQUE(tx_hash).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ECOSYSTEM_TIERS } from '@/lib/constants/game'
import { notifyUser, boostConfirmedMessage } from '@/lib/telegram/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Adress-Normalisierung (wie in resolve-tx) für Sender-Vergleich
function normAddr(a: string): string {
  return (a || '').toLowerCase().replace(/^(uq|eq)/, '').replace(/[^a-z0-9_-]/g, '')
}

// Auth: Vercel-Cron schickt "Authorization: Bearer <CRON_SECRET>".
// Query-Secret akzeptiert CRON_SECRET ODER TON_WEBHOOK_SECRET (manueller Test / pg_cron).
function authorized(req: NextRequest): boolean {
  const cronSecret    = process.env.CRON_SECRET
  const webhookSecret = process.env.TON_WEBHOOK_SECRET

  const auth = req.headers.get('authorization')
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true

  const q = new URL(req.url).searchParams.get('secret')
  if (!q) return false
  if (cronSecret && q === cronSecret) return true
  if (webhookSecret && q === webhookSecret) return true
  return false
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const treasury  = process.env.NEXT_PUBLIC_TON_TREASURY_WALLET
  const tonApiKey = process.env.TON_API_KEY
  if (!treasury) return NextResponse.json({ error: 'Treasury not configured' }, { status: 500 })

  const supabase = db()

  // Aktive Saison (für boost_active_until)
  const { data: season } = await supabase
    .from('seasons').select('id, ends_at').eq('status', 'active').maybeSingle()
  if (!season) return NextResponse.json({ ok: true, note: 'no active season', recovered: 0 })

  // Verbundene Wallets → normalisierte Map (Adresse → user_id)
  const { data: wallets } = await supabase
    .from('wallets').select('user_id, address, address_friendly').eq('status', 'connected')
  const walletMap = new Map<string, string>()
  for (const w of (wallets ?? []) as any[]) {
    // Beide Formate indizieren (raw 0:hex UND friendly UQ/EQ…), damit der Match greift,
    // egal in welcher Form tonapi den Sender liefert.
    if (w.address)          walletMap.set(normAddr(w.address), w.user_id)
    if (w.address_friendly) walletMap.set(normAddr(w.address_friendly), w.user_id)
  }

  // Tiers absteigend (höchstes passendes zuerst)
  const tiers     = [...ECOSYSTEM_TIERS].sort((a, b) => b.tonAmount - a.tonAmount)
  const minTon    = Math.min(...ECOSYSTEM_TIERS.map(t => t.tonAmount))
  const tolerance = 0.02 // TON Toleranz für Gebühren/Rundung

  // Treasury-Transaktionen von tonapi
  const url = `https://tonapi.io/v2/blockchain/accounts/${encodeURIComponent(treasury)}/transactions?limit=50&sort_order=desc`
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`

  let txs: any[] = []
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(12000) })
    if (!res.ok) return NextResponse.json({ error: `tonapi ${res.status}` }, { status: 502 })
    const data = await res.json()
    txs = data.transactions ?? []
  } catch (e: any) {
    return NextResponse.json({ error: `tonapi fetch failed: ${e?.message}` }, { status: 502 })
  }

  const now       = Math.floor(Date.now() / 1000)
  const maxAgeSec = 24 * 60 * 60 // nur letzte 24h
  const minAgeSec = 120          // frische TX (<2min) erst dem Frontend überlassen
  const summary   = { scanned: 0, recovered: 0, already: 0, below_min: 0, unmatched: 0, no_tier: 0, too_fresh: 0 }

  for (const tx of txs) {
    const txTime = tx.utime ?? tx.now ?? 0
    if (now - txTime > maxAgeSec) continue
    if (now - txTime < minAgeSec) { summary.too_fresh++; continue }

    const inMsg = tx.in_msg
    if (!inMsg) continue                       // kein Eingang (ausgehende TX)
    const valueNano = BigInt(inMsg.value ?? '0')
    if (valueNano <= 0n) continue
    summary.scanned++

    const tonAmount = Number(valueNano) / 1e9
    if (tonAmount < minTon - tolerance) { summary.below_min++; continue }

    const tier = tiers.find(t => tonAmount >= t.tonAmount - tolerance)
    if (!tier) { summary.no_tier++; continue }

    const hash = String(tx.hash).toLowerCase()

    // Schon registriert? (case-insensitiv, fängt auch alte Groß-/Kleinschreibung)
    const { data: existing } = await supabase
      .from('ton_transactions').select('id').ilike('tx_hash', hash).maybeSingle()
    if (existing) { summary.already++; continue }

    // Absender → Nutzer (nur aktivieren, wenn eindeutig zuordenbar)
    const sender = inMsg.source?.address ?? ''
    const userId = walletMap.get(normAddr(sender))
    if (!userId) {
      summary.unmatched++
      console.warn(`[ReconcileTON] Unmatched: ${tonAmount} TON von ${sender} (tx ${hash}) — nicht aktiviert`)
      continue
    }

    // ton_transactions anlegen (confirmed)
    const { data: txRow, error: txErr } = await supabase
      .from('ton_transactions')
      .insert({
        tx_hash:           hash,
        sender_address:    sender,
        recipient_address: treasury,
        amount_nano:       Number(valueNano),
        status:            'confirmed',
        confirmed_at:      new Date().toISOString(),
        detected_via:      'reconcile',
      })
      .select('id')
      .single()

    if (txErr) {
      if ((txErr as any).code === '23505') { summary.already++; continue } // parallel angelegt
      console.error(`[ReconcileTON] tx insert failed (${hash}): ${txErr.message}`)
      continue
    }

    // ecosystem_support anlegen (sofort aktiv — on-chain bestätigt)
    const { error: supErr } = await supabase
      .from('ecosystem_support')
      .insert({
        user_id:            userId,
        season_id:          season.id,
        tx_id:              txRow.id,
        tier:               tier.key,
        ton_amount:         tonAmount,
        xp_boost_percent:   tier.boostPercent,
        boost_active_from:  new Date().toISOString(),
        boost_active_until: season.ends_at,
        is_active:          true,
      })

    if (supErr) {
      console.error(`[ReconcileTON] support insert failed (user ${userId}, tx ${hash}): ${supErr.message}`)
      continue
    }

    summary.recovered++
    console.log(`[ReconcileTON] ✅ Nachgetragen: ${tier.key} +${tier.boostPercent}% für User ${userId} (tx ${hash})`)

    // Kauf-Sperre dieses Nutzers lösen (Zahlung ist jetzt registriert + aktiv)
    await supabase.from('users')
      .update({ purchase_intent_at: null, purchase_intent_tier: null })
      .eq('id', userId)

    notifyUser(userId, boostConfirmedMessage(tier.label, tier.boostPercent, season.ends_at), { bypassOptOut: true })
      .catch(() => {})
  }

  console.log('[ReconcileTON] Lauf fertig:', summary)
  return NextResponse.json({ ok: true, ...summary })
}

export const GET  = handle
export const POST = handle
