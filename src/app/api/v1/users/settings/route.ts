// src/app/api/v1/users/settings/route.ts
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient }    from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET — aktuelle Einstellungen
export const GET = withAuth(async (ctx) => {
  const db = getAdminClient()
  const { data } = await db
    .from('user_settings')
    .select('notifications_enabled, leaderboard_visible, profile_public, locale')
    .eq('user_id', ctx.userId)
    .maybeSingle()

  // Defaults falls noch kein Eintrag existiert
  return ok({
    notificationsEnabled: data?.notifications_enabled ?? true,
    leaderboardVisible:   data?.leaderboard_visible   ?? true,
    profilePublic:        data?.profile_public        ?? true,
    locale:               data?.locale                ?? 'en',
  })
})

// PATCH — Einstellung ändern
export const PATCH = withAuth(async (ctx) => {
  let body: { notificationsEnabled?: boolean; leaderboardVisible?: boolean; profilePublic?: boolean }
  try { body = await ctx.req.json() }
  catch { return err('Invalid body', 'BAD_REQUEST') }

  const db = getAdminClient()

  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (typeof body.notificationsEnabled === 'boolean') update.notifications_enabled = body.notificationsEnabled
  if (typeof body.leaderboardVisible   === 'boolean') update.leaderboard_visible   = body.leaderboardVisible
  if (typeof body.profilePublic        === 'boolean') update.profile_public        = body.profilePublic

  // Upsert — erstellt Eintrag falls nicht vorhanden
  const { error } = await db
    .from('user_settings')
    .upsert({ user_id: ctx.userId, ...update }, { onConflict: 'user_id' })

  if (error) return err(`Update failed: ${error.message}`, 'DB_ERROR', 500)

  return ok({ updated: true })
})
