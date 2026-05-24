// src/app/api/v1/users/wallet/route.ts
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient }    from '@/lib/supabase/admin'
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

  // Update referral eligibility check (wallet is one of the requirements)
  await db.rpc('validate_referral' as any, { p_user_id: ctx.userId }).catch(() => {})

  return ok({ address, connected: true })
})

export const DELETE = withAuth(async (ctx) => {
  const db = getAdminClient()
  await db.from('wallets')
    .update({ status: 'disconnected', disconnected_at: new Date().toISOString() })
    .eq('user_id', ctx.userId)

  return ok({ disconnected: true })
})
