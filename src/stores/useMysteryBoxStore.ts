// src/stores/useMysteryBoxStore.ts
import { create } from 'zustand'

interface MysteryBoxState {
  isOpen:   boolean
  /** Öffnet das Mystery-Box-Popup (z.B. nach letztem Daily-Quest-Claim) */
  trigger:  () => void
  /** Schließt das Popup */
  close:    () => void
}

export const useMysteryBoxStore = create<MysteryBoxState>((set) => ({
  isOpen:  false,
  trigger: () => set({ isOpen: true }),
  close:   () => set({ isOpen: false }),
}))
