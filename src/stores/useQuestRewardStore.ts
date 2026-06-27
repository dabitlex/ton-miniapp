// src/stores/useQuestRewardStore.ts
// Steuert das Reward-Popup, das nach Abschluss einer Daily/Weekly-Quest erscheint
// (zeigt die verdiente XP + optional "Werbung schauen für ×2").
import { create } from 'zustand'

export interface QuestRewardData {
  questId:          string
  questType:        'daily' | 'weekly'
  baseXp:           number            // tatsächlich vergebene Basis-XP (aus completeQuest)
  title?:           string            // Quest-Titel (optional, für die Anzeige)
  mysteryBoxAfter?: boolean           // wenn true: nach dem Schließen die Mystery Box öffnen
}

interface QuestRewardState {
  isOpen: boolean
  data:   QuestRewardData | null
  show:   (data: QuestRewardData) => void
  close:  () => void
}

export const useQuestRewardStore = create<QuestRewardState>((set) => ({
  isOpen: false,
  data:   null,
  show:   (data) => set({ isOpen: true, data }),
  close:  () => set({ isOpen: false }),
}))
