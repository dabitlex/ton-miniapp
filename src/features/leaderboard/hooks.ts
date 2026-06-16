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

      // ── Modell A: ist der User außerhalb der Top 7? ──
      // Dann Fokus-Modus: Podium bleibt fest oben, die Liste startet mit der
      // 5er-Umgebung (2 vor, ich, 2 nach) und lädt in beide Richtungen nach.
      const FOCUS_FROM = 8
      if (userRank && userRank >= FOCUS_FROM) {
        store.setFocusMode(true)
        if (!store.neighborsLoaded) {
          const fromRank = Math.max(4, userRank - 2)   // Podium (1-3) nie doppeln
          const np = new URLSearchParams({ from: String(fromRank), limit: '5' })
          if (league) np.set('league', league)
          try {
            const nres  = await fetch(`/api/v1/leaderboard/season?${np}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            const ntext = await nres.text()
            if (ntext) {
              const njson = JSON.parse(ntext)
              if (njson.success) store.setNeighbors(njson.data?.entries ?? [])
            }
          } catch { /* Umgebung ist optional; Hauptliste bleibt nutzbar */ }
        }
      } else {
        store.setFocusMode(false)
      }

      return json.data
    },
  })

  // loadMore: lädt nach unten nach. Im Fokus-Modus wird die EIGENE UMGEBUNG
  // nach unten erweitert (200, 201, 202 …); im Normalmodus die Hauptliste.
  const isLoadingMore = useRef(false)
  const loadMore = useCallback(async () => {
    if (isLoading || isLoadingMore.current) return

    // ── Fokus-Modus: Umgebung nach unten erweitern ──
    if (store.focusMode) {
      const last = store.neighbors[store.neighbors.length - 1]
      if (!last) return
      const fromRank = last.rank + 1
      if (store.total && fromRank > store.total) return   // Ende erreicht
      isLoadingMore.current = true
      try {
        const np = new URLSearchParams({ from: String(fromRank), limit: '15' })
        if (league) np.set('league', league)
        const res  = await fetch(`/api/v1/leaderboard/season?${np}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const text = await res.text()
        if (!text) return
        const json = JSON.parse(text)
        if (json.success) {
          const more = json.data?.entries ?? []
          if (more.length > 0) store.appendNeighbors(more)
        }
      } catch { /* nicht kritisch */ } finally { isLoadingMore.current = false }
      return
    }

    // ── Normalmodus: Hauptliste paginieren ──
    if (!store.hasMore) return
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
        store.appendEntries(more)
        store.setHasMore(hasMore)
      } else {
        store.setHasMore(false)
      }
    } catch {
      // still: Nachladen ist nicht kritisch; nächster Scroll versucht es erneut
    } finally {
      isLoadingMore.current = false
    }
  }, [store.hasMore, store.page, store.focusMode, store.neighbors, store.total, isLoading, league, token]) // eslint-disable-line

  // fetchRange: lädt ein beliebiges Rang-Fenster (für bidirektionales Laden in
  // der Page orchestriert). Reine Hilfsfunktion ohne Store-Mutation.
  const fetchRange = useCallback(async (fromRank: number, limit: number): Promise<any[]> => {
    try {
      const p = new URLSearchParams({ from: String(fromRank), limit: String(limit) })
      if (league) p.set('league', league)
      const res  = await fetch(`/api/v1/leaderboard/season?${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const text = await res.text()
      if (!text) return []
      const json = JSON.parse(text)
      return json.success ? (json.data?.entries ?? []) : []
    } catch { return [] }
  }, [league, token])

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
    // Modell A
    focusMode:    store.focusMode,
    neighbors:    store.neighbors,
    total:        store.total,
    fetchRange,
    appendNeighbors:  store.appendNeighbors,
    prependNeighbors: store.prependNeighbors,
  }
}
