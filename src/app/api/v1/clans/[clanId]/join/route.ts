// src/app/api/v1/clans/[clanId]/join/route.ts
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { createClient }      from '@supabase/supabase-js'
import { checkAchievements } from '@/app/api/v1/_lib/achievements'
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
  if (!clanId) return err('Clan ID missing', 'MISSING_ID')

  const supabase = db()

  const { data: clan } = await supabase
    .from('clans')
    .select('id, name, member_count, is_active, min_level_to_join, join_policy')
    .eq('id', clanId)
    .single()

  if (!clan || !clan.is_active) return err('Clan not found', 'NOT_FOUND', 404)
  if (clan.member_count >= GAME_CONSTANTS.CLAN_MAX_MEMBERS) {
    return err('Clan is full (max. 20 members)', 'CLAN_FULL')
  }

  const { data: user } = await supabase
    .from('users').select('level').eq('id', ctx.userId).single()
  if (!user || user.level < clan.min_level_to_join) {
    return err(`Minimum Level ${clan.min_level_to_join} required`, 'LEVEL_REQUIRED')
  }

  const { data: existing } = await supabase
    .from('clan_members').select('clan_id').eq('user_id', ctx.userId).maybeSingle()
  if (existing) return err('You are already in a clan', 'ALREADY_IN_CLAN')

  // ── OPEN: sofort beitreten ────────────────────────────────────────────────
  if (clan.join_policy === 'open') {
    const { error } = await supabase.from('clan_members').insert({
      clan_id: clanId, user_id: ctx.userId, role: 'member',
    })
    if (error) return err(`Failed to join clan: ${error.message}`, 'DB_ERROR', 500)

    // Auto-Cancel: eine evtl. offene Anfrage (an irgendeinen Clan) wird mit dem
    // Beitritt gegenstandslos -> entfernen, damit der "eine Anfrage"-Slot frei ist.
    await supabase.from('clan_join_requests')
      .delete().eq('user_id', ctx.userId).eq('status', 'pending')

    const newAchievements = await checkAchievements(supabase, ctx.userId)
    return ok({ joined: true, clanId, newAchievements })
  }

  // ── REQUEST: Anfrage anlegen (Leader/Officer entscheiden) ──────────────────
  // Bestehende offene Anfrage prüfen (für freundliche Meldung; die DB erzwingt
  // die "eine pro User"-Regel ohnehin per Partial-Unique).
  const { data: pending } = await supabase
    .from('clan_join_requests')
    .select('id, clan_id, clans(name)')
    .eq('user_id', ctx.userId)
    .eq('status', 'pending')
    .maybeSingle()

  if (pending) {
    if (pending.clan_id === clanId) {
      return ok({ requested: true, alreadyPending: true })
    }
    const otherName = (pending as any).clans?.name ?? 'another clan'
    return err(`You already have a pending request to ${otherName}. Withdraw it first.`,
      'REQUEST_EXISTS', 409)
  }

  const { error: reqErr } = await supabase
    .from('clan_join_requests')
    .insert({ clan_id: clanId, user_id: ctx.userId, status: 'pending' })

  if (reqErr) {
    // Race auf den Partial-Unique -> als "schon angefragt" behandeln.
    if ((reqErr as any).code === '23505') {
      return err('You already have a pending request. Withdraw it first.', 'REQUEST_EXISTS', 409)
    }
    return err(`Failed to create request: ${reqErr.message}`, 'DB_ERROR', 500)
  }

  return ok({ requested: true })
})
