// src/app/api/v1/ecosystem/resolve-tx/route.ts
// BOC → Echter TX Hash via TON Center
// WICHTIG: Gibt Fehler zurück wenn kein echter Hash ermittelt werden kann
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withAuth(async (ctx) => {
  let body: { boc?: string; tonAmount?: number; tierKey?: string }
  try { body = await ctx.req.json() }
  catch { return err('Invalid body', 'BAD_REQUEST') }

  const { boc, tonAmount } = body
  if (!boc)       return err('BOC fehlt', 'MISSING_BOC')
  if (!tonAmount) return err('tonAmount fehlt', 'MISSING_AMOUNT')

  // ── Methode 1: TON Center sendBocReturnHash ───────────────
  // Kostenlos, kein API Key nötig
  // Sendet BOC und gibt sofort echten TX Hash zurück
  try {
    const res = await fetch('https://toncenter.com/api/v2/sendBocReturnHash', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      body: JSON.stringify({ boc }),
      signal: AbortSignal.timeout(8000), // 8 Sek Timeout
    })

    if (res.ok) {
      const data = await res.json()
      // Antwort: { ok: true, result: { hash: "hex_hash" } }
      if (data.ok && data.result?.hash) {
        console.log(`[ResolveTX] Echter Hash (TON Center): ${data.result.hash}`)
        return ok({ txHash: data.result.hash, source: 'toncenter' })
      }
    }
    const errorText = await res.text().catch(() => '')
    console.warn(`[ResolveTX] TON Center Fehler: ${res.status} ${errorText.slice(0, 100)}`)

  } catch (e: any) {
    console.warn(`[ResolveTX] TON Center Timeout/Fehler: ${e.message}`)
  }

  // ── Methode 2: TONapi (kein Key für öffentlichen Endpoint) ──
  try {
    const res = await fetch('https://tonapi.io/v2/blockchain/message', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      body: JSON.stringify({ boc }),
      signal: AbortSignal.timeout(8000),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.hash) {
        console.log(`[ResolveTX] Echter Hash (TONapi): ${data.hash}`)
        return ok({ txHash: data.hash, source: 'tonapi' })
      }
    }
    console.warn(`[ResolveTX] TONapi Fehler: ${res.status}`)

  } catch (e: any) {
    console.warn(`[ResolveTX] TONapi Timeout/Fehler: ${e.message}`)
  }

  // ── KEIN Fallback ────────────────────────────────────────────
  // Wenn weder TON Center noch TONapi den Hash zurückgeben,
  // wird der Boost NICHT aktiviert.
  // Der Nutzer bekommt eine klare Fehlermeldung.
  console.error(`[ResolveTX] Kein echter TX Hash ermittelt für BOC`)

  return err(
    'Transaktion konnte nicht verifiziert werden. ' +
    'Bitte prüfe deine Wallet ob die Zahlung durchgegangen ist. ' +
    'Kontaktiere den Support mit deinem TX Hash.',
    'TX_UNVERIFIABLE',
    422
  )
})
