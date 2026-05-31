// src/components/game/XPBar.tsx
'use client'
import { useUserStore } from '@/stores/useUserStore'
import { xpForLevel }   from '@/lib/constants/game'

export function XPBar() {
  const profile = useUserStore(s => s.profile)
  if (!profile) return null

  const needed = xpForLevel(Math.min(profile.level, 29))
  const pct    = Math.min(100, Math.round((profile.xpCurrentLevel / needed) * 100))

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-widest uppercase"
          style={{ color: 'rgba(168,85,247,0.6)', fontFamily: 'var(--font-display)' }}>
          Lv {profile.level}
        </span>
        <span className="text-[10px] font-semibold tabular-nums"
          style={{ color: 'rgba(255,255,255,0.35)' }}>
          {profile.xpCurrentLevel.toLocaleString()} / {needed.toLocaleString()}
        </span>
      </div>

      {/* Track */}
      <div className="relative h-[5px] rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.06)' }}>
        {/* Shimmer */}
        <div className="absolute inset-0 shimmer opacity-50" />
        {/* Fill */}
        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #7C3AED, #A855F7, #06B6D4)',
            boxShadow: '0 0 8px rgba(168,85,247,0.7)',
          }}>
          {/* Leading dot */}
          {pct > 3 && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
              style={{
                background: 'white',
                boxShadow: '0 0 6px rgba(255,255,255,0.9)',
                transform: 'translate(50%, -50%)',
              }} />
          )}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
          {pct}% abgeschlossen
        </span>
        <span className="text-[10px] font-semibold"
          style={{ color: 'rgba(168,85,247,0.5)' }}>
          +{(needed - profile.xpCurrentLevel).toLocaleString()} bis Level {profile.level + 1}
        </span>
      </div>
    </div>
  )
}
