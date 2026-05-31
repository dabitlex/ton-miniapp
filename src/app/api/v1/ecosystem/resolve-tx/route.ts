// src/app/api/v1/ecosystem/resolve-tx/route.ts
// Findet TX anhand von Betrag + Sender-Wallet (verhindert Kollisionen)
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// UQ/EQ Adress-Normalisierung für Vergleiche
function normalizeAddress(addr: string): string {
  if (!addr) return ''
  // Entferne UQ/EQ Prefix und normalisiere
  return addr.toLowerCase().replace(/^(uq|eq)/, '')
}

export const POST = withAuth(async (ctx) => {
  let body: { tonAmount?: number; tierKey?: string; senderAddress?: string }
  try { body = await ctx.req.json() }
  catch { return err('Invalid body', 'BAD_REQUEST') }

  const { tonAmount, senderAddress } = body
  if (!tonAmount) return err('tonAmount fehlt', 'MISSING_AMOUNT')

  const treasuryWallet = process.env.NEXT_PUBLIC_TON_TREASURY_WALLET
  const tonApiKey      = process.env.TON_API_KEY

  if (!treasuryWallet) return err('Treasury nicht konfiguriert', 'CONFIG_ERROR')

  // Wallet-Adresse des Nutzers aus DB holen (falls nicht im Request)
  let userWallet = senderAddress
  if (!userWallet) {
    const db = getAdminClient()
    const { data: wallet } = await db
      .from('wallets')
      .select('address')
      .eq('user_id', ctx.userId)
      .eq('status', 'connected')
      .maybeSingle()
    userWallet = wallet?.address ?? null
  }

  const headers: Record<string, string> = { 'Accept': 'application/json' }
  if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`

  const expectedNano  = BigInt(Math.round(tonAmount * 1e9))
  const now           = Math.floor(Date.now() / 1000)
  const windowSec     = 300  // 5 Minuten
  const tolerance     = BigInt(50_000_000) // 0.05 TON

  const maxAttempts = 4
  const retryDelay  = 4000

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[ResolveTX] Suche TX (Versuch ${attempt}/${maxAttempts}) sender=${userWallet ?? 'unknown'}`)

      const url = `https://tonapi.io/v2/blockchain/accounts/${encodeURIComponent(treasuryWallet)}/transactions?limit=30&sort_order=desc`
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })

      if (!res.ok) {
        console.warn(`[ResolveTX] TONapi ${res.status}`)
        if (attempt < maxAttempts) { await sleep(retryDelay); continue }
        break
      }

      const data         = await res.json()
      const transactions = data.transactions ?? []

      for (const tx of transactions) {
        const txTime = tx.utime ?? tx.now ?? 0
        if (now - txTime > windowSec) continue

        const inMsg = tx.in_msg
        if (!inMsg) continue

        // Betrag prüfen
        const txValue = BigInt(inMsg.value ?? '0')
        const diff    = txValue > expectedNano
          ? txValue - expectedNano
          : expectedNano - txValue
        if (diff > tolerance) continue

        // Sender-Wallet prüfen (verhindert Kollisionen bei gleichem Betrag)
        if (userWallet) {
          const txSender    = inMsg.source?.address ?? ''
          const normSender  = normalizeAddress(txSender)
          const normExpected = normalizeAddress(userWallet)

          if (normSender && normExpected && !normSender.includes(normExpected.slice(-20)) &&
              !normExpected.includes(normSender.slice(-20))) {
            console.log(`[ResolveTX] Sender-Mismatch: ${txSender} ≠ ${userWallet}`)
            continue // Nicht diese TX
          }
        }

        // TX bereits in DB? (verhindert Doppel-Zuweisung)
        const db = getAdminClient()
        const { data: existing } = await db
          .from('ton_transactions')
          .select('id, user_id')
          .eq('tx_hash', tx.hash)
          .maybeSingle()

        if (existing && existing.user_id !== ctx.userId) {
          console.log(`[ResolveTX] TX ${tx.hash} bereits Nutzer ${existing.user_id} zugewiesen`)
          continue
        }

        console.log(`[ResolveTX] ✅ TX gefunden: ${tx.hash}`)
        return ok({ txHash: tx.hash, source: 'tonapi_poll' })
      }

      console.log(`[ResolveTX] Versuch ${attempt}: TX noch nicht sichtbar`)
      if (attempt < maxAttempts) await sleep(retryDelay)

    } catch (e: any) {
      console.warn(`[ResolveTX] Fehler ${attempt}: ${e.message}`)
      if (attempt < maxAttempts) await sleep(retryDelay)
    }
  }

  // Webhook wird Boost aktivieren
  return err(
    'Zahlung gesendet! Boost aktiviert sich automatisch in ~30 Sekunden.',
    'TX_PENDING_WEBHOOK',
    202
  )
})
