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
  adRunsLeft: number
  bestScore:  number
  bestToday:  number
  xpToday:    number
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
      if (!json?.success) return { accepted: false, xp: 0, reason: null as string | null }
      return json.data as { accepted: boolean; xp: number; reason: string | null }
    },
    onSuccess: (data) => {
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
