// src/lib/constants/game.ts
// SERVER-AUTHORITATIVE constants. Never derive game logic from client values.

export const GAME_CONSTANTS = {
  SEASON_DURATION_DAYS:        42,
  OFF_SEASON_DAYS:              3,
  MAX_ENERGY:                 100,
  ENERGY_REGEN_INTERVAL_SEC:  900,   // 15 minutes
  DAILY_ENERGY_CAP:           320,   // anti-bot
  MAX_LEVEL:                   30,
  XP_CURVE_BASE:              120,
  XP_CURVE_FACTOR:             1.34,
  SOFT_XP_DAILY_CAP:        10000,   // anti-bot soft cap
  BOOST_XP_DAILY_THRESHOLD: 10000,   // boost applies to full daily earnings (= soft cap)
  CLAN_UNLOCK_LEVEL:            6,
  CLAN_MAX_MEMBERS:            20,
  CLAN_CREATION_COST:        5000,
  REFERRAL_MIN_LEVEL:           5,
  REFERRAL_MIN_XP:           2000,
  REFERRAL_MIN_ACTIVE_DAYS:     3,
  DAILY_QUEST_EASY:             3,
  DAILY_QUEST_MEDIUM:           2,
  DAILY_QUEST_HARD:             1,
  WEEKLY_QUESTS_PER_USER:       5,
  STREAK_MISS_PROTECTION_DAYS: 14,
} as const

export const ENERGY_COSTS = {
  EASY_QUEST:    5,
  MEDIUM_QUEST: 10,
  HARD_QUEST:   20,
  CLAN_MISSION: 15,
  CLAN_WAR:     25,
  PVP:          30,
} as const

export const XP_REWARDS = {
  EASY_QUEST:   80,
  MEDIUM_QUEST: 180,
  HARD_QUEST:   500,
  STREAK_BASE:  50,
} as const

export const LEAGUES = {
  bronze:    { min:  1, max:  5 },
  silver:    { min:  6, max: 10 },
  gold:      { min: 11, max: 15 },
  platinum:  { min: 16, max: 20 },
  diamond:   { min: 21, max: 25 },
  legendary: { min: 26, max: 30 },
} as const

export const ECOSYSTEM_TIERS = [
  { key: 'tier_1'   as const, tonAmount:   1, boostPercent:  5, label: 'Supporter',          description: '+5% XP boost and 2x energy regen for the rest of this season' },
  { key: 'tier_5'   as const, tonAmount:   5, boostPercent: 10, label: 'Contributor',         description: '+10% XP boost and 2x energy regen for the rest of this season' },
  { key: 'tier_20'  as const, tonAmount:  20, boostPercent: 18, label: 'Patron',              description: '+18% XP boost and 2x energy regen for the rest of this season' },
  { key: 'tier_50'  as const, tonAmount:  50, boostPercent: 22, label: 'Champion',            description: '+22% XP boost and 2x energy regen for the rest of this season' },
  { key: 'tier_100' as const, tonAmount: 100, boostPercent: 25, label: 'Legendary Supporter', description: '+25% XP boost and 2x energy regen — maximum tier' },
]

/** XP required to advance FROM this level. Formula: floor(120 × 1.34^level) */
export function xpForLevel(level: number): number {
  if (level < 1 || level > 30) throw new RangeError(`Level ${level} out of range`)
  return Math.floor(GAME_CONSTANTS.XP_CURVE_BASE * Math.pow(GAME_CONSTANTS.XP_CURVE_FACTOR, level))
}

/** Derive level from cumulative total XP */
export function levelFromTotalXP(totalXP: number) {
  let level = 1
  let remaining = totalXP
  while (level < GAME_CONSTANTS.MAX_LEVEL) {
    const needed = xpForLevel(level)
    if (remaining < needed) break
    remaining -= needed
    level++
  }
  const xpForNext = level < GAME_CONSTANTS.MAX_LEVEL ? xpForLevel(level) : 0
  return {
    level,
    xpCurrentLevel: remaining,
    xpForNextLevel: xpForNext,
    progressPercent: xpForNext > 0 ? Math.round((remaining / xpForNext) * 100) : 100,
  }
}

export function leagueForLevel(level: number): keyof typeof LEAGUES {
  for (const [name, range] of Object.entries(LEAGUES)) {
    if (level >= range.min && level <= range.max) return name as keyof typeof LEAGUES
  }
  return 'bronze'
}
