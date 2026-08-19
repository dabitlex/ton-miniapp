// src/features/arcade/hooks.ts
// Zustand und Ablauf für XP Rush.
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUserStore } from '@/stores/useUserStore'
import { authedFetch }  from '@/lib/authedFetch'

export interface ArcadeStatus {
  enabled:    boolean
  runsLeft:   number
  /** -1 = unbegrenzt (jede weitere Runde gegen eine Werbung) */
  adRunsLeft: number
  bestScore:  number
  bestToday:  number
  xpToday:    number
  xpCap:      number
  /** true = Tagesdeckel erreicht, Runden zaehlen weiter ohne XP */
  xpCapped:   boolean
  board:      ArcadeBoard
}

export interface ArcadeBoardEntry {
  rank: number; name: string; score: number; isMe: boolean
}

export interface ArcadeBoard {
  /** Top 5 der laufenden Woche, ein Eintrag je Spieler */
  entries:   ArcadeBoardEntry[]
  myRank:    number | null
  myScore:   number | null
  /** Punkte bis zum naechsthoeheren Platz */
  gapPoints: number | null
  gapRank:   number | null
  players:   number
}

export function useArcade() {
  const token = useAuthStore(s => s.accessToken)
  const qc    = useQueryClient()

  const { data: status, isLoading } = useQuery<ArcadeStatus | null>({
    queryKey:  ['arcade'],
    enabled:   !!token,
    staleTime: 30_000,
    queryFn: async () => {
      const res  = await authedFetch('/api/v1/arcade')
      const json = await res.json().catch(() => null)
      return json?.success ? (json.data as ArcadeStatus) : null
    },
  })

  /** Eröffnet einen Lauf und liefert die Lauf-ID zurück. */
  const { mutateAsync: startRun, isPending: starting } = useMutation({
    mutationFn: async (withAd: boolean) => {
      const res  = await authedFetch('/api/v1/arcade', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'start', withAd }),
      })
      const json = await res.json().catch(() => null)
      if (!json?.success) throw new Error(json?.error ?? 'Start fehlgeschlagen')
      return json.data as { runId: string; runsLeft: number; adRunsLeft: number }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arcade'] }),
  })

  /** Schließt einen Lauf ab. Abgelehnte Läufe werfen NICHT — der Nutzer
   *  bekommt sein Ergebnis zu sehen, nur ohne XP. */
  const { mutateAsync: finishRun, isPending: finishing } = useMutation({
    mutationFn: async (v: { runId: string; score: number; bestCombo: number }) => {
      const res  = await authedFetch('/api/v1/arcade', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'finish', ...v }),
      })
      const json = await res.json().catch(() => null)
      if (!json?.success) return { accepted: false, xp: 0, capped: false, reason: null as string | null }
      return json.data as { accepted: boolean; xp: number; capped: boolean; reason: string | null }
    },
    onSuccess: (data) => {
      // Zustand UND Wochenliste kommen aus demselben Endpunkt
      qc.invalidateQueries({ queryKey: ['arcade'] })
      if (data.xp > 0) {
        // Profil nachziehen, damit XP und Level sofort stimmen
        useUserStore.getState().refreshProfile()
        qc.invalidateQueries({ queryKey: ['xp-trend'] })
      }
    },
  })

  return {
    status: status ?? null,
    isLoading,
    startRun, starting,
    finishRun, finishing,
  }
}
