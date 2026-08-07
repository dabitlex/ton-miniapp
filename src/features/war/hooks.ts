// src/features/war/hooks.ts
// Clan-Wars-Datenhaken: Live-Status (mit sanftem Auto-Refresh), Result-Ack 
// und Kriegs-Historie. Nutzt authedFetch (automatischer Token-Refresh).
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { authedFetch }  from '@/lib/authedFetch'
import type { WarData, WarHistoryEntry } from '@/lib/constants/war'

async function getJson<T>(url: string): Promise<T | null> {
  const res  = await authedFetch(url)
  const json = await res.json().catch(() => null)
  return json?.success ? (json.data as T) : null
}

export function useClanWar() {
  const token = useAuthStore(s => s.accessToken)
  const qc    = useQueryClient()

  const { data, isLoading, refetch } = useQuery<WarData | null>({
    queryKey:  ['clan-war'],
    enabled:   !!token,
    staleTime: 20_000,
    // Während eines Live-Kriegs alle 45 s still nachziehen (Frontlinie bewegt
    // sich sichtbar) — sonst kein Polling.
    refetchInterval: (query) =>
      (query.state.data as WarData | null)?.state === 'live' ? 45_000 : false,
    refetchIntervalInBackground: false,
    queryFn: () => getJson<WarData>('/api/v1/clans/war'),
  })

  const { mutate: acknowledgeWar, isPending: acking } = useMutation({
    mutationFn: async (warId: string) => {
      await authedFetch('/api/v1/clans/war', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ warId }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clan-war'] })
      qc.invalidateQueries({ queryKey: ['clan-war-history'] })
    },
  })

  return { war: data ?? null, isLoading, refetchWar: refetch, acknowledgeWar, acking }
}

export function useWarHistory(enabled = true) {
  const token = useAuthStore(s => s.accessToken)

  const { data, isLoading } = useQuery<{ wars: WarHistoryEntry[] } | null>({
    queryKey:  ['clan-war-history'],
    enabled:   !!token && enabled,
    staleTime: 60_000,
    queryFn:   () => getJson<{ wars: WarHistoryEntry[] }>('/api/v1/clans/war/history'),
  })

  return { history: data?.wars ?? [], isLoading }
}
