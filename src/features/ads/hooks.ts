// src/features/ads/hooks.ts
'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState }       from 'react'
import { useAuthStore }   from '@/stores/useAuthStore'
import { useUserStore }   from '@/stores/useUserStore'
import { useUIStore }     from '@/stores/useUIStore'
import { showAd, getBlockId } from '@/lib/adsgram'

interface AdStatus {
  watchedToday:   number
  dailyLimit:     number
  remainingToday: number
  weeklyCount:    number
  weeklyTarget:   number
  xpPerAd:        number
}

async function apiFetch<T>(url: string, token: string): Promise<T> {
  const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Request failed')
  return json.data as T
}

export function useAds() {
  const token = useAuthStore(s => s.accessToken)
  const qc    = useQueryClient()
  const { toast, haptic } = useUIStore()
  const [watching, setWatching] = useState(false)

  const { data, refetch } = useQuery({
    queryKey:  ['ads', 'status'],
    enabled:   !!token,
    staleTime: 30_000,
    queryFn:   () => apiFetch<AdStatus>('/api/v1/ads/status', token!),
  })

  const remainingToday = data?.remainingToday ?? 5

  async function watchAd() {
    if (watching) return
    if (!getBlockId()) { toast('error', 'Werbung ist noch nicht verfügbar.'); return }
    if (remainingToday <= 0) { toast('warning', '⚠️ Tageslimit erreicht — morgen wieder!'); return }

    setWatching(true)
    haptic('light')
    const result = await showAd()
    setWatching(false)

    if (result === 'no_ad') { toast('warning', 'Gerade keine Werbung verfügbar. Bitte später erneut versuchen.'); return }
    if (result === 'error') { toast('error', 'Werbung konnte nicht abgespielt werden.'); return }

    // Reward kommt server-seitig (Adsgram-Callback). Kurz warten, dann Werte nachziehen.
    haptic('medium')
    toast('success', '✓ Belohnung wird gutgeschrieben …', 2000)
    setTimeout(() => {
      refetch()
      qc.invalidateQueries({ queryKey: ['quests', 'weekly'] })
      useUserStore.getState().refreshProfile()
    }, 1500)
  }

  return {
    watchedToday:   data?.watchedToday ?? 0,
    dailyLimit:     data?.dailyLimit ?? 5,
    remainingToday,
    weeklyCount:    data?.weeklyCount ?? 0,
    weeklyTarget:   data?.weeklyTarget ?? 20,
    xpPerAd:        data?.xpPerAd ?? 50,
    watching,
    watchAd,
    refetchAds:     refetch,
  }
}
