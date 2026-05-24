// src/stores/useUserStore.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { UserProfile } from '@/types/game'

interface UserState {
  profile:     UserProfile | null
  isLoading:   boolean
  lastFetched: number | null
  setProfile:  (p: UserProfile) => void
  patchProfile:(patch: Partial<UserProfile>) => void
  setLoading:  (v: boolean) => void
  clear:       () => void
}

export const useUserStore = create<UserState>()(
  devtools((set, get) => ({
    profile:     null,
    isLoading:   false,
    lastFetched: null,
    setProfile:  (profile)  => set({ profile, lastFetched: Date.now(), isLoading: false }),
    patchProfile:(patch)    => {
      const { profile } = get()
      if (profile) set({ profile: { ...profile, ...patch } })
    },
    setLoading:  (isLoading) => set({ isLoading }),
    clear:       ()          => set({ profile: null, lastFetched: null }),
  }), { name: 'user-store' })
)