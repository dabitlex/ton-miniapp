// src/app/(game)/quests/page.tsx — VEXALGO 2.0
'use client'
import { useState }     from 'react'
import { useQuests }    from '@/features/quests/hooks'
import { useAds }       from '@/features/ads/hooks'
import { useUserStore } from '@/stores/useUserStore'
import { useEnergy }    from '@/features/hooks'
import { QuestCard }    from '@/components/game/QuestCard'
import { OnboardingQuests } from '@/components/game/OnboardingQuests'
import { Icon }         from '@/components/ui/Icon'
import { useI18n }      from '@/lib/i18n'
import { GAME_CONSTANTS } from '@/lib/constants/game'
import type { DailyQuest } from '@/types/game'

type Tab = 'daily' | 'weekly'
const fd: React.CSSProperties = { fontFamily: 'var(--font-display)' }

export default function QuestsPage() {
  const [tab, setTab] = useState<Tab>('daily')
  const { daily, weekly, isLoadingDaily, isLoadingWeekly, completeQuest, completingId } = useQuests()
  const energy      = useEnergy()
  const ads         = useAds()
  const profile     = useUserStore(s => s.profile)
  const activeBoost = profile?.ecosystemBoost ?? 0
  const { t, lang }  = useI18n()

  // Synthetische "Watch Ads"-Tageskarte (kein DB-Quest; gespeist aus /ads/status).
  const watchAdsDone = ads.watchedToday >= ads.dailyLimit
  const watchAdsQuest: DailyQuest = {
    id: 'watch-ads-daily', templateId: 'watch-ads-daily', questDate: '',
    status: watchAdsDone ? 'completed' : 'available',
    expiresAt: '', xpGranted: null, energySpent: null,
    template: {
      id: 'watch-ads-daily', internalCode: 'daily_watch_ads',
      title: t('quests.watchAds'),
      description: t('quests.watchAdsDesc'),
      difficulty: 'medium', questType: 'daily', energyCost: 0,
      xpReward: ads.xpPerAd, tokenReward: 0, iconKey: '📺', sortOrder: -1,
    },
    progress: { current: ads.watchedToday, target: ads.dailyLimit, type: 'countable', isMet: watchAdsDone },
  }

  const quests    = tab === 'daily' ? daily : weekly
  const isLoading = tab === 'daily' ? isLoadingDaily : isLoadingWeekly

  const adsReady      = !ads.isLoading
  const watchAdsDone2 = adsReady && watchAdsDone
  const doneD  = daily.filter(q => q.status === 'completed').length + (watchAdsDone2 ? 1 : 0)
  const doneW  = weekly.filter(q => q.status === 'completed').length
  const totalD = daily.length + (adsReady ? 1 : 0)
  const totalW = weekly.length
  const done   = tab === 'daily' ? doneD : doneW
  const total  = tab === 'daily' ? totalD : totalW
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0

  const R = 22, C = 2 * Math.PI * R
  const energyPct = Math.min(100, (energy.current / GAME_CONSTANTS.MAX_ENERGY) * 100)

  // Zeit bis zum naechsten UTC-Mitternacht (Quest-Reset)
  const resetIn = (() => {
    const now = new Date()
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
    const diff = next.getTime() - now.getTime()
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return lang === 'de' ? `${h} Std ${m} Min` : `${h}h ${m}m`
  })()

  return (
    <div className="flex flex-col h-full relative z-10">

      {/* ── Kopfzeile ─────────────────────────────────────────── */}
      <div className="shrink-0 animate-rise" style={{ padding: '24px 20px 0' }}>
        <div className="flex items-start justify-between" style={{ marginBottom: 18 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ ...fd, fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em' }}>{t('quests.title')}</h1>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {tab === 'daily' ? t('quests.resetIn', { time: resetIn }) : t('quests.weeklyEnds')}
            </p>
          </div>

          <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
            <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="26" cy="26" r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="4" />
              <defs>
                <linearGradient id="qRing" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#7BA5FF" /><stop offset="1" stopColor="#2563FF" />
                </linearGradient>
              </defs>
              <circle cx="26" cy="26" r={R} fill="none" stroke="url(#qRing)" strokeWidth="4"
                strokeLinecap="round" strokeDasharray={`${(pct / 100) * C} ${C}`} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ ...fd, fontSize: 13, fontWeight: 500, color: 'var(--blue-2)' }}>{pct}%</span>
            </div>
          </div>
        </div>

        {/* Umschalter */}
        <div style={{ display: 'flex', gap: 6, padding: 5, borderRadius: 18,
          background: 'linear-gradient(150deg,rgba(255,255,255,.10),rgba(255,255,255,.03))',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.16), inset 0 0 0 .5px rgba(255,255,255,.06)' }}>
          {([['daily', t('quests.daily'), doneD, totalD], ['weekly', t('quests.weekly'), doneW, totalW]] as const)
            .map(([key, label, d, t]) => (
              <button key={key} onClick={() => setTab(key as Tab)}
                style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 13,
                  border: 'none', fontFamily: 'var(--font-display)', fontSize: 12.5,
                  fontWeight: tab === key ? 500 : 400,
                  color: tab === key ? '#fff' : 'var(--text-secondary)',
                  background: tab === key
                    ? 'linear-gradient(135deg,#5B8DFF,#1D4ED8)' : 'transparent',
                  boxShadow: tab === key ? '0 6px 16px rgba(37,99,255,.4)' : 'none' }}>
                {label} · {d}/{t}
              </button>
            ))}
        </div>

        {/* Energie */}
        <div className="surface-2" style={{ display: 'flex', alignItems: 'center', gap: 12,
          padding: '13px 16px', borderRadius: 18, margin: '13px 0 14px' }}>
          <Icon name="bolt" size={16} strokeWidth={1.6} style={{ color: 'var(--blue-2)' }} />
          <div className="progress-bar" style={{ flex: 1, height: 5 }}>
            <div className="progress-fill" style={{ width: `${energyPct}%` }} />
          </div>
          <p style={{ ...fd, fontSize: 13, whiteSpace: 'nowrap' }}>
            {energy.current}<span style={{ color: 'var(--text-muted)' }}>/{GAME_CONSTANTS.MAX_ENERGY}</span>
          </p>
        </div>
      </div>

      {/* ── Liste ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '0 20px 24px' }}>
        <OnboardingQuests />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tab === 'daily' && (
            ads.isLoading ? (
              <div className="surface-2" style={{ height: 74, borderRadius: 20 }} />
            ) : (
              <QuestCard
                quest={watchAdsQuest}
                onComplete={() => {}}
                completing={false}
                activeBoostPct={activeBoost}
                watchMode
                watching={ads.watching}
                onWatch={ads.watchAd}
                watchDisabled={watchAdsDone}
              />
            )
          )}

          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="surface-2" style={{ height: 74, borderRadius: 20, opacity: 0.5 }} />
            ))
          ) : quests.length === 0 ? (
            <div className="surface-2" style={{ padding: 28, borderRadius: 20, textAlign: 'center' }}>
              <Icon name="quest" size={26} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <p style={{ ...fd, fontSize: 14, fontWeight: 500 }}>{t('quests.empty')}</p>
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5 }}>
                {tab === 'daily' ? t('quests.emptyDaily') : t('quests.emptyWeekly')}
              </p>
            </div>
          ) : (
            quests.map((q, i) => (
              <QuestCard
                key={q.id}
                quest={q}
                onComplete={(id, type) => completeQuest(id, type)}
                completing={completingId === q.id}
                activeBoostPct={activeBoost}
                index={i}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
