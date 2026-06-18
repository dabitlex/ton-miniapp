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
      // KEIN setLoadingDaily(true) hier: Hintergrund-Refreshes (nach jedem
      // Claim und alle 60s) sollen die Liste lautlos in-place aktualisieren,
      // nicht das Skelett zeigen. Das Skelett erscheint nur beim Erstladen
      // (React-Query isLoading), solange der Store noch keine Daten hat.
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
      // energyCost kann je nach Datenpfad fehlen (undefined) → auf 0 absichern,
      // damit die Energie-Anzeige nicht fälschlich auf 0 springt.
      if (quest) energy.optimisticConsume(quest.template.energyCost ?? 0)
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
          xpTotal:       profile.xpTotal + data.xpGranted,   // ← hielt vorher nicht Schritt → Total/Season drifteten
          xpEarnedToday: profile.xpEarnedToday + data.xpGranted,
        })
      }

      if (data.softCapped) {
        toast('warning', '⚠️ Tages-XP-Limit erreicht. Komm morgen wieder!', 4000)
      }

      // Nach Abschluss: Quests lautlos neu laden, damit der Fortschritt der
      // ANDEREN Quests sofort stimmt (z.B. "verbrauche 30 Energie" schaltet
      // frei, "Champion" entsperrt sich) — ohne sichtbares Neuladen.
      qc.invalidateQueries({ queryKey: ['quests', questType] })
      qc.invalidateQueries({ queryKey: ['leaderboard'] })

      // Echte Server-Werte nachziehen (Total/Season XP, Level, Liga, Meilensteine)
      // → kein App-Neustart mehr nötig, damit die Zahlen konsistent sind.
      useUserStore.getState().refreshProfile()

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

// ── "First Steps" onboarding quests ──────────────────────────
export interface OnboardingActionSpec {
  action: 'link' | 'navigate' | 'none'
  url?:    string
  route?:  string
  anchor?: string
}

export interface OnboardingQuestItem {
  id:            string
  status:        'available' | 'completed' | 'expired' | 'failed' | 'locked' | 'active'
  xpGranted:     number | null
  completedAt:   string | null
  justCompleted: boolean
  leveledUp:     boolean
  newLevel?:     number
  newLeague?:    string
  template: {
    internalCode: string
    title:        string
    description:  string
    xpReward:     number
    iconKey:      string
    actionSpec:   OnboardingActionSpec
    sortOrder:    number
  }
  referral?: {
    xp:     { current: number; required: number; met: boolean }
    wallet: { met: boolean }
  }
}

interface OnboardingResponse {
  items:          OnboardingQuestItem[]
  completedCount: number
  totalCount:     number
}

interface SpecialCompleteResult {
  xpGranted:   number
  leveledUp:   boolean
  newLevel:    number
  newLeague:   string
  energyAfter: number
  softCapped:  boolean
}

export function useOnboardingQuests() {
  const token = useAuthStore(s => s.accessToken)
  const { showXPGain, toast, haptic } = useUIStore()
  const { patchProfile } = useUserStore()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey:  ['quests', 'onboarding'],
    enabled:   !!token,
    staleTime: 60_000,
    queryFn:   async () => {
      const data = await apiFetch<OnboardingResponse>('/api/v1/quests/onboarding', token!)

      // Quests that were JUST auto-completed during this call
      // (e.g. wallet was already connected) -> XP toast + refresh profile.
      const justCompleted = data.items.filter(i => i.justCompleted && i.xpGranted)
      for (const item of justCompleted) {
        showXPGain(item.xpGranted!, item.leveledUp, item.leveledUp ? item.newLevel : undefined)
        if (item.leveledUp && item.newLevel && item.newLeague) {
          patchProfile({ level: item.newLevel, league: item.newLeague as any })
        }
      }
      if (justCompleted.length > 0) {
        useUserStore.getState().refreshProfile()
        qc.invalidateQueries({ queryKey: ['leaderboard'] })
      }

      return data
    },
  })

  // Explicit re-check (mainly the Telegram channel quest: "Done, I joined")
  const { mutate: recheckQuest, isPending: isRechecking } = useMutation({
    mutationFn: async (questId: string) => {
      const nonce = uuidv4()
      return apiFetch<SpecialCompleteResult>('/api/v1/quests/complete', token!, {
        method: 'POST',
        body:   JSON.stringify({ questId, questType: 'special', nonce }),
      })
    },
    onSuccess: (result) => {
      showXPGain(result.xpGranted, result.leveledUp, result.leveledUp ? result.newLevel : undefined)
      if (result.leveledUp) {
        patchProfile({ level: result.newLevel, league: result.newLeague as any })
        haptic('heavy')
      }
      useUserStore.getState().refreshProfile()
      qc.invalidateQueries({ queryKey: ['quests', 'onboarding'] })
      qc.invalidateQueries({ queryKey: ['leaderboard'] })
    },
    onError: (error: Error) => {
      if (error.message.includes('CHANNEL_NOT_JOINED')) {
        toast('warning', 'Not joined yet — join the channel first, then try again.')
      } else if (error.message.includes('VERIFY_UNAVAILABLE')) {
        toast('warning', 'Verification temporarily unavailable — please try again in a few seconds.')
      } else if (error.message.includes('QUEST_CONDITION_NOT_MET')) {
        toast('warning', `⚠️ ${error.message}`)
      } else {
        toast('error', error.message)
      }
      haptic('error')
    },
  })

  return {
    items:          data?.items ?? [],
    completedCount: data?.completedCount ?? 0,
    totalCount:     data?.totalCount ?? 0,
    isLoading,
    recheckQuest,
    isRechecking,
  }
}
