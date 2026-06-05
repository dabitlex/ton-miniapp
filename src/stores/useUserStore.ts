// src/stores/useUserStore.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { UserProfile } from '@/types/game'
import { useAuthStore } from '@/stores/useAuthStore'

interface UserState {
  profile:        UserProfile | null
  isLoading:      boolean
  lastFetched:    number | null
  setProfile:     (p: UserProfile) => void
  patchProfile:   (patch: Partial<UserProfile>) => void
  setLoading:     (v: boolean) => void
  /** Re-sync the authoritative profile from the server (no app restart needed). */
  refreshProfile: () => Promise<void>
  clear:          () => void
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

    // Holt /users/me neu und ersetzt das Profil mit den echten Server-Werten.
    // Wichtig: setzt KEIN isLoading → die Zahlen aktualisieren sich lautlos,
    // nichts flackert. Wird nach XP-Aktionen aufgerufen (Quest, Box, Streak),
    // damit Total/Season XP, Level, Liga & Meilensteine immer stimmen.
    refreshProfile: async () => {
      const token = useAuthStore.getState().accessToken
      if (!token) return
      try {
        const res  = await fetch('/api/v1/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (json.success) set({ profile: json.data as UserProfile, lastFetched: Date.now() })
      } catch (e) {
        console.error('[User] refreshProfile failed:', e)
      }
    },

    clear:       ()          => set({ profile: null, lastFetched: null }),
  }), { name: 'user-store' })
)
