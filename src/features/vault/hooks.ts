// src/features/vault/hooks.ts
// Weekly-Vault-Datenhaken. Liefert alle vier Zustaende (off/idle/open/result)
// und die Bestaetigung des Gewinn-Screens.
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { authedFetch }  from '@/lib/authedFetch'
import type { VaultData } from '@/lib/constants/vault'

export function useVault() {
  const token = useAuthStore(s => s.accessToken)
  const qc    = useQueryClient()

  const { data, isLoading, refetch } = useQuery<VaultData | null>({
    queryKey:  ['vault'],
    enabled:   !!token,
    staleTime: 60_000,
    // Waehrend einer laufenden Runde alle 2 Minuten nachziehen
    // (der Jackpot waechst mit jedem Los der Community).
    refetchInterval: (query) =>
      (query.state.data as VaultData | null)?.state === 'open' ? 120_000 : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const res  = await authedFetch('/api/v1/vault')
      const json = await res.json().catch(() => null)
      return json?.success ? (json.data as VaultData) : null
    },
  })

  const { mutate: acknowledgeWin, isPending: acking } = useMutation({
    mutationFn: async (roundId: string) => {
      await authedFetch('/api/v1/vault', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ roundId }),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault'] }),
  })

  return { vault: data ?? null, isLoading, refetchVault: refetch, acknowledgeWin, acking }
}
