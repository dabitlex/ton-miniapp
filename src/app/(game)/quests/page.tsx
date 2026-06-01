// src/app/(game)/quests/page.tsx
'use client'
import { useState }    from 'react'
import { useQuests }   from '@/features/quests/hooks'
import { useEnergy }   from '@/features/hooks'
import { QuestCard }   from '@/components/game/QuestCard'

type Tab = 'daily' | 'weekly'

export default function QuestsPage() {
  const [tab, setTab] = useState<Tab>('daily')
  const { daily, weekly, isLoadingDaily, isLoadingWeekly, completeQuest, completingId } = useQuests()
  const energy = useEnergy()

  const quests    = tab === 'daily' ? daily   : weekly
  const isLoading = tab === 'daily' ? isLoadingDaily : isLoadingWeekly
  const doneD     = daily.filter(q => q.status === 'completed').length
  const doneW     = weekly.filter(q => q.status === 'completed').length
  const totalD    = daily.length
  const totalW    = weekly.length

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-4 pb-3"
        style={{ background: 'linear-gradient(180deg, rgba(124,58,237,0.06) 0%, transparent 100%)' }}>
        <h1 className="text-xl font-black text-white mb-0.5"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>
          QUESTS
        </h1>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Complete quests and earn XP
        </p>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="shrink-0 flex px-4 gap-2 pb-3">
        {([
          { key: 'daily'  as Tab, label: 'Daily',  icon: '⚔️', done: doneD, total: totalD },
          { key: 'weekly' as Tab, label: 'Weekly', icon: '📅', done: doneW, total: totalW },
        ]).map(({ key, label, icon, done, total }) => {
          const active   = tab === key
          const allDone  = total > 0 && done === total
          return (
            <button key={key} onClick={() => setTab(key)}
              className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-xl
                         transition-all duration-200 active:scale-95"
              style={{
                background: active
                  ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(168,85,247,0.1))'
                  : 'rgba(255,255,255,0.04)',
                border: active
                  ? '1px solid rgba(124,58,237,0.4)'
                  : '1px solid rgba(255,255,255,0.07)',
                boxShadow: active ? '0 0 20px rgba(124,58,237,0.15)' : 'none',
              }}>
              <div className="flex items-center gap-2">
                <span className="text-base">{icon}</span>
                <span className="text-sm font-bold"
                  style={{
                    color: active ? 'white' : 'rgba(255,255,255,0.5)',
                    fontFamily: 'var(--font-display)', letterSpacing: '0.05em',
                  }}>
                  {label}
                </span>
              </div>
              {total > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-lg"
                  style={{
                    background: allDone ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.08)',
                    color: allDone ? '#10B981' : 'rgba(255,255,255,0.4)',
                    fontFamily: 'var(--font-display)',
                  }}>
                  {done}/{total}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Energy bar ───────────────────────────────────────── */}
      <div className="shrink-0 mx-4 mb-3 px-3 py-2 rounded-xl flex items-center gap-2"
        style={{
          background: energy.isLow ? 'rgba(244,63,94,0.08)' : 'rgba(255,255,255,0.03)',
          border: energy.isLow ? '1px solid rgba(244,63,94,0.2)' : '1px solid rgba(255,255,255,0.05)',
        }}>
        <span className="text-sm">⚡</span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${energy.pct}%`,
              background: energy.isLow
                ? 'linear-gradient(90deg, #F43F5E, #FB7185)'
                : 'linear-gradient(90deg, #7C3AED, #06B6D4)',
            }} />
        </div>
        <span className="text-[11px] font-bold tabular-nums"
          style={{ color: energy.isLow ? '#F43F5E' : 'rgba(168,85,247,0.8)' }}>
          {energy.current}/100
        </span>
        {!energy.isFull && (
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {energy.timeToFull}
          </span>
        )}
      </div>

      {/* ── Quest List ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2.5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl shimmer"
              style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))
        ) : quests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <p className="text-4xl mb-2">📋</p>
            <p className="text-sm font-bold text-white/40">No quests available</p>
          </div>
        ) : (
          quests.map(q => (
            <QuestCard
              key={q.id}
              quest={q}
              onComplete={() => completeQuest(q.id, tab)}
              completing={completingId === q.id}
            />
          ))
        )}
      </div>
    </div>
  )
}
