// src/components/game/XPBar.tsx
'use client'
import { useUserStore } from '@/stores/useUserStore'
import { xpForLevel }   from '@/lib/constants/game'
import { cn }           from '@/lib/utils'
import { GAME_CONSTANTS } from '@/lib/constants/game'

export function XPBar({ compact = false }: { compact?: boolean }) {
  const profile = useUserStore(s => s.profile)
  if (!profile) return null

  const isMax     = profile.level >= GAME_CONSTANTS.MAX_LEVEL
  const xpNeeded  = isMax ? 1 : xpForLevel(profile.level)
  const pct       = isMax ? 100 : Math.min(100, (profile.xpCurrentLevel / xpNeeded) * 100)

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-white/35">
        <span>Lv {profile.level}</span>
        {isMax
          ? <span className="text-yellow-400 font-bold">MAX LEVEL</span>
          : <span className="tabular-nums">{profile.xpCurrentLevel.toLocaleString()} / {xpNeeded.toLocaleString()} XP</span>}
      </div>
      <div className={cn('w-full rounded-full bg-white/[0.06] overflow-hidden', compact ? 'h-1' : 'h-1.5')}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-400
                     transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── LevelBadge ─────────────────────────────────────────────────────────

const LEVEL_STYLE = (level: number) => {
  if (level <= 5)  return 'bg-amber-900/40  text-amber-400   border-amber-700/30'
  if (level <= 10) return 'bg-slate-500/20  text-slate-300   border-slate-500/30'
  if (level <= 15) return 'bg-yellow-500/20 text-yellow-400  border-yellow-500/30'
  if (level <= 20) return 'bg-cyan-500/20   text-cyan-300    border-cyan-500/30'
  if (level <= 25) return 'bg-blue-500/20   text-blue-300    border-blue-500/30'
  return                  'bg-violet-500/20 text-violet-300  border-violet-500/30'
}

interface LevelBadgeProps { level: number; size?: 'sm' | 'md' }
export function LevelBadge({ level, size = 'sm' }: LevelBadgeProps) {
  return (
    <div className={cn(
      'inline-flex items-center justify-center font-black border rounded-lg tabular-nums',
      size === 'sm' ? 'text-xs px-1.5 py-0.5 min-w-[28px]' : 'text-sm px-2.5 py-1 min-w-[36px]',
      LEVEL_STYLE(level)
    )}>
      {level}
    </div>
  )
}

// ── LeagueBadge ────────────────────────────────────────────────────────

import type { LeagueTier } from '@/types/game'
const LEAGUE_CFG: Record<LeagueTier, { label: string; icon: string; cls: string }> = {
  bronze:    { label: 'Bronze',    icon: '🥉', cls: 'bg-amber-900/40  text-amber-500   border-amber-700/30'  },
  silver:    { label: 'Silver',    icon: '🥈', cls: 'bg-slate-500/20  text-slate-300   border-slate-500/30'  },
  gold:      { label: 'Gold',      icon: '🥇', cls: 'bg-yellow-500/20 text-yellow-400  border-yellow-500/30' },
  platinum:  { label: 'Platinum',  icon: '💎', cls: 'bg-cyan-500/20   text-cyan-300    border-cyan-500/30'   },
  diamond:   { label: 'Diamond',   icon: '💠', cls: 'bg-blue-500/20   text-blue-300    border-blue-500/30'   },
  legendary: { label: 'Legendary', icon: '👑', cls: 'bg-violet-500/20 text-violet-300  border-violet-500/30' },
}

interface LeagueBadgeProps { league: LeagueTier; compact?: boolean }
export function LeagueBadge({ league, compact = false }: LeagueBadgeProps) {
  const { label, icon, cls } = LEAGUE_CFG[league]
  return (
    <div className={cn(
      'inline-flex items-center gap-1 font-semibold border rounded-lg',
      compact ? 'text-[10px] px-1 py-0.5' : 'text-xs px-1.5 py-0.5',
      cls
    )}>
      <span>{icon}</span>
      {!compact && <span>{label}</span>}
    </div>
  )
}

// ── StreakCard ──────────────────────────────────────────────────────────

import { Button } from '@/components/ui/Button'

interface StreakCardProps {
  current:   number
  longest:   number
  canClaim:  boolean
  isClaiming:boolean
  onClaim:   () => void
}

export function StreakCard({ current, longest, canClaim, isClaiming, onClaim }: StreakCardProps) {
  const flames = Math.min(current, 7)
  return (
    <div className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.04] p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1 mb-1">
            {Array.from({ length: Math.max(1, flames) }).map((_, i) => (
              <span key={i} className="text-base" style={{ opacity: 0.4 + (i / flames) * 0.6 }}>🔥</span>
            ))}
          </div>
          <p className="text-xl font-black text-white tabular-nums">{current} day streak</p>
          <p className="text-xs text-white/35">Best: {longest} days</p>
        </div>
        {canClaim ? (
          <Button
            size="sm"
            loading={isClaiming}
            onClick={onClaim}
            className="bg-orange-500 hover:bg-orange-400 text-white border-transparent h-9 px-4"
          >
            Claim!
          </Button>
        ) : (
          <span className="text-xs text-white/25 font-medium">✓ Claimed today</span>
        )}
      </div>
    </div>
  )
}