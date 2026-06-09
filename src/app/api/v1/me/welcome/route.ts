// src/app/api/v1/me/welcome/route.ts
// Reiht die Willkommensnachricht in die notification_queue ein — EINMALIG pro Nutzer.
// Wird vom Frontend aufgerufen, NACHDEM der Nutzer requestWriteAccess() erlaubt hat.
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient }    from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withAuth(async (ctx) => {
  const db = getAdminClient()

  // Idempotenz: nur einmal pro Nutzer
  const { data: u, error: readErr } = await db
    .from('users')
    .select('welcome_sent_at')
    .eq('id', ctx.userId)
    .single()

  if (readErr) return err(`DB error: ${readErr.message}`, 'DB_ERROR', 500)
  if ((u as any)?.welcome_sent_at) return ok({ already: true })

  // Willkommensnachricht einreihen (bypass_optout = true: erste Kontaktaufnahme)
  const { error: enqErr } = await db.rpc('enqueue_notification', {
    p_user_id: ctx.userId,
    p_kind:    'welcome',
    p_payload: {},
    p_bypass:  true,
  })
  if (enqErr) return err(`Enqueue failed: ${enqErr.message}`, 'DB_ERROR', 500)

  // Sofort als "gesendet markiert" vermerken, damit es nie doppelt eingereiht wird
  await db.from('users')
    .update({ welcome_sent_at: new Date().toISOString() })
    .eq('id', ctx.userId)

  return ok({ queued: true })
})
