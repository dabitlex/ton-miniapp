// src/features/quests/hooks.ts
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { v4 as uuidv4 }  from 'uuid'
import { authedFetch }   from '@/lib/authedFetch'
import { useAuthStore }   from '@/stores/useAuthStore'
import { useQuestStore }  from '@/stores/useQuestStore'
import { useEnergyStore } from '@/stores/useEnergyStore'
import { useQuestRewardStore } from '@/stores/useQuestRewardStore'
import { useUserStore }   from '@/stores/useUserStore'
import { useUIStore }     from '@/stores/useUIStore'
import type { DailyQuest, WeeklyQuest } from '@/types/game'
import { tStatic } from '@/lib/i18n'

// In-Flight-Guard für Quest-Completions: bewusst AUSSERHALB von React-State,
// weil React-State-Updates gebatcht/verzögert sein können (v.a. auf
// langsamen Geräten mit Render-Lag) — ein Set-Zugriff ist synchron und
// verhindert zuverlässig, dass ein zweiter Tap auf denselben Quest-Button
// eine zweite parallele Complete-Anfrage auslöst, bevor React neu gerendert
// hat. Das war die eigentliche Ursache für "Energie weg & sofort wieder da,
// kein XP, Quest bleibt available" auf manchen Geräten.
const inFlightQuestIds = new Set<string>()

// Trägt den API-Fehlercode (z.B. 'ALREADY_COMPLETED') zusätzlich zur
// Nachricht mit — vorher konnte man Fehlerarten nur per (unzuverlässigem)
// Substring-Match auf die menschenlesbare Nachricht unterscheiden, die
// serverseitig oft ein anderer Text als der Code ist.
export class ApiError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

/**
 * FIX Aug 2026: Ohne Zeitlimit konnte eine haengende Anfrage (schlechtes
 * Netz, schlafender Serverless-Container) NIE abschliessen. onSettled lief
 * dann nicht, der In-Flight-Guard blieb gesetzt und die Quest liess sich
 * bis zum App-Neustart nicht mehr antippen — eines der gemeldeten Symptome.
 */
const REQUEST_TIMEOUT_MS = 20_000

/**
 * HAUPTURSACHE des "Quest laesst sich nicht abschliessen"-Problems:
 *
 * Diese Datei hatte ein EIGENES apiFetch, das den Token nur mitschickte.
 * Laeuft der Token mitten in der Sitzung ab (Gueltigkeit 1 Stunde, im
 * mobilen WebView wird der proaktive Refresh-Timer gedrosselt oder beim
 * Backgrounding angehalten), antwortet der Server mit 401 — und dieses
 * apiFetch hat den Fehler einfach durchgereicht.
 *
 * Folge: Die Quest blieb offen, die optimistisch abgezogene Energie stand
 * falsch in der Anzeige, und JEDER weitere Versuch scheiterte identisch —
 * dauerhaft, weil der Token nie erneuert wurde. Erst ein vollstaendiger
 * App- oder Geraeteneustart (oder Stunden Wartezeit, bis das System das
 * WebView beendet) erzwang eine frische Anmeldung. Genau das gemeldete Bild.
 *
 * authedFetch erneuert bei 401 den Token EINMAL und wiederholt die Anfrage.
 * Der Rest der App nutzt es laengst — der Quest-Pfad war uebersehen worden.
 */
async function apiFetch<T>(url: string, _token: string, options?: RequestInit): Promise<T> {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await authedFetch(url, {
      ...options,
      signal:  ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    })
    const json = await res.json().catch(() => null)
    if (!json) throw new ApiError(tStatic('err.network'), 'NETWORK_ERROR')
    if (!json.success) throw new ApiError(json.error ?? 'Request failed', json.code)
    return json.data as T
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new ApiError(tStatic('err.timeout'), 'TIMEOUT')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

export function useQuests() {
  const token      = useAuthStore(s => s.accessToken)
  const questStore = useQuestStore()
  const energy     = useEnergyStore()
  const { patchProfile } = useUserStore()
  const { showXPGain, toast, haptic } = useUIStore()
  const enqueueAchievements = useUIStore(s => s.enqueueAchievements)
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

    onSuccess: (data, { questId, questType }, context) => {
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

      // Freigeschaltete Achievements → Popup-Queue
      if (data.newAchievements?.length) {
        enqueueAchievements(data.newAchievements)
      }

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

      // Reward-Popup: zeigt die verdiente XP + Option "Werbung für ×2".
      // Wenn mit dieser Quest alle Daily Quests fertig sind, öffnet das Popup
      // danach die Mystery Box (Verkettung statt zwei gleichzeitiger Modals).
      {
        const q = [...useQuestStore.getState().daily, ...useQuestStore.getState().weekly]
          .find(x => x.id === questId)
        useQuestRewardStore.getState().show({
          questId,
          questType,
          baseXp:          data.xpGranted,
          title:           q?.template?.title,
          mysteryBoxAfter: !!data.mysteryBoxUnlocked,
        })
      }
    },

    onError: (error: Error, _, context) => {
      // ALREADY_COMPLETED heißt: eine andere (i.d.R. die echte, erfolgreiche)
      // Anfrage für dieselbe Quest ist bereits durchgelaufen. Der lokale
      // State darf dann NICHT zurückgerollt werden — sonst überschreiben wir
      // genau das korrekte "completed" wieder mit "available", obwohl Server-
      // seitig längst XP vergeben wurde. Der In-Flight-Guard unten verhindert
      // diesen Fall inzwischen von vornherein; dieser Check bleibt als
      // zweite Absicherung (z.B. falls ein Request trotz Guard clientseitig
      // gecancelt und erneut gestellt wurde).
      // FIX Aug 2026 ("Marii-Bug"): Bisher galt nur ALREADY_COMPLETED als
      // "kein echter Fehler". Die Codes aus dem Status-Check der Route
      // (QUEST_COMPLETED / QUEST_EXPIRED / QUEST_LOCKED) erzeugten dagegen
      // einen roten Fehler-Toast — und die Quest-Liste wurde NIE neu geladen
      // (invalidate lief nur im Erfolgsfall). Ergebnis: Die Quest wirkte
      // weiter offen, der Nutzer tippte endlos ins Leere (29x in wenigen
      // Minuten, bis zum Rate-Limit).
      const isStatusMismatch = error instanceof ApiError && (
        error.code === 'ALREADY_COMPLETED' ||
        error.code === 'QUEST_COMPLETED'   ||
        error.code === 'QUEST_EXPIRED'     ||
        error.code === 'QUEST_LOCKED'
      )

      // FIX Aug 2026: Die Energie wurde bei Status-Konflikten NICHT
      // zurueckgesetzt. Serverseitig wird in diesen Faellen aber gar keine
      // Energie abgezogen (der Abschluss scheitert vorher) — die Anzeige
      // blieb also faelschlich reduziert, bis der Nutzer die App neu
      // startete. Genau das gemeldete Symptom.
      // Die Energie wird jetzt IMMER zurueckgesetzt; anschliessend holt
      // refreshProfile() den autoritativen Serverwert nach.
      if (context?.prevEnergy !== undefined) energy.restore(context.prevEnergy)
      if (!isStatusMismatch && context?.questId) {
        questStore.rollbackComplete(context.questId)
      }
      // Serverstand nachziehen, damit Anzeige und Datenbank sicher
      // uebereinstimmen — unabhaengig davon, welcher Fehler auftrat.
      useUserStore.getState().refreshProfile()

      // Verifikationsfehler verständlich anzeigen
      if (isStatusMismatch) {
        // Kein Fehler-Toast (es ist keiner) — aber die Listen SOFORT neu laden,
        // damit der veraltete Eintrag verschwindet.
        qc.invalidateQueries({ queryKey: ['quests', 'daily'] })
        qc.invalidateQueries({ queryKey: ['quests', 'weekly'] })
        // still — kein Toast/Haptic, der Nutzer hat die Quest ja tatsächlich
        // abgeschlossen; der nächste Refetch zeigt den korrekten Stand.
      } else if (error.message.includes('QUEST_CONDITION_NOT_MET') ||
          error.message.includes(tStatic('quest.conditionNotMet')) ||
          error.message.includes('noch nicht')) {
        toast('warning', `⚠️ ${error.message}`)
      } else {
        toast('error', error.message)
      }
      if (!isStatusMismatch) haptic('error')
    },

    onSettled: (_data, _error, _vars, context) => {
      // Läuft IMMER (Erfolg oder Fehler) — gibt den In-Flight-Guard und den
      // sichtbaren "completing"-Zustand zuverlässig frei, unabhängig davon,
      // welcher der beiden Handler oben gefeuert hat.
      if (context?.questId) {
        inFlightQuestIds.delete(context.questId)
        questStore.setCompleting(null)
      }
    },
  })

  return {
    daily:           questStore.daily,
    weekly:          questStore.weekly,
    isLoadingDaily:  isLoadingDaily || questStore.isLoadingDaily,
    isLoadingWeekly: isLoadingWeekly || questStore.isLoadingWeekly,
    completingId:    questStore.completingId,
    completeQuest:   (questId: string, questType: 'daily' | 'weekly') => {
      // Synchroner Guard: läuft für diese Quest schon eine Anfrage,
      // wird der zweite Tap ignoriert — komplett unabhängig davon, ob
      // React zwischenzeitlich schon neu gerendert hat.
      if (inFlightQuestIds.has(questId)) return
      inFlightQuestIds.add(questId)
      completeQuest({ questId, questType })
    },
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
