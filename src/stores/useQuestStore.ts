// src/stores/useQuestStore.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { DailyQuest, WeeklyQuest } from '@/types/game'

interface QuestState {
  daily:           DailyQuest[]
  weekly:          WeeklyQuest[]
  isLoadingDaily:  boolean
  isLoadingWeekly: boolean
  completingId:    string | null
  lastFetched:     number | null

  setDaily:            (q: DailyQuest[])  => void
  setWeekly:           (q: WeeklyQuest[]) => void
  setLoadingDaily:     (v: boolean)        => void
  setLoadingWeekly:    (v: boolean)        => void
  setCompleting:       (id: string | null) => void

  /** Optimistic: immediately mark as completed */
  optimisticComplete:  (id: string) => void
  /** Rollback if API call failed */
  rollbackComplete:    (id: string) => void
}

export const useQuestStore = create<QuestState>()(
  devtools((set, get) => ({
    daily:           [],
    weekly:          [],
    isLoadingDaily:  false,
    isLoadingWeekly: false,
    completingId:    null,
    lastFetched:     null,

    setDaily:  (daily)   => set({ daily,  lastFetched: Date.now(), isLoadingDaily:  false }),
    setWeekly: (weekly)  => set({ weekly, lastFetched: Date.now(), isLoadingWeekly: false }),

    setLoadingDaily:  (isLoadingDaily)  => set({ isLoadingDaily }),
    setLoadingWeekly: (isLoadingWeekly) => set({ isLoadingWeekly }),
    setCompleting:    (completingId)    => set({ completingId }),

    optimisticComplete(id) {
      const mark = <T extends { id: string; status: string }>(list: T[]): T[] =>
        list.map(q => q.id === id ? { ...q, status: 'completed' as const } : q)
      set(s => ({
        daily:        mark(s.daily)  as DailyQuest[],
        weekly:       mark(s.weekly) as WeeklyQuest[],
        completingId: null,
      }))
    },

    rollbackComplete(id) {
      const revert = <T extends { id: string; status: string }>(list: T[]): T[] =>
        list.map(q => q.id === id ? { ...q, status: 'available' as const } : q)
      set(s => ({
        daily:        revert(s.daily)  as DailyQuest[],
        weekly:       revert(s.weekly) as WeeklyQuest[],
        completingId: null,
      }))
    },
  }), { name: 'quest-store' })
)