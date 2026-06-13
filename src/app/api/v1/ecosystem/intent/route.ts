// src/app/api/v1/ecosystem/intent/route.ts
// Serverseitige Kauf-Sperre: wird am ANFANG eines Kaufs aufgerufen (vor sendTransaction).
// Holt atomar eine Sperre — solange sie gehalten wird, ist KEIN zweiter Kauf über die App
// möglich. Übersteht App-Neustarts (liegt in der DB). Läuft nach 15 Min automatisch aus.
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient }    from '@/lib/supabase/admin'
import { ECOSYSTEM_TIERS }   from '@/lib/constants/game'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOCK_MINUTES = 15

export const POST = withAuth(async (ctx) => {
  let body: { tier?: string }
  try { body = await ctx.req.json() }
  catch { return err('Invalid body', 'BAD_REQUEST') }

  const tier = ECOSYSTEM_TIERS.find(t => t.key === body.tier)
  if (!tier) return err('Invalid tier', 'INVALID_TIER')

  const db = getAdminClient()

  // Wallet + aktive Saison wie beim echten Kauf prüfen (Fail-Fast, identische Bedingungen)
  const { data: wallet } = await db
    .from('wallets').select('address')
    .eq('user_id', ctx.userId).eq('status', 'connected').maybeSingle()
  if (!wallet) return err('Connect a TON wallet first', 'NO_WALLET', 403)

  const { data: season } = await db
    .from('seasons').select('id').eq('status', 'active').maybeSingle()
  if (!season) return err('No active season', 'NO_SEASON', 404)

  // Atomar Sperre holen (nur wenn keine offene/abgelaufene existiert)
  const { data: acquired, error: lockErr } = await db.rpc('try_acquire_purchase_lock', {
    p_user_id: ctx.userId,
    p_tier:    tier.key,
    p_minutes: LOCK_MINUTES,
  })

  if (lockErr) return err(`Lock error: ${lockErr.message}`, 'LOCK_ERROR', 500)

  if (acquired !== true) {
    // Sperre wird bereits gehalten → es läuft schon ein Kauf
    return err(
      'Eine Zahlung wird bereits verarbeitet. Bitte nicht erneut bezahlen.',
      'PURCHASE_IN_PROGRESS',
      409
    )
  }

  return ok({ allowed: true, tier: tier.key })
})

// ── Kauf-Sperre freigeben ────────────────────────────────────────────────────
// Wird vom Client aufgerufen, wenn der Nutzer den Wallet-Dialog ABBRICHT
// (User rejects), BEVOR eine echte Zahlung registriert wurde. Verhindert, dass
// der Nutzer nach einem bewussten Abbruch 15 Min lang ausgesperrt bleibt.
//
// SICHERHEIT: release_purchase_lock löst den Lock NUR, wenn keine offene
// ton_transactions-Zeile (pending/confirming/confirmed) existiert. Bei einer
// echten, laufenden Zahlung bleibt der Lock bestehen (Doppelkauf-Schutz).
export const DELETE = withAuth(async (ctx) => {
  const db = getAdminClient()

  const { data: released, error: relErr } = await db.rpc('release_purchase_lock', {
    p_user_id: ctx.userId,
  })

  if (relErr) return err(`Release error: ${relErr.message}`, 'RELEASE_ERROR', 500)

  // released=false ist KEIN Fehler: Lock war entweder schon frei oder es läuft
  // eine echte Zahlung (dann darf er nicht gelöst werden).
  return ok({ released: released === true })
})
