// src/app/(game)/home/page.tsx
'use client'
import { useUserStore }  from '@/stores/useUserStore'
import { useEnergy }     from '@/features/hooks'
import { useQuests }     from '@/features/quests/hooks'   // ← korrekter Import
import { formatNumber }  from '@/lib/utils'
import { LEAGUES, xpForLevel } from '@/lib/constants/game'
import { TelegramAvatar }  from '@/components/layout/GameHeader'
import { XPBar }           from '@/components/game/XPBar'
import { QuestCard }       from '@/components/game/QuestCard'
import { StreakCard }       from '@/components/game/StreakCard'
import { LeagueBadge }     from '@/components/game/LeagueBadge'
import Link from 'next/link'

export default function HomePage() {
  const profile  = useUserStore(s => s.profile)
  const energy   = useEnergy()

  // useQuests ist der korrekte Hook (nicht useDailyQuests)
  const { daily, completingId, completeQuest, isLoadingDaily } = useQuests()

  const completed = daily.filter(q => q.status === 'completed').length
  const total     = daily.length
  const allDone   = total > 0 && completed === total

  return (
    <div className="flex flex-col min-h-full pb-4">

      {/* ── HERO SECTION ─────────────────────────────────────── */}
      <div className="relative px-4 pt-5 pb-6 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(124,58,237,0.08) 0%, transparent 100%)',
        }}>

        {/* Ambient orb */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)',
            filter: 'blur(20px)',
            transform: 'translate(20%, -20%)',
          }} />

        {/* Welcome row */}
        {profile && (
          <div className="flex items-center gap-3 mb-5">
            <TelegramAvatar
              photoUrl={profile.telegramPhotoUrl}
              firstName={profile.telegramFirstName}
              size={44}
              className="shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Willkommen zurück
              </p>
              <h1 className="text-base font-bold text-white leading-tight truncate">
                {profile.telegramFirstName}
              </h1>
            </div>
            <LeagueBadge league={profile.league} />
          </div>
        )}

        {/* Hero Stats Card */}
        <div className="rounded-2xl p-4 mb-4 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(168,85,247,0.06) 100%)',
            border: '1px solid rgba(124,58,237,0.25)',
            boxShadow: '0 8px 32px rgba(124,58,237,0.12)',
          }}>

          <div className="absolute top-0 right-0 w-20 h-20 opacity-30"
            style={{
              background: 'radial-gradient(circle at top right, rgba(168,85,247,0.4), transparent)',
            }} />

          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.2em] mb-1"
                style={{ color: 'rgba(168,85,247,0.6)', fontFamily: 'var(--font-display)' }}>
                SEASON XP
              </p>
              <p className="text-3xl font-black text-white"
                style={{ fontFamily: 'var(--font-display)' }}>
                {profile ? formatNumber(profile.seasonXp) : '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold tracking-[0.2em] mb-1"
                style={{ color: 'rgba(168,85,247,0.6)', fontFamily: 'var(--font-display)' }}>
                LEVEL
              </p>
              <p className="text-3xl font-black"
                style={{
                  fontFamily: 'var(--font-display)',
                  background: 'linear-gradient(135deg, #A855F7, #3B82F6)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                {profile?.level ?? '—'}
              </p>
            </div>
          </div>

          <XPBar />
        </div>

        {/* Micro Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: '🔥', value: `${profile?.streakCurrent ?? 0}d`,     label: 'Streak',   color: '#F59E0B' },
            { icon: '⭐', value: formatNumber(profile?.xpEarnedToday ?? 0), label: 'Heute XP', color: '#A855F7' },
            { icon: '⚡', value: `${energy.current}/100`,               label: 'Energie',  color: energy.current < 20 ? '#F43F5E' : '#06B6D4' },
          ].map(({ icon, value, label, color }) => (
            <div key={label} className="rounded-xl p-3 text-center"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
              <div className="text-lg mb-0.5">{icon}</div>
              <p className="text-sm font-black tabular-nums"
                style={{ color, fontFamily: 'var(--font-display)' }}>
                {value}
              </p>
              <p className="text-[9px] font-medium mt-0.5"
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── STREAK ───────────────────────────────────────────── */}
      <div className="px-4 mb-4">
        <StreakCard />
      </div>

      {/* ── DAILY QUESTS ─────────────────────────────────────── */}
      <div className="px-4 flex-1">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold tracking-wide text-white"
              style={{ fontFamily: 'var(--font-display)' }}>
              TÄGLICHE QUESTS
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {completed}/{total} abgeschlossen
            </p>
          </div>
          <Link href="/quests"
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg"
            style={{
              background: 'rgba(124,58,237,0.1)',
              border: '1px solid rgba(124,58,237,0.2)',
              color: 'rgba(168,85,247,0.8)',
            }}>
            Alle →
          </Link>
        </div>

        {/* Quest progress bar */}
        {total > 0 && (
          <div className="mb-4 h-1 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.round((completed / total) * 100)}%`,
                background: allDone
                  ? 'linear-gradient(90deg, #10B981, #34D399)'
                  : 'linear-gradient(90deg, #7C3AED, #A855F7)',
                boxShadow: allDone
                  ? '0 0 8px rgba(16,185,129,0.6)'
                  : '0 0 8px rgba(168,85,247,0.5)',
              }} />
          </div>
        )}

        {isLoadingDaily ? (
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl shimmer"
                style={{ background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
        ) : allDone ? (
          <div className="rounded-2xl p-6 text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.04))',
              border: '1px solid rgba(16,185,129,0.2)',
            }}>
            <div className="text-4xl mb-2">🎉</div>
            <p className="font-bold text-white text-sm">Alle Quests abgeschlossen!</p>
            <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Neue Quests um Mitternacht UTC
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {daily.slice(0, 4).map((q, i) => (
              <QuestCard
                key={q.id}
                quest={q}
                onComplete={(id) => completeQuest(id, 'daily')}
                completing={completingId === q.id}
                index={i}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
