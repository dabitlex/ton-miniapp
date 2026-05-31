// src/components/game/QuestCard.tsx
'use client'
import { cn } from '@/lib/utils'
import { Zap, Star, CheckCircle2 } from 'lucide-react'

interface QuestCardProps {
  quest: {
    id:         string
    status:     string
    energyCost: number
    xpReward:   number
    template:   { title: string; description: string; difficulty: string; iconKey?: string }
  }
  onComplete:  (id: string) => void
  completing:  boolean
  index?:      number
}

const DIFF_CONFIG = {
  easy:   { label: 'EASY',   color: '#10B981', glow: 'rgba(16,185,129,0.3)',   bg: 'rgba(16,185,129,0.08)'  },
  medium: { label: 'MED',    color: '#F59E0B', glow: 'rgba(245,158,11,0.3)',  bg: 'rgba(245,158,11,0.08)' },
  hard:   { label: 'HARD',   color: '#F43F5E', glow: 'rgba(244,63,94,0.3)',   bg: 'rgba(244,63,94,0.08)'  },
}

export function QuestCard({ quest, onComplete, completing, index = 0 }: QuestCardProps) {
  const diff    = DIFF_CONFIG[quest.template.difficulty as keyof typeof DIFF_CONFIG] ?? DIFF_CONFIG.easy
  const isDone  = quest.status === 'completed'
  const isActive= quest.status === 'available'

  return (
    <div className={cn(
      'rounded-2xl p-4 transition-all duration-200 relative overflow-hidden',
      isDone ? 'opacity-55' : 'active:scale-[0.98]',
    )}
      style={{
        background: isDone
          ? 'rgba(255,255,255,0.02)'
          : 'rgba(255,255,255,0.04)',
        border: isDone
          ? '1px solid rgba(255,255,255,0.05)'
          : '1px solid rgba(255,255,255,0.09)',
        boxShadow: isDone ? 'none' : '0 2px 12px rgba(0,0,0,0.2)',
      }}>

      {/* Difficulty accent line */}
      {!isDone && (
        <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
          style={{ background: diff.color, boxShadow: `0 0 8px ${diff.glow}` }} />
      )}

      <div className="flex items-start gap-3 pl-1.5">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{
            background: isDone ? 'rgba(255,255,255,0.04)' : diff.bg,
            border: `1px solid ${isDone ? 'rgba(255,255,255,0.06)' : diff.color + '33'}`,
          }}>
          {isDone ? '✓' : (quest.template.iconKey ?? '⚔️')}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className={cn(
              'text-sm font-semibold truncate',
              isDone ? 'line-through' : 'text-white',
            )}
              style={{ color: isDone ? 'rgba(255,255,255,0.3)' : undefined }}>
              {quest.template.title}
            </p>
            <span className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded shrink-0"
              style={{
                color: diff.color,
                background: diff.bg,
                fontFamily: 'var(--font-display)',
              }}>
              {diff.label}
            </span>
          </div>

          <p className="text-[11px] leading-relaxed mb-2"
            style={{ color: 'rgba(255,255,255,0.35)' }}>
            {quest.template.description}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Energy cost */}
              <span className="flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: 'rgba(6,182,212,0.8)' }}>
                <Zap size={10} fill="currentColor" />
                {quest.energyCost}
              </span>
              {/* XP reward */}
              <span className="flex items-center gap-1 text-[11px] font-bold"
                style={{ color: 'rgba(168,85,247,0.9)' }}>
                <Star size={10} fill="currentColor" />
                +{quest.xpReward.toLocaleString()} XP
              </span>
            </div>

            {/* CTA */}
            {isDone ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: '#10B981' }}>
                <CheckCircle2 size={12} />
                Erledigt
              </span>
            ) : isActive ? (
              <button
                onClick={() => onComplete(quest.id)}
                disabled={completing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           text-xs font-bold text-white transition-all
                           active:scale-95 disabled:opacity-50"
                style={{
                  background: completing
                    ? 'rgba(124,58,237,0.4)'
                    : 'linear-gradient(135deg, #7C3AED, #A855F7)',
                  boxShadow: '0 2px 12px rgba(124,58,237,0.3)',
                }}>
                {completing
                  ? <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  : '✓ Starten'
                }
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
