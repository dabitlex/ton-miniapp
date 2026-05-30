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

  // Nur Einträge zurücksetzen wenn Liga sich ändert (userRank bleibt)
  useEffect(() => {
    store.reset()       // löscht nur entries, NICHT userRank
    store.setLeague(league)
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

      const entries     = json.data?.entries    ?? []
      const userRank    = json.data?.userRank    ?? null
      const userEntry   = json.data?.userEntry   ?? null
      const refreshedAt = json.data?.refreshedAt ?? new Date().toISOString()
      const total       = json.meta?.total       ?? 0
      const hasMore     = json.meta?.hasMore      ?? false

      store.setEntries(entries, { total, hasMore, refreshedAt })

      // userRank nur setzen wenn wir einen echten Wert haben
      // (API gibt immer den globalen Rang zurück, unabhängig vom Filter)
      if (userRank !== null || store.userRank === null) {
        store.setUserRank(userRank, userEntry)
      }

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
