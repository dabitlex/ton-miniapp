// src/features/leaderboard/hooks.ts
'use client'
import { useEffect, useCallback } from 'react'
import { useQuery }               from '@tanstack/react-query'
import { useAuthStore }           from '@/stores/useAuthStore'
import { useLeaderboardStore }    from '@/stores/useLeaderboardStore'
import type { LeagueTier }        from '@/types/game'

export function useLeaderboard(league: LeagueTier | null = null) {
  const token = useAuthStore(s => s.accessToken)
  const store = useLeaderboardStore()

  // Reset wenn Liga-Filter sich ändert
  useEffect(() => {
    store.reset()
    store.setLeague(league)
  }, [league]) // eslint-disable-line

  const { isLoading, refetch } = useQuery({
    queryKey:  ['leaderboard', 'season', league, store.page],
    enabled:   !!token,
    staleTime: 5 * 60_000,
    queryFn:   async () => {
      store.setLoading(true)
      const params = new URLSearchParams({
        page:  String(store.page),
        limit: '50',
      })
      if (league) params.set('league', league)

      const res  = await fetch(`/api/v1/leaderboard/season?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      const { entries, userRank, userEntry, refreshedAt } = json.data
      const { total, hasMore } = json.meta ?? {}

      if (store.page === 1) {
        store.setEntries(entries, {
          total:       total       ?? 0,
          hasMore:     hasMore     ?? false,
          refreshedAt: refreshedAt ?? new Date().toISOString(),
        })
      } else {
        store.appendEntries(entries)
      }

      store.setUserRank(userRank ?? null, userEntry ?? null)
      return json.data
    },
  })

  const loadMore = useCallback(() => {
    if (store.hasMore && !isLoading) store.setPage(store.page + 1)
  }, [store.hasMore, isLoading, store.page]) // eslint-disable-line

  return {
    entries:     store.entries,
    userRank:    store.userRank,
    userEntry:   store.userEntry,
    isLoading,
    hasMore:     store.hasMore,
    refreshedAt: store.refreshedAt,
    loadMore,
    refetch,
  }
}
