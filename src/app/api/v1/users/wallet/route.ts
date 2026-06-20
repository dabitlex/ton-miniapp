// src/app/api/v1/users/wallet/route.ts 
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient }    from '@/lib/supabase/admin'
import { checkAchievements } from '@/app/api/v1/_lib/achievements'
import type { SaveWalletRequest } from '@/types/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withAuth(async (ctx) => {
  let body: SaveWalletRequest
  try { body = await ctx.req.json() }
  catch { return err('Invalid body', 'BAD_REQUEST') }

  const { address, addressFriendly, walletVersion, publicKey } = body
  if (!address) return err('address is required', 'MISSING_ADDRESS')

  // Basic TON address format validation
  if (address.length < 32 || address.length > 68) {
    return err('Invalid TON address format', 'INVALID_ADDRESS')
  }

  const db = getAdminClient()

  // Check if this address belongs to a different user (fraud prevention)
  const { data: existing } = await db
    .from('wallets')
    .select('user_id, status')
    .eq('address', address)
    .maybeSingle()

  if (existing && existing.user_id !== ctx.userId) {
    // Address already claimed by another user
    return err('Wallet address already in use', 'ADDRESS_TAKEN', 409)
  }

  // Upsert wallet record
  const { error } = await db.from('wallets').upsert(
    {
      user_id:          ctx.userId,
      address,
      address_friendly: addressFriendly ?? null,
      wallet_version:   walletVersion   ?? null,
      public_key:       publicKey        ?? null,
      status:           'connected',
      connected_at:     new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (error) return err(`Failed to save wallet: ${error.message}`, 'DB_ERROR', 500)

  // Update referral eligibility check (wallet is one of the requirements).
  // The users-table triggers only fire on level/xp change, not on wallet
  // connect, so we explicitly run the eligibility check here. Proper await +
  // error logging (db.rpc(...) is a thenable builder — .catch() on it throws).
  const { error: refErr } = await db.rpc('check_and_validate_referral', { p_user_id: ctx.userId })
  if (refErr) console.error(`[Wallet] referral validation failed (user ${ctx.userId}): ${refErr.message}`)

  const newAchievements = await checkAchievements(db, ctx.userId)

  return ok({ address, connected: true, newAchievements })
})

export const DELETE = withAuth(async (ctx) => {
  const db = getAdminClient()

  // Wallet-Eintrag vollständig LÖSCHEN (nicht nur auf 'disconnected' setzen).
  // Grund: wallets.address hat einen globalen UNIQUE-Constraint. Würde die Zeile
  // nur auf 'disconnected' gesetzt, bliebe die Adresse dauerhaft belegt und
  // könnte nie wieder verbunden werden — der POST-Handler oben würde mit
  // ADDRESS_TAKEN ablehnen. Löschen gibt die Adresse sofort wieder frei.
  // Unbedenklich: alle Lesestellen filtern auf status='connected', eine
  // 'disconnected'-Zeile wird nirgends genutzt. Referral-Status bleibt
  // unberührt (einmal validierte Referrals bleiben gültig).
  const { error } = await db.from('wallets')
    .delete()
    .eq('user_id', ctx.userId)

  if (error) return err(`Failed to disconnect wallet: ${error.message}`, 'DB_ERROR', 500)

  return ok({ disconnected: true })
})
