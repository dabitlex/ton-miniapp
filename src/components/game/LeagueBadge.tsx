// src/components/game/LeagueBadge.tsx
import type { LeagueTier } from '@/types/game'

const CONFIGS: Record<LeagueTier, { label: string; emoji: string; color: string; bg: string }> = {
  bronze:    { label: 'Bronze',    emoji: '🥉', color: '#D97706', bg: 'rgba(217,119,6,0.12)'    },
  silver:    { label: 'Silver',    emoji: '🥈', color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)'  },
  gold:      { label: 'Gold',      emoji: '🥇', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)'   },
  platinum:  { label: 'Platinum',  emoji: '💎', color: '#06B6D4', bg: 'rgba(6,182,212,0.12)'    },
  diamond:   { label: 'Diamond',   emoji: '💠', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)'   },
  legendary: { label: 'Legendary', emoji: '👑', color: '#A855F7', bg: 'rgba(168,85,247,0.12)'   },
}

interface Props { league: LeagueTier }

export function LeagueBadge({ league }: Props) {
  const cfg = CONFIGS[league] ?? CONFIGS.bronze

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}33`,
      fontFamily: 'var(--font-body)',
      boxShadow: `0 0 8px ${cfg.color}22`,
    }}>
      {cfg.emoji} {cfg.label}
    </span>
  )
}
