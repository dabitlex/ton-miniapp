// src/components/layout/EnergyStrip.tsx — Redesigned (Aurora OS)
'use client'
import { useEnergy } from '@/features/hooks'
import { Zap } from 'lucide-react'

export function EnergyStrip() {
  const energy = useEnergy()
  const pct    = Math.round((energy.current / 100) * 100)
  const isLow  = energy.current < 20
  const isFull = energy.current >= 100

  const fill = isLow
    ? 'linear-gradient(90deg, #F43F5E, #FB7185)'
    : isFull
    ? 'linear-gradient(90deg, #10B981, #5EEAD4)'
    : 'var(--aurora)'

  const accent = isLow ? '#FB7185' : isFull ? '#34D399' : 'var(--violet-bright)'

  return (
    <div className="shrink-0 flex items-center gap-3 px-4 h-[34px] relative z-10">
      <Zap
        size={13}
        fill={isLow ? '#FB7185' : '#A78BFA'}
        style={{
          color: isLow ? '#FB7185' : '#A78BFA',
          filter: `drop-shadow(0 0 5px ${isLow ? 'rgba(251,113,133,0.7)' : 'rgba(167,139,250,0.7)'})`,
          flexShrink: 0,
        }}
      />

      <div className="flex-1 h-[4px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: fill,
            boxShadow: `0 0 10px ${isLow ? 'rgba(251,113,133,0.5)' : 'rgba(139,92,246,0.55)'}`,
          }} />
      </div>

      <span className="text-[12px] font-bold tabular-nums shrink-0"
        style={{ color: accent, minWidth: '46px', textAlign: 'right', fontFamily: 'var(--font-display)' }}>
        {energy.current}<span style={{ color: 'var(--text-faint)' }}>/100</span>
      </span>

      {!isFull && energy.nextRegenAt && (
        <span className="text-[10px] shrink-0 font-medium" style={{ color: 'var(--text-faint)' }}>
          +1 {formatRegen(energy.nextRegenAt)}
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
