// src/lib/prefetch.ts
'use client'
import { getQueryClient }       from '@/lib/queryClient'
import { useQuestStore }        from '@/stores/useQuestStore'
import { useLeaderboardStore }  from '@/stores/useLeaderboardStore'

let lastPrefetch = 0

async function getJSON(url: string, token: string): Promise<{ data: any; meta: any } | null> {
  try {
    const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const text = await res.text()
    if (!text) return null
    const json = JSON.parse(text)
    return json.success ? { data: json.data, meta: json.meta } : null
  } catch {
    return null
  }
}

/**
 * Lädt alle Tab-Daten parallel vor und legt sie in die persistenten Stores
 * (Quests, Leaderboard) sowie in den gemeinsamen React-Query-Cache (Clans,
 * Boost). So öffnen Home, Quests, Ranks, Clans, Boost & You ohne Ladezustand.
 * Wird während des Splashscreens aufgerufen; bricht nach max. 4s ab, damit der
 * Splash bei einem langsamen Endpoint nicht hängen bleibt.
 */
export async function prefetchAppData(token: string): Promise<void> {
  if (!token) return
  // Doppel-Aufruf vermeiden (Splash + Game-Layout teilen sich den AuthProvider)
  if (Date.now() - lastPrefetch < 20_000) return
  lastPrefetch = Date.now()

  const qc = getQueryClient()

  const tasks: Promise<void>[] = [
    // Daily Quests → Store + Cache (Home + Quests sofort da)
    (async () => {
      const r = await getJSON('/api/v1/quests/daily', token)
      if (r?.data) { useQuestStore.getState().setDaily(r.data); qc.setQueryData(['quests', 'daily'], r.data) }
    })(),
    // Weekly Quests
    (async () => {
      const r = await getJSON('/api/v1/quests/weekly', token)
      if (r?.data) { useQuestStore.getState().setWeekly(r.data); qc.setQueryData(['quests', 'weekly'], r.data) }
    })(),
    // Clans: eigene Mitgliedschaft
    (async () => {
      const r = await getJSON('/api/v1/clans/my', token)
      qc.setQueryData(['my-membership'], r?.data ?? null)
    })(),
    // Clans: Liste (Standard-Suche = '')
    (async () => {
      const r = await getJSON('/api/v1/clans?limit=20', token)
      qc.setQueryData(['clans', ''], r?.data ?? [])
    })(),
    // Boost / Ecosystem
    (async () => {
      const r = await getJSON('/api/v1/ecosystem', token)
      if (r?.data) qc.setQueryData(['ecosystem'], r.data)
    })(),
    // Ranks / Leaderboard (Season global, league = null) → Store + Cache
    (async () => {
      const r = await getJSON('/api/v1/leaderboard/season?page=1&limit=50', token)
      if (r?.data) {
        const s = useLeaderboardStore.getState()
        s.setEntries(r.data.entries ?? [], {
          total:       r.meta?.total   ?? 0,
          hasMore:     r.meta?.hasMore ?? false,
          refreshedAt: r.data.refreshedAt ?? new Date().toISOString(),
        })
        s.setUserRank(r.data.userRank ?? null, r.data.userEntry ?? null)
        s.setLeagueRank?.(r.data.userLeagueRank ?? null)
        qc.setQueryData(['leaderboard', 'season', null], r.data)

        // ── Modell A: Fokus-Entscheidung schon beim Prefetch treffen. ──
        // Sonst bliebe focusMode=false, weil der Leaderboard-Hook wegen
        // staleTime die queryFn (mit der Fokus-Logik) nicht erneut ausführt,
        // wenn der Cache bereits vorgeladen ist. Spiegelt exakt die Hook-Logik.
        const userRank = r.data.userRank ?? null
        const FOCUS_FROM = 8
        if (userRank && userRank >= FOCUS_FROM) {
          s.setFocusMode(true)
          const fromRank = Math.max(4, userRank - 2)   // Podium (1-3) nie doppeln
          const nr = await getJSON(
            `/api/v1/leaderboard/season?from=${fromRank}&limit=5`, token,
          )
          if (nr?.data) s.setNeighbors(nr.data.entries ?? [])
        } else {
          s.setFocusMode(false)
        }
      }
    })(),
  ]

  await Promise.race([
    Promise.allSettled(tasks),
    new Promise<void>(resolve => setTimeout(resolve, 4000)),
  ])
}
