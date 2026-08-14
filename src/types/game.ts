// src/types/game.ts
// Domain types — decoupled from DB row types

export type LeagueTier =
  | 'bronze' | 'silver' | 'gold'
  | 'platinum' | 'diamond' | 'legendary'

export type QuestDifficulty = 'easy' | 'medium' | 'hard'
export type QuestType = 'daily' | 'weekly' | 'special' | 'clan_mission'
export type QuestStatus = 'available' | 'active' | 'completed' | 'expired' | 'failed' | 'locked'
export type SeasonStatus = 'upcoming' | 'active' | 'off_season' | 'ended'
export type EcosystemTierKey = 'tier_1' | 'tier_5' | 'tier_20' | 'tier_50' | 'tier_100'

export type XPSourceType =
  | 'quest_daily' | 'quest_weekly' | 'quest_special'
  | 'clan_mission' | 'clan_war_win' | 'streak_bonus'
  | 'referral_bonus' | 'pvp_win' | 'season_bonus'
  | 'admin_grant' | 'correction'

// ─── Core models ───────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  telegramId: number
  telegramUsername: string | null
  telegramFirstName: string
  telegramLastName: string | null
  telegramPhotoUrl: string | null
  telegramIsPremium: boolean
  isFounder: boolean
  achievementsEnabled?: boolean
  level: number
  xpTotal: number
  xpCurrentLevel: number
  league: LeagueTier
  energy: EnergyState
  streakCurrent: number
  streakLongest: number
  streakLastActiveDate: string | null
  streakMissEligibleAt: string | null
  xpEarnedToday: number
  isFlagged: boolean
  isBanned: boolean
  currentSeasonId: string | null
  seasonXp: number
  referralCode: string
  languagePreference?: 'de' | 'en' | null
  referralEligible: boolean
  onboardingCompleted: boolean
  lastActiveAt: string
  createdAt: string
  wallet?: WalletInfo
  clan?: UserClanInfo
  ecosystemBoost?: number
  season?: {
    number:   number
    endsAt:   string
    startsAt: string
  } | null
}

export interface EnergyState {
  current: number
  max: 100
  usedToday: number
  lastUpdated: string
  nextRegenAt: string | null
  secondsToFull: number
  /** 1 = normal regen (1 energy/15min), 2 = active ecosystem_support boost (2 energy/15min) */
  regenMultiplier: number
}

export interface QuestTemplate {
  id: string
  internalCode: string
  title: string
  description: string
  difficulty: QuestDifficulty
  questType: QuestType
  energyCost: number
  xpReward: number
  tokenReward: number
  iconKey: string | null
  sortOrder: number
}

export interface QuestProgress {
  current: number
  target: number
  type: 'binary' | 'countable'
  isMet: boolean
}

export interface DailyQuest {
  id: string
  templateId: string
  questDate: string
  status: QuestStatus
  expiresAt: string
  xpGranted: number | null
  energySpent: number | null
  template: QuestTemplate
  progress?: QuestProgress
}

export interface WeeklyQuest {
  id: string
  templateId: string
  isoYear: number
  isoWeek: number
  status: QuestStatus
  xpGranted: number | null
  template: QuestTemplate
  progress?: QuestProgress
}

export interface QuestCompletionResult {
  success: boolean
  xpGranted?: number
  leveledUp?: boolean
  newLevel?: number
  newLeague?: LeagueTier
  energyAfter?: number
  softCapped?: boolean
  error?: string
  errorCode?: string
}

export interface Season {
  id: string
  seasonNumber: number
  name: string
  tagline: string | null
  status: SeasonStatus
  startsAt: string
  endsAt: string
  offSeasonEndsAt: string
  tokenPoolTotal: number
  daysRemaining: number
  hoursRemaining: number
  isActive: boolean
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  firstName: string
  username: string | null
  photoUrl: string | null
  level: number
  league: LeagueTier
  seasonXp: number
  clanName?: string
  streakCurrent?: number
  relicTier?: string | null
  isFounder?: boolean
  isCurrentUser: boolean
}

export interface WalletInfo {
  address: string
  addressFriendly: string | null
  walletVersion: string | null
  status: 'connected' | 'disconnected' | 'suspended'
  connectedAt: string
}

export interface UserClanInfo {
  clanId: string
  clanName: string
  role: 'member' | 'officer' | 'leader'
  joinedAt: string
  contributedXp: number
}

export interface EcosystemSupportTier {
  key: EcosystemTierKey
  tonAmount: number
  boostPercent: number
  label: string
  description: string
}

export interface ActiveEcosystemBoost {
  tier: EcosystemTierKey
  boostPercent: number
  tonAmount: number
  boostActiveFrom: string
  boostActiveUntil: string
}

export interface StreakState {
  current: number
  longest: number
  lastActiveDate: string | null
  missEligibleAt: string | null
  canClaimToday: boolean
  missProtectionAvailable: boolean
}

export interface NotificationItem {
  id: string
  type: 'xp_gain' | 'level_up' | 'streak' | 'quest_complete' | 'energy_full' | 'info' | 'achievement'
  title: string
  message: string
  xpAmount?: number
  newLevel?: number
  timestamp: number
}
