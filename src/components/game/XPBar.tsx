// src/components/game/XPBar.tsx — Redesigned (Aurora OS)
'use client'
import { useUserStore } from '@/stores/useUserStore'
import { xpForLevel }   from '@/lib/constants/game'

export function XPBar() {
  const profile = useUserStore(s => s.profile)
  if (!profile) return null

  const needed = xpForLevel(Math.min(profile.level, 29))
  const pct    = Math.min(100, Math.round((profile.xpCurrentLevel / needed) * 100))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="eyebrow" style={{ color: 'var(--violet-bright)' }}>
          Level {profile.level}
        </span>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {profile.xpCurrentLevel.toLocaleString()} <span style={{ color: 'var(--text-faint)' }}>/ {needed.toLocaleString()}</span>
        </span>
      </div>

      {/* Track */}
      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="absolute inset-0 shimmer opacity-40" />
        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
          style={{
            width: `${pct}%`,
            background: 'var(--aurora)',
            boxShadow: '0 0 14px rgba(139,92,246,0.7)',
          }}>
          {pct > 4 && (
            <div className="absolute right-0 top-1/2 w-2.5 h-2.5 rounded-full"
              style={{
                background: 'white',
                boxShadow: '0 0 8px rgba(255,255,255,0.95)',
                transform: 'translate(50%, -50%)',
              }} />
          )}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-[10px] font-medium" style={{ color: 'var(--text-faint)' }}>
          {pct}% to next
        </span>
        <span className="text-[10px] font-semibold" style={{ color: 'var(--violet-bright)' }}>
          +{(needed - profile.xpCurrentLevel).toLocaleString()} → Lv {profile.level + 1}
        </span>
      </div>
    </div>
  )
}
