// src/features/quests/hooks.ts
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { v4 as uuidv4 } from 'uuid'
import { useAuthStore }   from '@/stores/useAuthStore'
import { useQuestStore }  from '@/stores/useQuestStore'
import { useEnergyStore } from '@/stores/useEnergyStore'
import { useUserStore }   from '@/stores/useUserStore'
import { useUIStore }     from '@/stores/useUIStore'
import type { DailyQuest, WeeklyQuest } from '@/types/game'

async function apiFetch<T>(url: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options?.headers },
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Request failed')
  return json.data as T
}

export function useQuests() {
  const token      = useAuthStore(s => s.accessToken)
  const questStore = useQuestStore()
  const energy     = useEnergyStore()
  const { patchProfile } = useUserStore()
  const { showXPGain, toast, haptic } = useUIStore()
  const qc         = useQueryClient()

  // ── Fetch daily quests ─────────────────────────────────────────────
  const { isLoading: isLoadingDaily, refetch: refetchDaily } = useQuery({
    queryKey:  ['quests', 'daily'],
    enabled:   !!token,
    staleTime: 5 * 60_000,
    queryFn:   async () => {
      questStore.setLoadingDaily(true)
      const data = await apiFetch<DailyQuest[]>('/api/v1/quests/daily', token!)
      questStore.setDaily(data)
      return data
    },
  })

  // ── Fetch weekly quests ────────────────────────────────────────────
  const { isLoading: isLoadingWeekly } = useQuery({
    queryKey:  ['quests', 'weekly'],
    enabled:   !!token,
    staleTime: 15 * 60_000,
    queryFn:   async () => {
      questStore.setLoadingWeekly(true)
      const data = await apiFetch<WeeklyQuest[]>('/api/v1/quests/weekly', token!)
      questStore.setWeekly(data)
      return data
    },
  })

  // ── Complete quest mutation ────────────────────────────────────────
  const { mutate: completeQuest } = useMutation({
    mutationFn: async ({ questId, questType }: { questId: string; questType: 'daily' | 'weekly' }) => {
      const nonce = uuidv4()
      return apiFetch<{
        xpGranted: number; leveledUp: boolean; newLevel: number;
        newLeague: string; energyAfter: number; softCapped: boolean
      }>('/api/v1/quests/complete', token!, {
        method: 'POST',
        body: JSON.stringify({ questId, questType, nonce }),
      })
    },

    onMutate: ({ questId, questType }) => {
      // Save previous energy for rollback
      const prevEnergy = useEnergyStore.getState().current

      // Find quest to get energy cost
      const { daily, weekly } = useQuestStore.getState()
      const quest = [...daily, ...weekly].find(q => q.id === questId)
      if (quest) energy.optimisticConsume(quest.template.energyCost)

      // Optimistically mark as completed
      questStore.setCompleting(questId)
      questStore.optimisticComplete(questId)

      return { questId, prevEnergy }
    },

    onSuccess: (data, { questType }, context) => {
      // Update energy from authoritative server value
      energy.hydrate({
        current:       data.energyAfter,
        max:           100,
        usedToday:     useEnergyStore.getState().usedToday,
        lastUpdated:   new Date().toISOString(),
        nextRegenAt:   null,
        secondsToFull: (100 - data.energyAfter) * 900,
      })

      // Show XP gain animation
      showXPGain(data.xpGranted, data.leveledUp, data.leveledUp ? data.newLevel : undefined)

      // Update user profile optimistically
      if (data.leveledUp) {
        patchProfile({ level: data.newLevel, league: data.newLeague as any })
        haptic('heavy')
      }

      // Patch season XP in profile
      const profile = useUserStore.getState().profile
      if (profile) {
        patchProfile({
          seasonXp:       profile.seasonXp + data.xpGranted,
          xpEarnedToday:  profile.xpEarnedToday + data.xpGranted,
        })
      }

      if (data.softCapped) {
        toast('warning', 'Daily XP cap reached. Come back tomorrow!', 4000)
      }

      // Invalidate leaderboard after XP change
      qc.invalidateQueries({ queryKey: ['leaderboard'] })
    },

    onError: (error: Error, _, context) => {
      // Rollback optimistic updates
      if (context?.questId) questStore.rollbackComplete(context.questId)
      if (context?.prevEnergy !== undefined) energy.restore(context.prevEnergy)
      toast('error', error.message)
      haptic('error')
    },
  })

  return {
    daily:           questStore.daily,
    weekly:          questStore.weekly,
    isLoadingDaily:  isLoadingDaily || questStore.isLoadingDaily,
    isLoadingWeekly: isLoadingWeekly || questStore.isLoadingWeekly,
    completingId:    questStore.completingId,
    completeQuest:   (questId: string, questType: 'daily' | 'weekly') =>
      completeQuest({ questId, questType }),
    refetchDaily,
  }
}