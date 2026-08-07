// src/lib/constants/war.ts
// Clan-Wars-Spielregeln — MUSS die SQL-Konstanten spiegeln
// (war_daily_cap / war_reward_win / war_reward_draw / war_reward_loss /
//  war_min_members in Migration 00004). Server bleibt autoritativ; diese
// Werte sind reine Anzeige-Konstanten fürs Frontend.

export const WAR_RULES = {
  dailyCap:    2500,   // War-XP pro Spieler & UTC-Tag
  rewardWin:   2000,   // XP pro teilnehmendem Mitglied (≥1 War-XP)
  rewardDraw:  1000,
  rewardLoss:  500,    // kein XP-Verlust — Verlierer erhalten Trost-XP
  minMembers:  3,      // Mindest-Clangröße fürs Matchmaking
} as const

export type WarState  = 'no_clan' | 'idle' | 'live' | 'result'
export type WarResult = 'win' | 'loss' | 'draw'

export interface WarClanSide {
  id: string | null
  name: string
  slug: string
  avatarUrl: string | null
  level: number
  memberCount: number
  score: number
  perCapita: number
}

export interface WarLiveData {
  state: 'live'
  warId: string
  startsAt: string
  endsAt: string
  myClan: WarClanSide
  rival: WarClanSide
  frontline: number            // 0..1 — Anteil des eigenen Clans
  myContribution: { total: number; today: number; dailyCap: number; isParticipant: boolean }
  topMine:  WarFighter[]
  topRival: WarFighter[]
}

export interface WarFighter {
  firstName: string
  username: string | null
  photoUrl: string | null
  level: number
  xp: number
}

export interface WarResultData {
  state: 'result'
  warId: string
  result: WarResult
  rewardXp: number
  myContribution: number
  myRankInClan: number | null
  endedAt: string
  myClan: WarClanSide
  rival: WarClanSide
}

export interface WarIdleData {
  state: 'idle'
  nextWarAt: string
}

export interface WarHistoryEntry {
  warId: string
  endedAt: string
  outcome: WarResult
  myResult: WarResult | null
  myRewardXp: number
  myContribution: number
  rival: { name: string; avatarUrl: string | null }
  myPerCapita: number
  rivalPerCapita: number
}

export type WarData = WarLiveData | WarResultData | WarIdleData | { state: 'no_clan' }
