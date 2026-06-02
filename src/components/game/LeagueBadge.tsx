// src/components/game/LeagueBadge.tsx — Redesigned (Aurora OS)
import type { LeagueTier } from '@/types/game'

const CONFIGS: Record<LeagueTier, { label: string; emoji: string; color: string }> = {
  bronze:    { label: 'Bronze',    emoji: '🥉', color: '#D08A52' },
  silver:    { label: 'Silver',    emoji: '🥈', color: '#B8BAC0' },
  gold:      { label: 'Gold',      emoji: '🥇', color: '#FBBF24' },
  platinum:  { label: 'Platinum',  emoji: '💎', color: '#5EEAD4' },
  diamond:   { label: 'Diamond',   emoji: '💠', color: '#5B8DEF' },
  legendary: { label: 'Legend',    emoji: '👑', color: '#A78BFA' },
}

interface Props { league: LeagueTier; compact?: boolean }

export function LeagueBadge({ league, compact = false }: Props) {
  const cfg = CONFIGS[league] ?? CONFIGS.bronze

  if (compact) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, borderRadius: 7, fontSize: 13,
        background: `${cfg.color}1f`, boxShadow: `inset 0 0 0 1px ${cfg.color}33`,
      }}>
        {cfg.emoji}
      </span>
    )
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      color: cfg.color, background: `${cfg.color}1a`,
      boxShadow: `inset 0 0 0 1px ${cfg.color}33`,
    }}>
      {cfg.emoji} {cfg.label}
    </span>
  )
}
