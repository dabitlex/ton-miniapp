// src/app/(game)/quests/page.tsx
'use client'
import { useState }      from 'react'
import { useQuests }     from '@/features/quests/hooks'
import { useEnergy }     from '@/features/hooks'
import { QuestCard }     from '@/components/game/QuestCard'
import { SkeletonCard }  from '@/components/ui/Skeleton'
import { cn }            from '@/lib/utils'

type Tab = 'daily' | 'weekly'

export default function QuestsPage() {
  const [tab, setTab]   = useState<Tab>('daily')
  const { daily, weekly, isLoadingDaily, isLoadingWeekly, completeQuest, completingId } = useQuests()
  const energy          = useEnergy()

  const quests    = tab === 'daily' ? daily : weekly
  const isLoading = tab === 'daily' ? isLoadingDaily : isLoadingWeekly

  const doneDaily   = daily.filter(q => q.status === 'completed').length
  const doneWeekly  = weekly.filter(q => q.status === 'completed').length

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-white/[0.06] bg-[#0c0c0f] px-4 shrink-0">
        {([
          { key: 'daily'  as const, label: 'Daily',  done: doneDaily,  total: daily.length },
          { key: 'weekly' as const, label: 'Weekly', done: doneWeekly, total: weekly.length },
        ] as const).map(({ key, label, done, total }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 py-3 text-sm font-semibold transition-colors relative',
              tab === key ? 'text-violet-300' : 'text-white/35'
            )}
          >
            {label}
            {total > 0 && (
              <span className={cn(
                'ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                done === total
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-white/[0.08] text-white/40'
              )}>
                {done}/{total}
              </span>
            )}
            {tab === key && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-violet-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Quest list */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6 space-y-2.5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} lines={1} />)
        ) : quests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm text-white/40">No quests available</p>
          </div>
        ) : (
          quests.map(quest => (
            <QuestCard
              key={quest.id}
              quest={quest}
              userEnergy={energy.current}
              isCompleting={completingId === quest.id}
              onComplete={() => completeQuest(quest.id, tab)}
            />
          ))
        )}
      </div>

      {/* Energy warning footer */}
      {energy.isEmpty && (
        <div className="shrink-0 mx-4 mb-4 rounded-2xl border border-amber-500/20
                        bg-amber-500/[0.06] px-4 py-3 text-center">
          <p className="text-xs text-amber-300 font-medium">
            ⚡ Out of energy — regens 1 every 15 min
          </p>
          {energy.nextRegenAt && (
            <p className="text-[10px] text-white/30 mt-0.5">
              Next: {energy.timeToFull}
            </p>
          )}
        </div>
      )}
    </div>
  )
}