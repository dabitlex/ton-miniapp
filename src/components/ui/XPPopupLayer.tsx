// src/components/ui/XPPopupLayer.tsx
'use client'
import { useUIStore } from '@/stores/useUIStore'
import { cn }         from '@/lib/utils'

export function XPPopupLayer() {
  const xpPopups = useUIStore(s => s.xpPopups)
  return (
    <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
      {xpPopups.map(p => (
        <div
          key={p.id}
          className="absolute left-1/2 -translate-x-1/2 top-1/3"
          style={{ animation: 'xpFloat 2.5s ease-out forwards' }}
        >
          <div className="text-center space-y-1">
            {p.levelUp && p.newLevel && (
              <div className="text-2xl font-black text-yellow-300 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]">
                LEVEL {p.newLevel}! 🎉
              </div>
            )}
            <div className={cn(
              'text-2xl font-black drop-shadow-lg',
              p.levelUp ? 'text-yellow-300' : 'text-violet-300'
            )}>
              +{p.xp} XP ⭐
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}