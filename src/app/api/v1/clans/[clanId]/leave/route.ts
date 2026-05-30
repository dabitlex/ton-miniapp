// src/app/api/v1/clans/[clanId]/leave/route.ts
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { createClient }      from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export const POST = withAuth(async (ctx) => {
  const clanId = ctx.params?.clanId
  if (!clanId) return err('Clan-ID fehlt', 'MISSING_ID')

  const supabase = db()

  const { data: membership } = await supabase
    .from('clan_members').select('role')
    .eq('clan_id', clanId).eq('user_id', ctx.userId).single()

  if (!membership) return err('Du bist nicht in diesem Clan', 'NOT_MEMBER')

  if (membership.role === 'leader') {
    const { count } = await supabase
      .from('clan_members').select('id', { count: 'exact', head: true })
      .eq('clan_id', clanId).neq('user_id', ctx.userId)

    if ((count ?? 0) > 0) {
      return err('Übertrage die Leader-Rolle bevor du gehst', 'TRANSFER_FIRST')
    }
  }

  await supabase.from('clan_members').delete()
    .eq('clan_id', clanId).eq('user_id', ctx.userId)

  return ok({ left: true })
})
