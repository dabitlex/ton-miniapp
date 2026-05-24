// src/components/game/QuestCard.tsx
'use client'
import { memo }      from 'react'
import { Button }    from '@/components/ui/Button'
import { cn }        from '@/lib/utils'
import { Zap, Star, CheckCircle2, Clock } from 'lucide-react'
import type { DailyQuest, WeeklyQuest } from '@/types/game'

const DIFF = {
  easy:   { label: 'Easy',   cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  medium: { label: 'Medium', cls: 'bg-amber-500/15   text-amber-400   border-amber-500/20'   },
  hard:   { label: 'Hard',   cls: 'bg-rose-500/15    text-rose-400    border-rose-500/20'     },
}

interface Props {
  quest:        DailyQuest | WeeklyQuest
  userEnergy:   number
  onComplete:   () => void
  isCompleting: boolean
}

export const QuestCard = memo(function QuestCard({ quest, userEnergy, onComplete, isCompleting }: Props) {
  const diff    = DIFF[quest.template.difficulty]
  const isDone  = quest.status === 'completed'
  const isExp   = quest.status === 'expired'
  const canDo   = !isDone && !isExp && userEnergy >= quest.template.energyCost

  return (
    <div className={cn(
      'rounded-2xl border p-4 transition-all duration-200',
      isDone  ? 'border-emerald-500/15 bg-emerald-500/[0.03] opacity-60'
      : isExp ? 'border-white/[0.04]   bg-white/[0.01]       opacity-50'
      :          'border-white/[0.08]   bg-white/[0.02]'
    )}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg',
          isDone ? 'bg-emerald-500/15' : 'bg-white/[0.05]'
        )}>
          {isDone ? '✓' : quest.template.iconKey ?? '📋'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-white/90 leading-tight">{quest.template.title}</p>
            <span className={cn('shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md border', diff.cls)}>
              {diff.label}
            </span>
          </div>
          <p className="text-xs text-white/35 mt-0.5 line-clamp-2 leading-relaxed">
            {quest.template.description}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.05]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-white/35">
            <Zap size={10} className="text-yellow-400" fill="currentColor" />
            {quest.template.energyCost}
          </span>
          <span className="flex items-center gap-1 text-xs text-white/35">
            <Star size={10} className="text-violet-400" fill="currentColor" />
            +{quest.template.xpReward}
          </span>
        </div>

        {isDone ? (
          <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
            <CheckCircle2 size={12} /> Done
          </span>
        ) : isExp ? (
          <span className="flex items-center gap-1 text-xs text-white/20">
            <Clock size={11} /> Expired
          </span>
        ) : (
          <Button
            size="sm"
            variant={canDo ? 'primary' : 'secondary'}
            disabled={!canDo}
            loading={isCompleting}
            onClick={onComplete}
            className="h-7 text-[11px] px-3 font-semibold"
          >
            {isCompleting ? 'Claiming…'
              : !canDo ? `Need ${quest.template.energyCost - userEnergy}⚡`
              : 'Complete'}
          </Button>
        )}
      </div>
    </div>
  )
})