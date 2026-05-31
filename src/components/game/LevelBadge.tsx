// src/components/game/LevelBadge.tsx
interface Props { level: number; size?: 'sm' | 'md' | 'lg' }

export function LevelBadge({ level, size = 'sm' }: Props) {
  const sizes = {
    sm: { px: '6px 8px', fontSize: 10, borderRadius: 6 },
    md: { px: '8px 10px', fontSize: 12, borderRadius: 8 },
    lg: { px: '10px 14px', fontSize: 14, borderRadius: 10 },
  }
  const s = sizes[size]

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: s.px, fontSize: s.fontSize, fontWeight: 900,
      borderRadius: s.borderRadius,
      fontFamily: 'var(--font-display)',
      color: 'white',
      background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
      boxShadow: '0 2px 10px rgba(124,58,237,0.35)',
      letterSpacing: '0.02em',
    }}>
      {level}
    </span>
  )
}
