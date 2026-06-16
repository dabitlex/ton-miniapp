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
    // Auto-Refresh alle 2 Minuten — ABER pausieren, sobald der User nachgeladen
    // hat (page > 1). Sonst würde der Seite-1-Refresh seine nachgeladenen
    // Einträge wegwerfen und ihn nach oben reißen. Sobald er wieder oben ist
    // (page === 1, z.B. nach Liga-Wechsel/reset), läuft der Refresh weiter.
    refetchInterval: () => (useLeaderboardStore.getState().page > 1 ? false : 2 * 60_000),
    refetchIntervalInBackground: false, // nur bei aktivem/fokussiertem Tab pollen (spart Last)
    queryFn:   async () => {
      // Skelett nur beim Erstladen zeigen; die 2-Minuten-Refreshes
      // aktualisieren lautlos in-place (kein Flackern).
      if (store.entries.length === 0) store.setLoading(true)
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

  // loadMore lädt die NÄCHSTE Seite tatsächlich nach und hängt sie an die
  // bestehende Liste an. Vorher wurde nur store.page erhöht, ohne dass ein
  // Fetch ausgelöst wurde (queryKey enthält page nicht, und der queryFn holt
  // fix page=1 für den 2-Min-Auto-Refresh). Daher hier ein eigener Fetch.
  const isLoadingMore = useRef(false)
  const loadMore = useCallback(async () => {
    if (!store.hasMore || isLoading || isLoadingMore.current) return
    isLoadingMore.current = true
    try {
      const nextPage = store.page + 1
      const params = new URLSearchParams({ page: String(nextPage), limit: '50' })
      if (league) params.set('league', league)

      const res  = await fetch(`/api/v1/leaderboard/season?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const text = await res.text()
      if (!text) return
      const json = JSON.parse(text)
      if (!json.success) return

      const more    = json.data?.entries ?? []
      const hasMore = json.meta?.hasMore ?? false
      if (more.length > 0) {
        store.appendEntries(more)          // hängt an + erhöht store.page
        store.setHasMore(hasMore)          // hasMore vom Server übernehmen
      } else {
        store.setHasMore(false)
      }
    } catch {
      // still: Nachladen ist nicht kritisch; nächster Scroll versucht es erneut
    } finally {
      isLoadingMore.current = false
    }
  }, [store.hasMore, store.page, isLoading, league, token]) // eslint-disable-line

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
