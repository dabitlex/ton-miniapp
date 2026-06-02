// src/components/ui/XPPopupLayer.tsx — Redesigned (Aurora OS · XP burst)
'use client'
import { useUIStore } from '@/stores/useUIStore'

export function XPPopupLayer() {
  const xpPopups = useUIStore(s => s.xpPopups)
  return (
    <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
      {xpPopups.map(p => (
        <div key={p.id} className="absolute left-1/2 -translate-x-1/2 top-1/3"
          style={{ animation: 'xpFloat 2.5s cubic-bezier(0.22,1,0.36,1) forwards' }}>
          <div className="relative flex flex-col items-center gap-1">
            {/* burst ring */}
            <span className="absolute -inset-6 rounded-full xp-burst"
              style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.5), transparent 70%)' }} />
            {p.levelUp && p.newLevel && (
              <div className="relative display-xl text-2xl text-glow-gold" style={{ color: '#FBBF24' }}>
                LEVEL {p.newLevel}! 🎉
              </div>
            )}
            <div className="relative display-xl text-3xl text-glow-violet"
              style={{ color: p.levelUp ? '#FBBF24' : '#C4B5FD' }}>
              +{p.xp} XP
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
