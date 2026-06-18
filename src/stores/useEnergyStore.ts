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
      regenMultiplier: 1,
      isHydrated:    false,

      hydrate(state) {
        set({ ...state, isHydrated: true })
      },

      tick() {
        const { current, lastUpdated, isHydrated, regenMultiplier } = get()
        if (!isHydrated || current >= GAME_CONSTANTS.MAX_ENERGY) return

        const lastUpdatedDate  = new Date(lastUpdated)
        const now              = new Date()
        const secondsElapsed   = Math.floor((now.getTime() - lastUpdatedDate.getTime()) / 1000)
        const ticks            = Math.floor(secondsElapsed / GAME_CONSTANTS.ENERGY_REGEN_INTERVAL_SEC)

        if (ticks <= 0) {
          // No new tick yet, just update countdown
          const remaining     = GAME_CONSTANTS.MAX_ENERGY - current
          const secondsToFull = Math.ceil(remaining / regenMultiplier) * GAME_CONSTANTS.ENERGY_REGEN_INTERVAL_SEC
          const nextTickIn = GAME_CONSTANTS.ENERGY_REGEN_INTERVAL_SEC - (secondsElapsed % GAME_CONSTANTS.ENERGY_REGEN_INTERVAL_SEC)
          const nextRegenAt = new Date(now.getTime() + nextTickIn * 1000).toISOString()
          set({ secondsToFull: Math.max(0, secondsToFull), nextRegenAt })
          return
        }

        const newEnergy     = Math.min(GAME_CONSTANTS.MAX_ENERGY, current + ticks * regenMultiplier)
        const lastTickAt    = new Date(lastUpdatedDate.getTime() + ticks * GAME_CONSTANTS.ENERGY_REGEN_INTERVAL_SEC * 1000)
        const nextRegenAt   = newEnergy < GAME_CONSTANTS.MAX_ENERGY
          ? new Date(lastTickAt.getTime() + GAME_CONSTANTS.ENERGY_REGEN_INTERVAL_SEC * 1000).toISOString()
          : null
        const remainingAfter = GAME_CONSTANTS.MAX_ENERGY - newEnergy
        const secondsToFull = newEnergy >= GAME_CONSTANTS.MAX_ENERGY
          ? 0
          : Math.ceil(remainingAfter / regenMultiplier) * GAME_CONSTANTS.ENERGY_REGEN_INTERVAL_SEC

        set({
          current:       newEnergy,
          lastUpdated:   lastTickAt.toISOString(),
          nextRegenAt,
          secondsToFull,
        })
      },

      optimisticConsume(amount) {
        // Gegen undefined/NaN absichern: ein ungültiger amount würde
        // current - amount = NaN ergeben und die Anzeige fälschlich auf 0
        // springen lassen (z.B. bei der energiefreien Ad-Quest, deren
        // energyCost je nach Datenpfad undefined sein kann).
        const safe = Number.isFinite(amount) ? amount : 0
        if (safe <= 0) return
        set(s => ({
          current:   Math.max(0, s.current - safe),
          usedToday: s.usedToday + safe,
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
