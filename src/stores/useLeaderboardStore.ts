// src/stores/useLeaderboardStore.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { LeaderboardEntry, LeagueTier } from '@/types/game'

interface LeaderboardState {
  entries:      LeaderboardEntry[]
  userRank:     number | null
  userEntry:    LeaderboardEntry | null
  total:        number
  page:         number
  hasMore:      boolean
  isLoading:    boolean
  refreshedAt:  string | null
  activeLeague: LeagueTier | null

  setEntries:    (entries: LeaderboardEntry[], meta: { total: number; hasMore: boolean; refreshedAt: string }) => void
  appendEntries: (more: LeaderboardEntry[]) => void
  setUserRank:   (rank: number | null, entry: LeaderboardEntry | null) => void
  setLoading:    (v: boolean) => void
  setPage:       (p: number) => void
  setLeague:     (l: LeagueTier | null) => void
  // FIX: reset löscht NICHT mehr userRank/userEntry
  reset:         () => void
  // Neuer: vollständiger Reset inkl. userRank (nur beim Logout)
  fullReset:     () => void
}

export const useLeaderboardStore = create<LeaderboardState>()(
  devtools((set) => ({
    entries:      [],
    userRank:     null,
    userEntry:    null,
    total:        0,
    page:         1,
    hasMore:      false,
    isLoading:    false,
    refreshedAt:  null,
    activeLeague: null,

    setEntries: (entries, { total, hasMore, refreshedAt }) =>
      set({ entries, total, hasMore, refreshedAt, isLoading: false }),
    appendEntries: (more) =>
      set(s => ({ entries: [...s.entries, ...more], page: s.page + 1, isLoading: false })),
    setUserRank:   (userRank, userEntry) => set({ userRank, userEntry }),
    setLoading:    (isLoading)   => set({ isLoading }),
    setPage:       (page)        => set({ page }),
    setLeague:     (activeLeague)=> set({ activeLeague }),

    // Nur Einträge + Pagination resetten — userRank/userEntry BLEIBEN
    reset: () => set(s => ({
      entries:  [],
      page:     1,
      total:    0,
      hasMore:  false,
      // userRank und userEntry bleiben erhalten!
      userRank: s.userRank,
      userEntry:s.userEntry,
    })),

    // Vollständiger Reset (nur beim Logout)
    fullReset: () => set({
      entries:      [],
      userRank:     null,
      userEntry:    null,
      total:        0,
      page:         1,
      hasMore:      false,
      isLoading:    false,
      refreshedAt:  null,
      activeLeague: null,
    }),
  }), { name: 'leaderboard-store' })
)
