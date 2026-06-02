// src/components/game/QuestCard.tsx — Redesigned (Aurora OS · mission row)
'use client'
import { Zap, Star, Check, ChevronRight } from 'lucide-react'
import type { DailyQuest, WeeklyQuest } from '@/types/game'

interface QuestCardProps {
  quest:             DailyQuest | WeeklyQuest
  onComplete:        (id: string) => void
  completing:        boolean
  activeBoostPct?:   number   // active ecosystem boost in %
  index?:            number
}

const DIFF_CONFIG = {
  easy:   { label: 'EASY', color: '#34D399', glow: 'rgba(52,211,153,0.5)'  },
  medium: { label: 'MED',  color: '#FBBF24', glow: 'rgba(251,191,36,0.5)'  },
  hard:   { label: 'HARD', color: '#FB7185', glow: 'rgba(251,113,133,0.5)' },
}

export function QuestCard({ quest, onComplete, completing, activeBoostPct = 0, index = 0 }: QuestCardProps) {
  const boostedXp = activeBoostPct > 0
    ? Math.floor(quest.template.xpReward * (1 + activeBoostPct / 100))
    : quest.template.xpReward
  const diff   = DIFF_CONFIG[quest.template.difficulty] ?? DIFF_CONFIG.easy
  const isDone = quest.status === 'completed'

  return (
    <div
      className="relative flex items-stretch gap-3 animate-rise"
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}>

      {/* Timeline rail node */}
      <div className="flex flex-col items-center pt-4 shrink-0" style={{ width: 18 }}>
        <span className="rounded-full transition-all"
          style={{
            width: isDone ? 12 : 10, height: isDone ? 12 : 10,
            background: isDone ? 'var(--emerald)' : diff.color,
            boxShadow: `0 0 10px ${isDone ? 'rgba(52,211,153,0.6)' : diff.glow}`,
          }} />
        <span className="flex-1 w-[2px] mt-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {/* Mission surface */}
      <div className="flex-1 rounded-[20px] p-3.5 mb-1 relative overflow-hidden"
        style={{
          background: isDone ? 'var(--surface-press)' : 'var(--surface-1)',
          boxShadow: isDone ? 'none' : 'inset 0 1px 0 var(--edge-light), var(--shadow-sm)',
          opacity: isDone ? 0.62 : 1,
        }}>

        <div className="flex items-start gap-3">
          {/* Icon tile */}
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
            style={{
              background: isDone ? 'rgba(52,211,153,0.12)' : `${diff.color}1f`,
              boxShadow: isDone ? 'none' : `inset 0 0 0 1px ${diff.color}33`,
            }}>
            {isDone ? <Check size={18} style={{ color: 'var(--emerald)' }} strokeWidth={3} /> : (quest.template.iconKey ?? '⚔️')}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[14px] font-bold truncate"
                style={{
                  color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                  textDecoration: isDone ? 'line-through' : 'none',
                }}>
                {quest.template.title}
              </p>
              <span className="text-[8px] font-extrabold tracking-wider px-1.5 py-0.5 rounded-md shrink-0"
                style={{ color: diff.color, background: `${diff.color}1f`, fontFamily: 'var(--font-display)' }}>
                {diff.label}
              </span>
            </div>

            <p className="text-[11px] leading-snug mb-2.5" style={{ color: 'var(--text-muted)' }}>
              {quest.template.description}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: 'var(--cyan-soft)' }}>
                  <Zap size={11} fill="currentColor" />{quest.template.energyCost}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-extrabold" style={{ color: 'var(--violet-bright)' }}>
                  <Star size={11} fill="currentColor" />
                  {activeBoostPct > 0 ? (
                    <>
                      <span style={{ color: 'var(--text-faint)', textDecoration: 'line-through', fontSize: 9 }}>
                        {quest.template.xpReward}
                      </span>
                      <span style={{ color: 'var(--emerald)' }}>+{boostedXp}</span>
                      <span style={{ fontSize: 9, color: 'var(--emerald)' }}>·+{activeBoostPct}%</span>
                    </>
                  ) : (
                    <>+{quest.template.xpReward.toLocaleString()} XP</>
                  )}
                </span>
              </div>

              {isDone ? (
                <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: 'var(--emerald)' }}>
                  <Check size={13} strokeWidth={3} /> Done
                </span>
              ) : quest.status === 'available' ? (
                <button
                  onClick={() => onComplete(quest.id)}
                  disabled={completing}
                  className="flex items-center gap-1 pl-3.5 pr-2.5 py-1.5 rounded-xl text-xs font-bold text-white press disabled:opacity-50"
                  style={{
                    background: completing ? 'rgba(139,92,246,0.4)' : 'var(--aurora)',
                    boxShadow: '0 4px 14px rgba(124,58,237,0.34), inset 0 1px 0 rgba(255,255,255,0.2)',
                  }}>
                  {completing
                    ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    : <>Start <ChevronRight size={13} strokeWidth={2.6} /></>
                  }
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
