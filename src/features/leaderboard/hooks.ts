// src/features/leaderboard/hooks.ts
'use client'
import { useEffect, useCallback, useRef } from 'react'
import { useQuery }               from '@tanstack/react-query'
import { useAuthStore }           from '@/stores/useAuthStore'
import { useLeaderboardStore }    from '@/stores/useLeaderboardStore'
import type { LeagueTier }        from '@/types/game'

export function useLeaderboard(league: LeagueTier | null = null) {
  const token       = useAuthStore(s => s.accessToken)
  const store       = useLeaderboardStore()
  const prevLeague  = useRef<LeagueTier | null | undefined>(undefined)

  // Reset NUR wenn Liga sich wirklich ändert (nicht beim ersten Render)
  useEffect(() => {
    if (prevLeague.current === undefined) {
      prevLeague.current = league
      return
    }
    if (prevLeague.current !== league) {
      prevLeague.current = league
      store.reset()
      store.setLeague(league)
    }
  }, [league]) // eslint-disable-line

  const { isLoading, refetch } = useQuery({
    queryKey:  ['leaderboard', 'season', league],
    enabled:   !!token,
    staleTime: 5 * 60_000,
    queryFn:   async () => {
      store.setLoading(true)
      const params = new URLSearchParams({ page: '1', limit: '50' })
      if (league) params.set('league', league)

      const res  = await fetch(`/api/v1/leaderboard/season?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const text = await res.text()
      if (!text) throw new Error('Leere Antwort')

      const json = JSON.parse(text)
      if (!json.success) throw new Error(json.error)

      const entries     = json.data?.entries      ?? []
      const userRank    = json.data?.userRank      ?? null
      const userEntry   = json.data?.userEntry     ?? null
      const refreshedAt = json.data?.refreshedAt   ?? new Date().toISOString()
      const total       = json.meta?.total         ?? 0
      const hasMore     = json.meta?.hasMore        ?? false

      store.setEntries(entries, { total, hasMore, refreshedAt })

      // userRank immer setzen — auch wenn Nutzer nicht in dieser Liga ist
      store.setUserRank(userRank, userEntry)

      return json.data
    },
  })

  const loadMore = useCallback(() => {
    if (store.hasMore && !isLoading) {
      // Weitere Seiten laden
      const nextPage = store.page + 1
      store.setPage(nextPage)

      fetch(`/api/v1/leaderboard/season?page=${nextPage}&limit=50${league ? `&league=${league}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(json => {
          if (json.success) {
            store.appendEntries(json.data?.entries ?? [])
            store.setUserRank(json.data?.userRank ?? store.userRank, json.data?.userEntry ?? store.userEntry)
          }
        })
        .catch(() => {})
    }
  }, [store.hasMore, isLoading, store.page, league, token]) // eslint-disable-line

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
