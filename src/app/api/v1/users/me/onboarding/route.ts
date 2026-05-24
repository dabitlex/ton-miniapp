// src/app/api/v1/users/me/onboarding/route.ts
import { withAuth, ok } from '../../../_lib/handler'
import { getAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withAuth(async (ctx) => {
  await getAdminClient()
    .from('users')
    .update({ onboarding_completed: true })
    .eq('id', ctx.userId)
  return ok({ completed: true })
})