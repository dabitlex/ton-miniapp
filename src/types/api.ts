// src/types/api.ts

export interface ApiSuccess<T> {
  success: true
  data: T
  meta?: ResponseMeta
}

export interface ApiFailure {
  success: false
  error: string
  code: string
  details?: unknown
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure

export interface ResponseMeta {
  page?: number
  limit?: number
  total?: number
  hasMore?: boolean
  refreshedAt?: string
}

// Auth
export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  userId: string
  isNewUser: boolean
}

// Quests
export interface CompleteQuestRequest {
  questId: string
  questType: 'daily' | 'weekly'
  nonce: string
}

export interface CompleteQuestResponse {
  xpGranted: number
  leveledUp: boolean
  newLevel: number
  newLeague: string
  energyAfter: number
  softCapped: boolean
}

// Streak
export interface StreakClaimResponse {
  streakCurrent: number
  xpGranted: number
  missUsed: boolean
}

// Wallet
export interface SaveWalletRequest {
  address: string
  addressFriendly: string | null
  walletVersion: string | null
  publicKey: string | null
}