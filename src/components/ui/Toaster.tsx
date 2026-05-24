// src/components/ui/Toaster.tsx
'use client'
import { useUIStore } from '@/stores/useUIStore'
import { cn }         from '@/lib/utils'
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'

const ICONS = { success: CheckCircle, error: AlertCircle, info: Info, warning: AlertTriangle }
const COLORS = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  error:   'border-red-500/30    bg-red-500/10    text-red-200',
  info:    'border-blue-500/30   bg-blue-500/10   text-blue-200',
  warning: 'border-amber-500/30  bg-amber-500/10  text-amber-200',
}

export function Toaster() {
  const { toasts, removeToast } = useUIStore()
  return (
    <div className="fixed top-[calc(env(safe-area-inset-top)+60px)] left-0 right-0 z-50
                    flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map(t => {
        const Icon = ICONS[t.type]
        return (
          <div key={t.id}
            className={cn(
              'w-full max-w-sm flex items-center gap-3 px-4 py-3 rounded-2xl border',
              'backdrop-blur-xl shadow-lg pointer-events-auto',
              'animate-in slide-in-from-top-3 duration-300',
              COLORS[t.type]
            )}>
            <Icon size={15} className="shrink-0" />
            <span className="flex-1 text-sm font-medium">{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="shrink-0 opacity-50 hover:opacity-100">
              <X size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// src/components/ui/XPPopupLayer.tsx
// Floating +XP animation that appears over all content
'use client'
import { useUIStore } from '@/stores/useUIStore'

export function XPPopupLayer() {
  const { xpPopups } = useUIStore()
  return (
    <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
      {xpPopups.map(p => (
        <div
          key={p.id}
          className="absolute left-1/2 -translate-x-1/2 top-1/3
                     animate-[xpFloat_2.5s_ease-out_forwards]"
        >
          <div className="text-center">
            {p.levelUp && (
              <div className="text-2xl font-black text-yellow-300 drop-shadow-lg mb-1
                              animate-[xpPulse_0.5s_ease-out]">
                LEVEL UP! 🎉
              </div>
            )}
            <div className={cn(
              'text-xl font-black drop-shadow-lg',
              p.levelUp ? 'text-yellow-300' : 'text-violet-300'
            )}>
              +{p.xp} XP
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

import { cn } from '@/lib/utils'