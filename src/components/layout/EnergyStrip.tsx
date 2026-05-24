// src/components/layout/EnergyStrip.tsx
'use client'
import { useEnergy }   from '@/features/hooks'
import { cn }          from '@/lib/utils'
import { Zap }         from 'lucide-react'

export function EnergyStrip() {
  const { current, isFull, isLow, isEmpty, pct, timeToFull, nextRegenAt } = useEnergy()

  return (
    <div className="shrink-0 flex items-center gap-2 px-4 py-1.5
                    border-b border-white/[0.04] bg-[#0c0c0f]">
      <Zap
        size={11}
        fill="currentColor"
        className={cn(
          'shrink-0 transition-colors',
          isEmpty ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-yellow-300'
        )}
      />

      {/* Track */}
      <div className="flex-1 h-1 rounded-full bg-white/[0.05] overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isEmpty ? 'bg-red-500'
              : isLow  ? 'bg-amber-400'
              : isFull ? 'bg-gradient-to-r from-yellow-300 to-green-400'
              : 'bg-gradient-to-r from-yellow-400 to-yellow-300'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <span className={cn(
        'text-[10px] font-bold tabular-nums shrink-0 transition-colors',
        isEmpty ? 'text-red-400' : isLow ? 'text-amber-300' : 'text-white/40'
      )}>
        {current}/100
        {!isFull && !isEmpty && nextRegenAt && (
          <span className="text-white/20 font-normal"> · {timeToFull}</span>
        )}
      </span>
    </div>
  )
}
