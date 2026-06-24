// src/app/api/v1/clans/my-request/route.ts 
// Eigene offene Beitrittsanfrage des Users.
//   GET    -> { request: { clanId, clanName, createdAt } | null }
//   DELETE -> zieht die offene Anfrage zurück (gibt den "eine Anfrage"-Slot frei)

import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { createClient }      from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export const GET = withAuth(async (ctx) => {
  const supabase = db()

  const { data } = await supabase
    .from('clan_join_requests')
    .select('id, clan_id, created_at, clans(name)')
    .eq('user_id', ctx.userId)
    .eq('status', 'pending')
    .maybeSingle()

  if (!data) return ok({ request: null })

  return ok({
    request: {
      id:        data.id,
      clanId:    data.clan_id,
      clanName:  (data as any).clans?.name ?? 'Clan',
      createdAt: data.created_at,
    },
  })
})

export const DELETE = withAuth(async (ctx) => {
  const supabase = db()

  // Nur die EIGENE offene Anfrage löschen.
  const { data: deleted, error } = await supabase
    .from('clan_join_requests')
    .delete()
    .eq('user_id', ctx.userId)
    .eq('status', 'pending')
    .select('id')

  if (error) return err('Failed to withdraw request', 'DB_ERROR', 500)

  return ok({ withdrawn: (deleted?.length ?? 0) > 0 })
})
