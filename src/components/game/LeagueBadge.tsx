// src/components/game/LeagueBadge.tsx
import { cn } from '@/lib/utils'
import type { LeagueTier } from '@/types/game'

const LEAGUE_CFG: Record<LeagueTier, { label: string; icon: string; cls: string }> = {
  bronze:    { label: 'Bronze',    icon: '🥉', cls: 'bg-amber-900/40  text-amber-500   border-amber-700/30'  },
  silver:    { label: 'Silver',    icon: '🥈', cls: 'bg-slate-500/20  text-slate-300   border-slate-500/30'  },
  gold:      { label: 'Gold',      icon: '🥇', cls: 'bg-yellow-500/20 text-yellow-400  border-yellow-500/30' },
  platinum:  { label: 'Platinum',  icon: '💎', cls: 'bg-cyan-500/20   text-cyan-300    border-cyan-500/30'   },
  diamond:   { label: 'Diamond',   icon: '💠', cls: 'bg-blue-500/20   text-blue-300    border-blue-500/30'   },
  legendary: { label: 'Legendary', icon: '👑', cls: 'bg-violet-500/20 text-violet-300  border-violet-500/30' },
}

interface LeagueBadgeProps {
  league:   LeagueTier
  compact?: boolean
  size?:    'sm' | 'md'
}

export function LeagueBadge({ league, compact = false, size = 'sm' }: LeagueBadgeProps) {
  const { label, icon, cls } = LEAGUE_CFG[league]
  return (
    <div className={cn(
      'inline-flex items-center gap-1 font-semibold border rounded-lg',
      size === 'sm'
        ? 'text-[10px] px-1.5 py-0.5'
        : 'text-xs px-2 py-1',
      cls
    )}>
      <span>{icon}</span>
      {!compact && <span>{label}</span>}
    </div>
  )
}
