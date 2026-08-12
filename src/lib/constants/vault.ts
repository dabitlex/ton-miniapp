// src/lib/constants/vault.ts
// Weekly-Vault-Regeln — MUSS die SQL-Konstanten aus Migration 00006 spiegeln
// (vault_max_tickets / vault_jackpot_base / vault_xp_per_ticket).
// Der Server bleibt autoritativ; diese Werte sind reine Anzeige-Konstanten.

export const VAULT_RULES = {
  maxTickets:   20,      // Lose pro Nutzer und Runde
  jackpotBase:  25000,   // Grundstock je Runde
  xpPerTicket:  200,     // Jackpot-Zuwachs je ausgegebenem Los
  drawWeekday:  0,       // Sonntag
  drawHourUtc:  21,      // 21:00 UTC
  prizeSplit: [
    { rank: 1,  count: 1,  pct: 0.40 },
    { rank: 2,  count: 2,  pct: 0.15 },
    { rank: 4,  count: 10, pct: 0.03 },
  ],
} as const

export type VaultState = 'off' | 'idle' | 'open' | 'result'

export interface VaultSource {
  key: 'daily_quests' | 'streak' | 'ads' | 'clan_missions' | 'weekly_quest'
  tickets: number
  earned: boolean
  current: number
  target: number
}

export interface VaultPrize { rank: number; count: number; pct: number; xp: number }

export interface VaultOpen {
  enabled: true
  state: 'open'
  roundId: string
  roundNumber: number
  startsAt: string
  drawAt: string
  jackpot: number
  totalTickets: number
  seedHash: string
  myTickets: number
  maxTickets: number
  oddsOneIn: number | null
  sources: VaultSource[]
  prizes: VaultPrize[]
}

export interface VaultResult {
  enabled: true
  state: 'result'
  roundId: string
  roundNumber: number | null
  rank: number
  prizeXp: number
  myTickets: number
  totalTickets: number
  jackpot: number
  seed: string | null
  seedHash: string | null
  drawnAt: string | null
}

export interface VaultIdle {
  enabled: true
  state: 'idle'
  nextRoundAt: string
}

export interface VaultOff { enabled: false; state: 'off' }

export type VaultData = VaultOpen | VaultResult | VaultIdle | VaultOff

/** Anzeigetexte der Los-Quellen */
export const VAULT_SOURCE_LABEL: Record<VaultSource['key'], string> = {
  daily_quests:  'Complete all daily quests',
  streak:        'Claim your daily streak',
  ads:           'Watch 5 ads',
  clan_missions: 'Complete clan missions',
  weekly_quest:  'Complete a weekly quest',
}
