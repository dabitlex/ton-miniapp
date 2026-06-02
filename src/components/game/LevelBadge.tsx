// src/components/game/LevelBadge.tsx — Redesigned (Aurora OS)
interface Props { level: number; size?: 'sm' | 'md' | 'lg' }

export function LevelBadge({ level, size = 'sm' }: Props) {
  const sizes = {
    sm: { px: '5px 9px', fontSize: 11, borderRadius: 9 },
    md: { px: '7px 11px', fontSize: 13, borderRadius: 11 },
    lg: { px: '9px 15px', fontSize: 15, borderRadius: 13 },
  }
  const s = sizes[size]

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: s.px, fontSize: s.fontSize, fontWeight: 800,
      borderRadius: s.borderRadius,
      fontFamily: 'var(--font-display)',
      color: 'white',
      background: 'var(--aurora)',
      boxShadow: '0 4px 14px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
      letterSpacing: '-0.01em',
    }}>
      {level}
    </span>
  )
}
