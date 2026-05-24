// src/app/api/v1/leaderboard/season/route.ts
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient } from '@/lib/supabase/admin'
import type { LeaderboardEntry } from '@/types/game'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withAuth(async (ctx) => {
  const url    = new URL(ctx.req.url)
  const page   = Math.max(1, Number(url.searchParams.get('page')  ?? '1'))
  const limit  = Math.min(100, Number(url.searchParams.get('limit') ?? '50'))
  const league = url.searchParams.get('league') ?? null
  const offset = (page - 1) * limit

  const db = getAdminClient()

  // Get active season
  const { data: season } = await db
    .from('seasons')
    .select('id')
    .eq('status', 'active')
    .maybeSingle()

  if (!season) return err('No active season', 'NO_SEASON', 404)

  // Query leaderboard cache (refreshed every 5 min by Edge Function)
  let query = db
    .from('leaderboard_cache')
    .select('*', { count: 'exact' })
    .eq('season_id', season.id)
    .eq('entity_type', 'user')
    .order('rank', { ascending: true })
    .range(offset, offset + limit - 1)

  if (league) {
    query = query.contains('metadata', { league })
  } else {
    query = query.eq('cache_type', 'season_global')
  }

  const { data, count, error } = await query
  if (error) return err('Leaderboard fetch failed', 'DB_ERROR', 500)

  const entries: LeaderboardEntry[] = (data ?? []).map(row => ({
    rank:          row.rank,
    userId:        row.entity_id,
    firstName:     row.display_name,
    username:      (row.metadata as any)?.username ?? null,
    photoUrl:      row.avatar_url,
    level:         row.level ?? 1,
    league:        (row.metadata as any)?.league ?? 'bronze',
    seasonXp:      row.score,
    clanName:      (row.metadata as any)?.clan_name ?? undefined,
    streakCurrent: (row.metadata as any)?.streak    ?? undefined,
    isCurrentUser: row.entity_id === ctx.userId,
  }))

  // Get current user's rank if not in this page
  let userRank: number | null = null
  let userEntry: LeaderboardEntry | null = null
  const userInPage = entries.find(e => e.isCurrentUser)

  if (!userInPage) {
    const { data: userCache } = await db
      .from('leaderboard_cache')
      .select('rank, score, level, display_name, avatar_url, metadata')
      .eq('cache_type', 'season_global')
      .eq('season_id', season.id)
      .eq('entity_id', ctx.userId)
      .maybeSingle()

    if (userCache) {
      userRank = userCache.rank
      userEntry = {
        rank:          userCache.rank,
        userId:        ctx.userId,
        firstName:     userCache.display_name,
        username:      (userCache.metadata as any)?.username ?? null,
        photoUrl:      userCache.avatar_url,
        level:         userCache.level ?? 1,
        league:        (userCache.metadata as any)?.league ?? 'bronze',
        seasonXp:      userCache.score,
        isCurrentUser: true,
      }
    }
  }

  const refreshedAt = (data?.[0] as any)?.refreshed_at ?? new Date().toISOString()

  return ok(
    { entries, userRank, userEntry, refreshedAt },
    { page, limit, total: count ?? 0, hasMore: offset + limit < (count ?? 0) }
  )
})
