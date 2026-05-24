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

  // Reset when league filter changes
  useEffect(() => {
    store.reset()
    store.setLeague(league)
  }, [league]) // eslint-disable-line

  const { isLoading, refetch } = useQuery({
    queryKey:  ['leaderboard', 'season', league, store.page],
    enabled:   !!token,
    staleTime: 5 * 60_000,
    queryFn:   async () => {
      store.setLoading(true)
      const params = new URLSearchParams({ page: String(store.page), limit: '50' })
      if (league) params.set('league', league)

      const res  = await fetch(`/api/v1/leaderboard/season?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      const { entries, userRank, userEntry, refreshedAt } = json.data
      const { total, hasMore } = json.meta ?? {}

      if (store.page === 1) {
        store.setEntries(entries, { total: total ?? 0, hasMore: hasMore ?? false, refreshedAt })
      } else {
        store.appendEntries(entries)
      }
      store.setUserRank(userRank ?? null, userEntry ?? null)
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

// src/features/energy/hooks.ts
// Runs the 15-min optimistic tick and exposes current energy state
import { useEffect, useRef }    from 'react'
import { useEnergyStore }       from '@/stores/useEnergyStore'
import { useUIStore }           from '@/stores/useUIStore'
import { GAME_CONSTANTS }       from '@/lib/constants/game'
import { formatDuration }       from '@/lib/utils'

export function useEnergyTicker() {
  const { tick, current, isHydrated } = useEnergyStore()
  const { addNotification } = useUIStore()
  const wasFullRef = useRef(false)

  useEffect(() => {
    if (!isHydrated) return
    tick() // immediate tick on mount
    const interval = setInterval(tick, 10_000) // every 10s for accurate countdown
    return () => clearInterval(interval)
  }, [isHydrated]) // eslint-disable-line

  // Notify when energy reaches full
  useEffect(() => {
    if (current >= GAME_CONSTANTS.MAX_ENERGY && !wasFullRef.current) {
      wasFullRef.current = true
      addNotification({ type: 'energy_full', title: 'Energy Full ⚡', message: 'Your energy is fully restored!' })
    } else if (current < GAME_CONSTANTS.MAX_ENERGY) {
      wasFullRef.current = false
    }
  }, [current]) // eslint-disable-line
}

export function useEnergy() {
  const state = useEnergyStore()
  return {
    current:       state.current,
    max:           state.max,
    usedToday:     state.usedToday,
    nextRegenAt:   state.nextRegenAt,
    secondsToFull: state.secondsToFull,
    isHydrated:    state.isHydrated,
    isFull:        state.current >= GAME_CONSTANTS.MAX_ENERGY,
    isLow:         state.current <= 20,
    isEmpty:       state.current === 0,
    timeToFull:    formatDuration(state.secondsToFull),
    canAfford:     (cost: number) => state.current >= cost,
    pct:           Math.round((state.current / GAME_CONSTANTS.MAX_ENERGY) * 100),
  }
}

// src/features/streaks/hooks.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore }   from '@/stores/useAuthStore'
import { useUserStore }   from '@/stores/useUserStore'
import { useUIStore }     from '@/stores/useUIStore'
import { todayUTC }       from '@/lib/utils'

export function useStreak() {
  const token        = useAuthStore(s => s.accessToken)
  const profile      = useUserStore(s => s.profile)
  const { patchProfile } = useUserStore()
  const { showXPGain, toast, haptic } = useUIStore()
  const qc           = useQueryClient()

  const today        = todayUTC()
  const lastClaim    = profile?.streakLastActiveDate
  const claimedToday = lastClaim === today

  const canClaim     = !claimedToday && !!profile

  const { mutate: claimStreak, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/streaks/claim', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data as { streakCurrent: number; streakLongest: number; xpGranted: number; missUsed: boolean }
    },
    onSuccess: (data) => {
      patchProfile({
        streakCurrent: data.streakCurrent,
        streakLongest: data.streakLongest,
        streakLastActiveDate: today,
      })
      showXPGain(data.xpGranted)
      haptic('success')
      if (data.missUsed) toast('info', '🛡️ Miss protection used — streak saved!')
      toast('success', `🔥 Day ${data.streakCurrent} streak!`)
      qc.invalidateQueries({ queryKey: ['user', 'profile'] })
    },
    onError: (e: Error) => { toast('error', e.message); haptic('error') },
  })

  return {
    streakCurrent: profile?.streakCurrent ?? 0,
    streakLongest: profile?.streakLongest ?? 0,
    claimedToday,
    canClaim,
    isClaiming:    isPending,
    claimStreak,
  }
}