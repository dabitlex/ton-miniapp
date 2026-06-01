// src/app/api/v1/leaderboard/season/route.ts
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
  const url    = new URL(ctx.req.url)
  const page   = Math.max(1, Number(url.searchParams.get('page')  ?? '1'))
  const limit  = Math.min(100, Number(url.searchParams.get('limit') ?? '50'))
  const league = url.searchParams.get('league') ?? null
  const offset = (page - 1) * limit

  const supabase = db()

  // Cache-Typ bestimmen
  const cacheType = 'season_global'

  // Aktive Saison
  const { data: season } = await supabase
    .from('seasons').select('id').eq('status', 'active').maybeSingle()

  if (!season) return err('Keine aktive Saison', 'NO_SEASON', 404)

  // Einträge laden — liga-Filter über metadata
  let query = supabase
    .from('leaderboard_cache')
    .select('rank, entity_id, display_name, avatar_url, score, level, metadata, refreshed_at')
    .eq('cache_type', cacheType)
    .eq('season_id', season.id)
    .order('rank', { ascending: true })
    .range(offset, offset + limit - 1)

  // Liga-Filter via metadata
  if (league) {
    query = query.eq('metadata->>league', league)
  }

  const { data: entries, error } = await query

  if (error) return err(`Cache-Fehler: ${error.message}`, 'DB_ERROR', 500)

  // Gesamtzahl für Pagination
  let countQuery = supabase
    .from('leaderboard_cache')
    .select('id', { count: 'exact', head: true })
    .eq('cache_type', cacheType)
    .eq('season_id', season.id)

  if (league) countQuery = countQuery.eq('metadata->>league', league)
  const { count } = await countQuery

  // Globalen Rang immer laden
  const { data: myGlobalEntry } = await supabase
    .from('leaderboard_cache')
    .select('rank, entity_id, display_name, avatar_url, score, level, metadata')
    .eq('cache_type', cacheType)
    .eq('season_id', season.id)
    .eq('entity_id', ctx.userId)
    .maybeSingle()

  // Liga-Rang laden wenn Liga-Filter aktiv
  let myLeagueEntry = null
  if (league) {
    const { data: leagueEntry } = await supabase
      .from('leaderboard_cache')
      .select('rank, entity_id, score')
      .eq('cache_type', cacheType)
      .eq('season_id', season.id)
      .eq('entity_id', ctx.userId)
      .eq('metadata->>league', league)
      .maybeSingle()
    myLeagueEntry = leagueEntry
  }

  const mappedEntries = (entries ?? []).map(e => ({
    rank:          e.rank,
    userId:        e.entity_id,
    firstName:     e.display_name,
    photoUrl:      e.avatar_url,
    seasonXp:      e.score,
    level:         e.level,
    league:        (e.metadata as any)?.league   ?? 'bronze',
    clanName:      (e.metadata as any)?.clan_name ?? null,
    username:      (e.metadata as any)?.username  ?? null,
    isCurrentUser: e.entity_id === ctx.userId,
    refreshedAt:   e.refreshed_at,
  }))

  const refreshedAt = entries?.[0]?.refreshed_at ?? new Date().toISOString()

  return ok(
    {
      entries:    mappedEntries,
      refreshedAt,
      // Globaler Rang (immer)
      userRank:      myGlobalEntry?.rank ?? null,
      // Liga-Rang (nur wenn Liga-Filter aktiv)
      userLeagueRank: myLeagueEntry?.rank ?? null,
      userEntry:  myGlobalEntry ? {
        rank:      myGlobalEntry.rank,
        userId:    myGlobalEntry.entity_id,
        firstName: myGlobalEntry.display_name,
        photoUrl:  myGlobalEntry.avatar_url,
        seasonXp:  myGlobalEntry.score,
        level:     myGlobalEntry.level,
        league:    (myGlobalEntry.metadata as any)?.league ?? 'bronze',
      } : null,
    },
    {
      page,
      limit,
      total:   count ?? 0,
      hasMore: offset + limit < (count ?? 0),
    }
  )
})
