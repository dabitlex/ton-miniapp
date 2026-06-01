// src/components/layout/EnergyStrip.tsx
'use client'
import { useEnergy } from '@/features/hooks'
import { Zap } from 'lucide-react'

export function EnergyStrip() {
  const energy = useEnergy()
  const pct    = Math.round((energy.current / 100) * 100)
  const isLow  = energy.current < 20
  const isFull = energy.current >= 100

  const color = isLow
    ? 'linear-gradient(90deg, #F43F5E, #FB7185)'
    : isFull
    ? 'linear-gradient(90deg, #10B981, #34D399)'
    : 'linear-gradient(90deg, #7C3AED, #A855F7, #06B6D4)'

  return (
    <div className="shrink-0 flex items-center gap-2.5 px-4 h-8 relative"
      style={{ background: 'rgba(6,6,16,0.8)' }}>

      {/* Energy icon */}
      <Zap
        size={12}
        fill={isLow ? '#F43F5E' : '#A855F7'}
        style={{
          color: isLow ? '#F43F5E' : '#A855F7',
          filter: isLow
            ? 'drop-shadow(0 0 4px rgba(244,63,94,0.8))'
            : 'drop-shadow(0 0 4px rgba(168,85,247,0.8))',
          flexShrink: 0,
        }}
      />

      {/* Progress track */}
      <div className="flex-1 h-[3px] rounded-full"
        style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: isLow
              ? '0 0 8px rgba(244,63,94,0.5)'
              : '0 0 8px rgba(168,85,247,0.5)',
          }} />
      </div>

      {/* Value */}
      <span className="text-[11px] font-bold tabular-nums shrink-0"
        style={{
          color: isLow ? '#F43F5E' : isFull ? '#10B981' : 'rgba(168,85,247,0.9)',
          minWidth: '44px', textAlign: 'right',
        }}>
        {energy.current}/100
      </span>

      {/* Regen timer */}
      {!isFull && energy.nextRegenAt && (
        <span className="text-[10px] shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>
          {formatRegen(energy.nextRegenAt)}
        </span>
      )}
    </div>
  )
}

function formatRegen(nextRegenAt: string): string {
  const diff = new Date(nextRegenAt).getTime() - Date.now()
  if (diff <= 0) return ''
  const m = Math.floor(diff / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return m > 0 ? `${m}m` : `${s}s`
}
