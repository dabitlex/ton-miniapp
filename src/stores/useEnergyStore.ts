// src/stores/useEnergyStore.ts
import { create } from 'zustand'
import { subscribeWithSelector, devtools } from 'zustand/middleware'
import type { EnergyState } from '@/types/game'
import { GAME_CONSTANTS } from '@/lib/constants/game'

interface EnergyStoreState extends EnergyState {
  isHydrated:        boolean
  hydrate:           (state: EnergyState) => void
  /** Optimistic local tick — does NOT write to server */
  tick:              () => void
  /** Optimistic deduction after quest success — rolls back on API error */
  optimisticConsume: (amount: number) => void
  /** Restore from rollback */
  restore:           (prev: number) => void
}

export const useEnergyStore = create<EnergyStoreState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      current:       100,
      max:           100,
      usedToday:     0,
      lastUpdated:   new Date().toISOString(),
      nextRegenAt:   null,
      secondsToFull: 0,
      isHydrated:    false,

      hydrate(state) {
        set({ ...state, isHydrated: true })
      },

      tick() {
        const { current, lastUpdated, isHydrated } = get()
        if (!isHydrated || current >= GAME_CONSTANTS.MAX_ENERGY) return

        const lastUpdatedDate  = new Date(lastUpdated)
        const now              = new Date()
        const secondsElapsed   = Math.floor((now.getTime() - lastUpdatedDate.getTime()) / 1000)
        const ticks            = Math.floor(secondsElapsed / GAME_CONSTANTS.ENERGY_REGEN_INTERVAL_SEC)

        if (ticks <= 0) {
          // No new tick yet, just update countdown
          const secondsToFull = (GAME_CONSTANTS.MAX_ENERGY - current) * GAME_CONSTANTS.ENERGY_REGEN_INTERVAL_SEC
          const nextTickIn = GAME_CONSTANTS.ENERGY_REGEN_INTERVAL_SEC - (secondsElapsed % GAME_CONSTANTS.ENERGY_REGEN_INTERVAL_SEC)
          const nextRegenAt = new Date(now.getTime() + nextTickIn * 1000).toISOString()
          set({ secondsToFull: Math.max(0, secondsToFull), nextRegenAt })
          return
        }

        const newEnergy     = Math.min(GAME_CONSTANTS.MAX_ENERGY, current + ticks)
        const lastTickAt    = new Date(lastUpdatedDate.getTime() + ticks * GAME_CONSTANTS.ENERGY_REGEN_INTERVAL_SEC * 1000)
        const nextRegenAt   = newEnergy < GAME_CONSTANTS.MAX_ENERGY
          ? new Date(lastTickAt.getTime() + GAME_CONSTANTS.ENERGY_REGEN_INTERVAL_SEC * 1000).toISOString()
          : null
        const secondsToFull = newEnergy >= GAME_CONSTANTS.MAX_ENERGY
          ? 0
          : (GAME_CONSTANTS.MAX_ENERGY - newEnergy) * GAME_CONSTANTS.ENERGY_REGEN_INTERVAL_SEC

        set({
          current:       newEnergy,
          lastUpdated:   lastTickAt.toISOString(),
          nextRegenAt,
          secondsToFull,
        })
      },

      optimisticConsume(amount) {
        set(s => ({
          current:   Math.max(0, s.current - amount),
          usedToday: s.usedToday + amount,
        }))
      },

      restore(prev) {
        set(s => ({
          current:   Math.min(GAME_CONSTANTS.MAX_ENERGY, prev),
          usedToday: Math.max(0, s.usedToday),
        }))
      },
    })),
    { name: 'energy-store' }
  )
)