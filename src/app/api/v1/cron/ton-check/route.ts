// src/app/api/v1/cron/ton-check/route.ts
// Vercel Cron Job: Prüft TON Center auf neue Transaktionen
// Läuft alle 2 Minuten als Fallback falls TONapi Webhook ausfällt
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

export async function GET(req: NextRequest) {
  // Nur von Vercel Cron oder mit Secret aufrufbar
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET ?? ''

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const treasuryWallet = process.env.NEXT_PUBLIC_TON_TREASURY_WALLET
  const tonApiKey      = process.env.TON_API_KEY ?? ''

  if (!treasuryWallet) {
    return NextResponse.json({ error: 'Treasury wallet not configured' })
  }

  const supabase = db()

  // Alle pending Transaktionen der letzten 2 Stunden holen
  const { data: pendingTxs } = await supabase
    .from('ton_transactions')
    .select('id, tx_hash, amount_nano, created_at')
    .eq('status', 'pending')
    .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .limit(20)

  if (!pendingTxs || pendingTxs.length === 0) {
    return NextResponse.json({ checked: 0, confirmed: 0 })
  }

  let confirmed = 0

  for (const tx of pendingTxs) {
    try {
      // TONapi.io: Transaktion per Hash abrufen
      const apiUrl = `https://tonapi.io/v2/blockchain/transactions/${tx.tx_hash}`
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      }
      if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`

      const res = await fetch(apiUrl, { headers })

      if (res.ok) {
        const data = await res.json()

        // Transaktion gefunden und bestätigt
        if (data.hash || data.lt) {
          await supabase.from('ton_transactions').update({
            status:       'confirmed',
            confirmed_at: new Date().toISOString(),
            raw_data:     data,
          }).eq('id', tx.id)

          // Boost aktivieren
          await supabase.from('ecosystem_support')
            .update({ is_active: true })
            .eq('tx_id', tx.id)

          confirmed++
          console.log(`[TON Poller] TX bestätigt: ${tx.tx_hash}`)
        }
      } else if (res.status === 404) {
        // TX noch nicht on-chain — warte weiter
        // Nach 1 Stunde als failed markieren
        const ageMinutes = (Date.now() - new Date(tx.created_at).getTime()) / 60000
        if (ageMinutes > 60) {
          await supabase.from('ton_transactions').update({
            status: 'failed',
          }).eq('id', tx.id)
        }
      }
    } catch (e) {
      console.error(`[TON Poller] Fehler bei TX ${tx.tx_hash}:`, e)
    }
  }

  return NextResponse.json({
    checked:   pendingTxs.length,
    confirmed,
    timestamp: new Date().toISOString(),
  })
}
