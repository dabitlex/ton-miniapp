// src/app/api/v1/clans/[clanId]/join/route.ts
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { createClient }      from '@supabase/supabase-js'
import { GAME_CONSTANTS }    from '@/lib/constants/game'

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

  const { data: clan } = await supabase
    .from('clans')
    .select('id, member_count, is_active, min_level_to_join, is_public')
    .eq('id', clanId)
    .single()

  if (!clan || !clan.is_active) return err('Clan nicht gefunden', 'NOT_FOUND', 404)
  if (!clan.is_public) return err('Dieser Clan ist privat', 'PRIVATE_CLAN')
  if (clan.member_count >= GAME_CONSTANTS.CLAN_MAX_MEMBERS) {
    return err('Clan ist voll (max. 20 Mitglieder)', 'CLAN_FULL')
  }

  const { data: user } = await supabase
    .from('users').select('level').eq('id', ctx.userId).single()
  if (!user || user.level < clan.min_level_to_join) {
    return err(`Mindest-Level ${clan.min_level_to_join} erforderlich`, 'LEVEL_REQUIRED')
  }

  const { data: existing } = await supabase
    .from('clan_members').select('clan_id').eq('user_id', ctx.userId).maybeSingle()
  if (existing) return err('Du bist bereits in einem Clan', 'ALREADY_IN_CLAN')

  const { error } = await supabase.from('clan_members').insert({
    clan_id: clanId,
    user_id: ctx.userId,
    role:    'member',
  })

  if (error) {
    if (error.message.includes('voll')) return err('Clan ist voll', 'CLAN_FULL')
    return err(`Beitritt fehlgeschlagen: ${error.message}`, 'DB_ERROR', 500)
  }

  return ok({ joined: true, clanId })
})
