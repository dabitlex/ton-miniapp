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

      const res = await fetch(`/api/v1/leaderboard/season?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      // Leere Antwort abfangen
      const text = await res.text()
      if (!text) throw new Error('Leere Server-Antwort')

      let json: any
      try { json = JSON.parse(text) }
      catch { throw new Error(`Ungültige Antwort: ${text.slice(0, 100)}`) }

      if (!json.success) throw new Error(json.error ?? 'Leaderboard-Fehler')

      const entries     = json.data?.entries      ?? []
      const userRank    = json.data?.userRank     ?? null
      const userEntry   = json.data?.userEntry    ?? null
      const refreshedAt = json.data?.refreshedAt  ?? new Date().toISOString()
      const total       = json.meta?.total        ?? 0
      const hasMore     = json.meta?.hasMore      ?? false

      if (store.page === 1) {
        store.setEntries(entries, { total, hasMore, refreshedAt })
      } else {
        store.appendEntries(entries)
      }

      store.setUserRank(userRank, userEntry)
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
