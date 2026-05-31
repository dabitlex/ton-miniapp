// src/app/api/v1/ecosystem/resolve-tx/route.ts
// BOC → Echter TX Hash — normalisiert auf Hex für DB-Konsistenz
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Base64/Base64url → Hex konvertieren
function base64ToHex(b64: string): string {
  try {
    // Base64url → Base64
    const normalized = b64.replace(/-/g, '+').replace(/_/g, '/')
    const padded     = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=')
    const binary     = atob(padded)
    return Array.from(binary)
      .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return b64
  }
}

// Prüfen ob Hash bereits Hex ist
function isHex(str: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(str)
}

// Hash normalisieren → immer lowercase Hex
function normalizeHash(hash: string): string {
  if (isHex(hash)) return hash.toLowerCase()
  return base64ToHex(hash).toLowerCase()
}

export const POST = withAuth(async (ctx) => {
  let body: { boc?: string; tonAmount?: number; tierKey?: string }
  try { body = await ctx.req.json() }
  catch { return err('Invalid body', 'BAD_REQUEST') }

  const { boc, tonAmount } = body
  if (!boc)       return err('BOC fehlt', 'MISSING_BOC')
  if (!tonAmount) return err('tonAmount fehlt', 'MISSING_AMOUNT')

  // ── Methode 1: TON Center sendBocReturnHash ───────────────
  try {
    const res = await fetch('https://toncenter.com/api/v2/sendBocReturnHash', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify({ boc }),
      signal:  AbortSignal.timeout(8000),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.ok && data.result?.hash) {
        // Normalisieren → Hex (TONapi Webhook sendet auch Hex)
        const txHash = normalizeHash(data.result.hash)
        console.log(`[ResolveTX] TON Center Hash (hex): ${txHash}`)
        return ok({ txHash, source: 'toncenter' })
      }
    }
    const errorText = await res.text().catch(() => '')
    console.warn(`[ResolveTX] TON Center Fehler: ${res.status} ${errorText.slice(0, 100)}`)

  } catch (e: any) {
    console.warn(`[ResolveTX] TON Center Timeout: ${e.message}`)
  }

  // ── Methode 2: TONapi ─────────────────────────────────────
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    }
    const apiKey = process.env.TON_API_KEY
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const res = await fetch('https://tonapi.io/v2/blockchain/message', {
      method: 'POST',
      headers,
      body:   JSON.stringify({ boc }),
      signal: AbortSignal.timeout(8000),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.hash) {
        const txHash = normalizeHash(data.hash)
        console.log(`[ResolveTX] TONapi Hash (hex): ${txHash}`)
        return ok({ txHash, source: 'tonapi' })
      }
    }
    console.warn(`[ResolveTX] TONapi Fehler: ${res.status}`)

  } catch (e: any) {
    console.warn(`[ResolveTX] TONapi Timeout: ${e.message}`)
  }

  // ── Kein Fallback ─────────────────────────────────────────
  console.error(`[ResolveTX] Kein TX Hash ermittelt`)
  return err(
    'Transaktion konnte nicht verifiziert werden. ' +
    'Bitte prüfe deine Wallet ob die Zahlung durchgegangen ist.',
    'TX_UNVERIFIABLE',
    422
  )
})
