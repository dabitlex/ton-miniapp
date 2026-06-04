// src/features/quests/hooks.ts
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { v4 as uuidv4 }  from 'uuid'
import { useAuthStore }   from '@/stores/useAuthStore'
import { useQuestStore }  from '@/stores/useQuestStore'
import { useEnergyStore } from '@/stores/useEnergyStore'
import { useMysteryBoxStore } from '@/stores/useMysteryBoxStore'
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

  // ── Daily Quests ──────────────────────────────────────────────
  const { isLoading: isLoadingDaily, refetch: refetchDaily } = useQuery({
    queryKey:  ['quests', 'daily'],
    enabled:   !!token,
    staleTime: 5 * 60_000,
    // Automatisch alle 60 Sekunden refreshen
    refetchInterval: 60_000,
    queryFn:   async () => {
      questStore.setLoadingDaily(true)
      const data = await apiFetch<DailyQuest[]>('/api/v1/quests/daily', token!)
      questStore.setDaily(data)
      return data
    },
  })

  // ── Weekly Quests ─────────────────────────────────────────────
  const { isLoading: isLoadingWeekly } = useQuery({
    queryKey:  ['quests', 'weekly'],
    enabled:   !!token,
    staleTime: 15 * 60_000,
    // Weekly alle 5 Minuten refreshen
    refetchInterval: 5 * 60_000,
    queryFn:   async () => {
      questStore.setLoadingWeekly(true)
      const data = await apiFetch<WeeklyQuest[]>('/api/v1/quests/weekly', token!)
      questStore.setWeekly(data)
      return data
    },
  })

  // ── Complete Quest ────────────────────────────────────────────
  const { mutate: completeQuest, isPending: isCompleting } = useMutation({
    mutationFn: async ({ questId, questType }: { questId: string; questType: 'daily' | 'weekly' }) => {
      const nonce = uuidv4()
      return apiFetch<{
        xpGranted: number; leveledUp: boolean; newLevel: number
        newLeague: string; energyAfter: number; softCapped: boolean
        mysteryBoxUnlocked?: boolean
      }>('/api/v1/quests/complete', token!, {
        method: 'POST',
        body:   JSON.stringify({ questId, questType, nonce }),
      })
    },

    onMutate: ({ questId }) => {
      const prevEnergy = useEnergyStore.getState().current
      const { daily, weekly } = useQuestStore.getState()
      const quest = [...daily, ...weekly].find(q => q.id === questId)
      if (quest) energy.optimisticConsume(quest.template.energyCost)
      questStore.setCompleting(questId)
      questStore.optimisticComplete(questId)
      return { questId, prevEnergy }
    },

    onSuccess: (data, { questType }, context) => {
      // Energie vom Server übernehmen
      energy.hydrate({
        current:       data.energyAfter,
        max:           100,
        usedToday:     useEnergyStore.getState().usedToday,
        lastUpdated:   new Date().toISOString(),
        nextRegenAt:   null,
        secondsToFull: (100 - data.energyAfter) * 900,
      })

      showXPGain(data.xpGranted, data.leveledUp, data.leveledUp ? data.newLevel : undefined)

      if (data.leveledUp) {
        patchProfile({ level: data.newLevel, league: data.newLeague as any })
        haptic('heavy')
      }

      const profile = useUserStore.getState().profile
      if (profile) {
        patchProfile({
          seasonXp:      profile.seasonXp + data.xpGranted,
          xpEarnedToday: profile.xpEarnedToday + data.xpGranted,
        })
      }

      if (data.softCapped) {
        toast('warning', '⚠️ Tages-XP-Limit erreicht. Komm morgen wieder!', 4000)
      }

      // Nach Abschluss: Quests neu laden damit Fortschritte sichtbar sind
      // (z.B. daily_hard_champion entsperrt sich wenn alle anderen done sind)
      qc.invalidateQueries({ queryKey: ['quests', questType] })
      qc.invalidateQueries({ queryKey: ['leaderboard'] })

      // Mystery Box: wenn mit dieser Quest alle Daily Quests fertig sind → Popup
      if (data.mysteryBoxUnlocked) {
        // kleine Verzögerung damit die XP-Animation zuerst läuft
        setTimeout(() => useMysteryBoxStore.getState().trigger(), 600)
      }
    },

    onError: (error: Error, _, context) => {
      if (context?.questId) questStore.rollbackComplete(context.questId)
      if (context?.prevEnergy !== undefined) energy.restore(context.prevEnergy)

      // Verifikationsfehler verständlich anzeigen
      if (error.message.includes('QUEST_CONDITION_NOT_MET') ||
          error.message.includes('nicht erfüllt') ||
          error.message.includes('noch nicht')) {
        toast('warning', `⚠️ ${error.message}`)
      } else {
        toast('error', error.message)
      }
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
