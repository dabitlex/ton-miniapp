// src/components/game/QuestCard.tsx
'use client'
import { Zap, Star, CheckCircle2 } from 'lucide-react'
import type { DailyQuest, WeeklyQuest } from '@/types/game'

interface QuestCardProps {
  quest:             DailyQuest | WeeklyQuest
  onComplete:        (id: string) => void
  completing:        boolean
  activeBoostPct?:   number   // aktiver Ecosystem Boost in %
  index?:            number
}

const DIFF_CONFIG = {
  easy:   { label: 'EASY', color: '#10B981', glow: 'rgba(16,185,129,0.3)',  bg: 'rgba(16,185,129,0.08)'  },
  medium: { label: 'MED',  color: '#F59E0B', glow: 'rgba(245,158,11,0.3)', bg: 'rgba(245,158,11,0.08)' },
  hard:   { label: 'HARD', color: '#F43F5E', glow: 'rgba(244,63,94,0.3)',  bg: 'rgba(244,63,94,0.08)'  },
}

export function QuestCard({ quest, onComplete, completing, activeBoostPct = 0 }: QuestCardProps) {
  const boostedXp = activeBoostPct > 0
    ? Math.floor(quest.template.xpReward * (1 + activeBoostPct / 100))
    : quest.template.xpReward
  const diff   = DIFF_CONFIG[quest.template.difficulty] ?? DIFF_CONFIG.easy
  const isDone = quest.status === 'completed'

  return (
    <div
      className="rounded-2xl p-4 transition-all duration-200 relative overflow-hidden"
      style={{
        background: isDone ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
        border:     isDone ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(255,255,255,0.09)',
        boxShadow:  isDone ? 'none' : '0 2px 12px rgba(0,0,0,0.2)',
        opacity:    isDone ? 0.6 : 1,
      }}>

      {/* Difficulty accent */}
      {!isDone && (
        <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
          style={{ background: diff.color, boxShadow: `0 0 8px ${diff.glow}` }} />
      )}

      <div className="flex items-start gap-3 pl-2">
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
            <p className="text-sm font-semibold truncate"
              style={{
                color: isDone ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.92)',
                textDecoration: isDone ? 'line-through' : 'none',
              }}>
              {quest.template.title}
            </p>
            <span className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded shrink-0"
              style={{
                color: diff.color, background: diff.bg,
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
              <span className="flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: 'rgba(6,182,212,0.8)' }}>
                <Zap size={10} fill="currentColor" />
                {quest.template.energyCost}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold"
                style={{ color: 'rgba(168,85,247,0.9)' }}>
                <Star size={10} fill="currentColor" />
                {activeBoostPct > 0 ? (
                  <>
                    <span style={{ color: 'rgba(168,85,247,0.5)', textDecoration: 'line-through', fontSize: 9 }}>
                      +{quest.template.xpReward}
                    </span>
                    <span style={{ color: '#10B981' }}>+{boostedXp} XP</span>
                    <span style={{ fontSize: 9, color: '#10B981', opacity: 0.8 }}>
                      +{activeBoostPct}%
                    </span>
                  </>
                ) : (
                  <>+{quest.template.xpReward.toLocaleString()} XP</>
                )}
              </span>
            </div>

            {isDone ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: '#10B981' }}>
                <CheckCircle2 size={12} /> Done
              </span>
            ) : quest.status === 'available' ? (
              <button
                onClick={() => onComplete(quest.id)}
                disabled={completing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           text-xs font-bold text-white active:scale-95
                           disabled:opacity-50 transition-all"
                style={{
                  background: completing
                    ? 'rgba(124,58,237,0.4)'
                    : 'linear-gradient(135deg, #7C3AED, #A855F7)',
                  boxShadow: '0 2px 12px rgba(124,58,237,0.3)',
                }}>
                {completing
                  ? <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  : '✓ Start'
                }
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
