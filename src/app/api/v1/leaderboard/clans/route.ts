// src/app/api/v1/leaderboard/clans/route.ts
// Globale Clan-Rangliste (all-time, nach clans.season_xp). Liest den von
// refresh_clan_leaderboard_cache befüllten leaderboard_cache.
//   GET -> { clans: [...], myClanId, myRank, totalClans }
// Speist die "Clans"-Ansicht im Ranks-Tab UND das "Global #N"-Chip in der
// Clan-Overview (gemeinsamer Query im Frontend).

import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { createClient }      from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export const GET = withAuth(async (ctx) => {
  const supabase = db()

  const { data: rows, error } = await supabase
    .from('leaderboard_cache')
    .select('rank, entity_id, display_name, avatar_url, score, level, metadata')
    .eq('cache_type', 'clan_global')
    .order('rank', { ascending: true })
    .limit(100)

  if (error) return err(`Cache error: ${error.message}`, 'DB_ERROR', 500)

  const clans = (rows ?? []).map((r: any) => ({
    rank:        r.rank,
    clanId:      r.entity_id,
    name:        r.display_name,
    avatarUrl:   r.avatar_url ?? null,
    score:       Number(r.score ?? 0),
    level:       r.level ?? 1,
    memberCount: (r.metadata as any)?.member_count ?? null,
    wins:        (r.metadata as any)?.wins ?? 0,
  }))

  // Eigenen Clan auflösen, um ihn im Frontend hervorzuheben + den Rang fürs Chip.
  const { data: member } = await supabase
    .from('clan_members').select('clan_id')
    .eq('user_id', ctx.userId).maybeSingle()

  const myClanId = member?.clan_id ?? null
  const myRank   = myClanId ? (clans.find(c => c.clanId === myClanId)?.rank ?? null) : null

  return ok({ clans, myClanId, myRank, totalClans: clans.length })
})
