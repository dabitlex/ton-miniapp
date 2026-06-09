// src/app/(game)/quests/page.tsx — Redesigned (Aurora OS · Mission Interface)
'use client'
import { useState }     from 'react'
import { useQuests }    from '@/features/quests/hooks'
import { useAds }       from '@/features/ads/hooks'
import { useUserStore } from '@/stores/useUserStore'
import { useEnergy }    from '@/features/hooks'
import { QuestCard }    from '@/components/game/QuestCard'
import type { DailyQuest } from '@/types/game'
import { Swords, CalendarDays, ClipboardList, Zap } from 'lucide-react'

type Tab = 'daily' | 'weekly'

export default function QuestsPage() {
  const [tab, setTab] = useState<Tab>('daily')
  const { daily, weekly, isLoadingDaily, isLoadingWeekly, completeQuest, completingId } = useQuests()
  const energy      = useEnergy()
  const ads         = useAds()
  const profile     = useUserStore(s => s.profile)
  const activeBoost = profile?.ecosystemBoost ?? 0

  // Synthetische "Watch Ads"-Tageskarte (kein DB-Quest; gespeist aus /ads/status).
  // Jede Ad gibt +50 XP server-seitig; bei 5/5 zeigt die Karte "Done".
  const watchAdsDone = ads.watchedToday >= ads.dailyLimit
  const watchAdsQuest: DailyQuest = {
    id:          'watch-ads-daily',
    templateId:  'watch-ads-daily',
    questDate:   '',
    status:      watchAdsDone ? 'completed' : 'available',
    expiresAt:   '',
    xpGranted:   null,
    energySpent: null,
    template: {
      id:           'watch-ads-daily',
      internalCode: 'daily_watch_ads',
      title:        'Watch Ads',
      description:  'Watch a short ad to earn XP and support the pool.',
      difficulty:   'medium',
      questType:    'daily',
      energyCost:   0,
      xpReward:     ads.xpPerAd,
      tokenReward:  0,
      iconKey:      '📺',
      sortOrder:    -1,
    },
    progress: {
      current: ads.watchedToday,
      target:  ads.dailyLimit,
      type:    'countable',
      isMet:   watchAdsDone,
    },
  }

  const quests    = tab === 'daily' ? daily   : weekly
  const isLoading = tab === 'daily' ? isLoadingDaily : isLoadingWeekly
  const doneD     = daily.filter(q => q.status === 'completed').length + (watchAdsDone ? 1 : 0)
  const doneW     = weekly.filter(q => q.status === 'completed').length
  const totalD    = daily.length + 1   // + synthetische "Watch Ads"-Karte
  const totalW    = weekly.length
  const done      = tab === 'daily' ? doneD : doneW
  const total     = tab === 'daily' ? totalD : totalW
  const pct       = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="flex flex-col h-full relative z-10">

      {/* ── Header with progress ───────────────────────────────── */}
      <div className="shrink-0 px-5 pt-4 pb-3 animate-rise">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="display-xl text-[24px] text-white leading-none">Missions</h1>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>Complete to earn XP</p>
          </div>
          <div className="text-right">
            <span className="display-xl text-[22px] gradient-text tabular-nums">{pct}%</span>
            <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{done}/{total} done</p>
          </div>
        </div>
        <div className="progress-bar mt-3">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* ── Segmented tabs ─────────────────────────────────────── */}
      <div className="shrink-0 px-5 pb-3 animate-rise" style={{ animationDelay: '60ms' }}>
        <div className="flex p-1 rounded-2xl gap-1" style={{ background: 'var(--surface-press)' }}>
          {([
            { key: 'daily'  as Tab, label: 'Daily',  icon: Swords,       done: doneD, total: totalD },
            { key: 'weekly' as Tab, label: 'Weekly', icon: CalendarDays, done: doneW, total: totalW },
          ]).map(({ key, label, icon: Icon, done, total }) => {
            const active  = tab === key
            const allDone = total > 0 && done === total
            return (
              <button key={key} onClick={() => setTab(key)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all press"
                style={{
                  background: active ? 'var(--surface-2)' : 'transparent',
                  boxShadow: active ? 'inset 0 1px 0 var(--edge-light), var(--shadow-sm)' : 'none',
                }}>
                <Icon size={15} style={{ color: active ? 'var(--violet-bright)' : 'var(--text-faint)' }} />
                <span className="text-sm font-bold" style={{ color: active ? 'white' : 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                  {label}
                </span>
                {total > 0 && (
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-lg"
                    style={{
                      background: allDone ? 'rgba(52,211,153,0.16)' : 'rgba(255,255,255,0.07)',
                      color: allDone ? 'var(--emerald)' : 'var(--text-muted)',
                    }}>
                    {done}/{total}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Energy meter ───────────────────────────────────────── */}
      <div className="shrink-0 mx-5 mb-3 px-3.5 py-2.5 rounded-2xl flex items-center gap-2.5 animate-rise"
        style={{
          animationDelay: '90ms',
          background: energy.isLow ? 'rgba(244,63,94,0.10)' : 'var(--surface-1)',
          boxShadow: energy.isLow ? 'inset 0 0 0 1px rgba(244,63,94,0.25)' : 'inset 0 1px 0 var(--edge-light)',
        }}>
        <Zap size={14} fill={energy.isLow ? '#FB7185' : '#A78BFA'} style={{ color: energy.isLow ? '#FB7185' : '#A78BFA' }} />
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${energy.pct}%`, background: energy.isLow ? 'linear-gradient(90deg,#F43F5E,#FB7185)' : 'var(--aurora)' }} />
        </div>
        <span className="text-[11px] font-bold tabular-nums" style={{ color: energy.isLow ? '#FB7185' : 'var(--violet-bright)' }}>
          {energy.current}/100
        </span>
        {!energy.isFull && <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{energy.timeToFull}</span>}
      </div>

      {/* ── Mission timeline ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {tab === 'daily' && (
          <QuestCard
            quest={watchAdsQuest}
            onComplete={() => {}}
            completing={false}
            activeBoostPct={activeBoost}
            index={0}
            watchMode
            watching={ads.watching}
            onWatch={ads.watchAd}
          />
        )}
        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[92px] shimmer ml-[30px]" />
            ))}
          </div>
        ) : quests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-44 text-center">
            <ClipboardList size={42} className="mb-3" style={{ color: 'var(--text-ultra)' }} />
            <p className="display text-sm" style={{ color: 'var(--text-muted)' }}>No missions available</p>
          </div>
        ) : (
          <div>
            {quests.map((q, i) => (
              <QuestCard
                key={q.id}
                quest={q}
                onComplete={() => completeQuest(q.id, tab)}
                completing={completingId === q.id}
                activeBoostPct={activeBoost}
                index={i}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
