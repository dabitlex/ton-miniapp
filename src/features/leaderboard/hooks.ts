// src/features/leaderboard/hooks.ts
'use client'
import { useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient }      from '@tanstack/react-query'
import { useAuthStore }                  from '@/stores/useAuthStore'
import { useLeaderboardStore }           from '@/stores/useLeaderboardStore'
import type { LeagueTier }               from '@/types/game'

export function useLeaderboard(league: LeagueTier | null = null) {
  const token = useAuthStore(s => s.accessToken)
  const store = useLeaderboardStore()
  const qc    = useQueryClient()

  // Nur zurücksetzen wenn die Liga TATSÄCHLICH wechselt — nicht bei jedem
  // Tab-Öffnen. Sonst würde der vorgeladene Store geleert und Ranks zeigt
  // wieder ein Lade-Skelett. Beim ersten Mount bleiben die vorgeladenen
  // Einträge stehen (kein Flackern).
  const prevLeague = useRef<LeagueTier | null | undefined>(undefined)
  useEffect(() => {
    if (prevLeague.current !== undefined && prevLeague.current !== league) {
      store.reset()
      qc.invalidateQueries({ queryKey: ['leaderboard', 'season', league] })
    }
    prevLeague.current = league
    store.setLeague(league)
  }, [league]) // eslint-disable-line

  const { isLoading, refetch } = useQuery({
    queryKey:  ['leaderboard', 'season', league],
    enabled:   !!token,
    staleTime: 60_000,    // Vorgeladene Daten beim Mount nutzen (kein Lade-Flackern)
    gcTime:    5 * 60_000,// Cache 5 min im Speicher behalten
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
      const userRank      = json.data?.userRank      ?? null
      const userLeagueRank = json.data?.userLeagueRank ?? null
      const userEntry      = json.data?.userEntry      ?? null
      const refreshedAt = json.data?.refreshedAt ?? new Date().toISOString()
      const total       = json.meta?.total       ?? 0
      const hasMore     = json.meta?.hasMore     ?? false

      store.setEntries(entries, { total, hasMore, refreshedAt })

      // Rang setzen
      if (userRank !== null || store.userRank === null) {
        store.setUserRank(userRank, userEntry)
      }
      store.setLeagueRank?.(userLeagueRank)

      return json.data
    },
  })

  const loadMore = useCallback(() => {
    if (store.hasMore && !isLoading) store.setPage(store.page + 1)
  }, [store.hasMore, isLoading, store.page]) // eslint-disable-line

  return {
    entries:     store.entries,
    userRank:      store.userRank,
    userLeagueRank: store.leagueRank ?? null,
    userEntry:   store.userEntry,
    isLoading,
    hasMore:     store.hasMore,
    refreshedAt: store.refreshedAt,
    loadMore,
    refetch,
  }
}
