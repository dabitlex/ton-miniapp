// src/app/api/v1/auth/refresh/route.ts
import { NextRequest } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { ok, err } from '@/app/api/v1/_lib/handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: { refreshToken?: string }
  try {
    body = await req.json()
  } catch {
    return err('Invalid body', 'BAD_REQUEST')
  }

  if (!body.refreshToken) {
    return err('refreshToken required', 'MISSING_TOKEN')
  }

  const db = getAdminClient()
  const { data, error } = await db.auth.refreshSession({
    refresh_token: body.refreshToken,
  })

  if (error || !data.session) {
    return err('Token refresh failed', 'REFRESH_FAILED', 401)
  }

  return ok({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
    userId: data.session.user.id,
  })
}
