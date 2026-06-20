// src/features/hooks.ts
// Zentrale Export-Datei für alle Feature-Hooks
'use client'

// ── Leaderboard ────────────────────────────────────────────
export { useLeaderboard } from '@/features/leaderboard/hooks'

// ── Energy ─────────────────────────────────────────────────
import { useEffect, useRef } from 'react'
import { useEnergyStore }    from '@/stores/useEnergyStore'
import { useUIStore }        from '@/stores/useUIStore'
import { GAME_CONSTANTS }    from '@/lib/constants/game'
import { formatDuration }    from '@/lib/utils'

export function useEnergyTicker() {
  const { tick, current, isHydrated } = useEnergyStore()
  const { addNotification }           = useUIStore()
  const wasFullRef                    = useRef(false)

  useEffect(() => {
    if (!isHydrated) return
    tick()
    const interval = setInterval(tick, 10_000)
    return () => clearInterval(interval)
  }, [isHydrated]) // eslint-disable-line

  useEffect(() => {
    if (current >= GAME_CONSTANTS.MAX_ENERGY && !wasFullRef.current) {
      wasFullRef.current = true
      addNotification({
        type:    'energy_full',
        title:   'Energie voll ⚡',
        message: 'Your energy is fully recharged!',
      })
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
    regenMultiplier: state.regenMultiplier,
    isBoosted:     state.regenMultiplier > 1,
    isHydrated:    state.isHydrated,
    isFull:        state.current >= GAME_CONSTANTS.MAX_ENERGY,
    isLow:         state.current <= 20,
    isEmpty:       state.current === 0,
    timeToFull:    formatDuration(state.secondsToFull),
    canAfford:     (cost: number) => state.current >= cost,
    pct:           Math.round((state.current / GAME_CONSTANTS.MAX_ENERGY) * 100),
  }
}

// ── Streak ─────────────────────────────────────────────────
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore }   from '@/stores/useAuthStore'
import { useUserStore }   from '@/stores/useUserStore'
import { todayUTC }       from '@/lib/utils'

export function useStreak() {
  const token               = useAuthStore(s => s.accessToken)
  const profile             = useUserStore(s => s.profile)
  const { patchProfile }    = useUserStore()
  const { showXPGain, toast, haptic } = useUIStore()
  const enqueueAchievements = useUIStore(s => s.enqueueAchievements)
  const qc                  = useQueryClient()

  const today      = todayUTC()
  const claimedToday = profile?.streakLastActiveDate === today
  const canClaim   = !claimedToday && !!profile

  const { mutate: claimStreak, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/streaks/claim', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data as {
        streakCurrent: number
        streakLongest: number
        xpGranted:     number
        missUsed:      boolean
      }
    },
    onSuccess: (data) => {
      patchProfile({
        streakCurrent:       data.streakCurrent,
        streakLongest:       data.streakLongest,
        streakLastActiveDate:today,
      })
      showXPGain(data.xpGranted)
      haptic('success')
      if (data.newAchievements?.length) enqueueAchievements(data.newAchievements)
      if (data.missUsed) toast('info', '🛡️ Miss day protection used — streak saved!')
      toast('success', `🔥 Day ${data.streakCurrent} Streak!`)
      // Profil ist keine Live-Query → echte Server-Werte nachziehen
      // (Streak-XP + evtl. Meilenstein-XP fließen so sofort in Total/Season XP).
      useUserStore.getState().refreshProfile()
    },
    onError: (e: Error) => {
      toast('error', e.message)
      haptic('error')
    },
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
