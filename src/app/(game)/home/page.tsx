// src/app/(game)/home/page.tsx — Redesigned (Aurora OS · Progression Hub)
'use client'
import { useUserStore }  from '@/stores/useUserStore'
import { useEnergy }     from '@/features/hooks'
import { useQuests }     from '@/features/quests/hooks'
import { formatNumber }  from '@/lib/utils'
import { xpForLevel, GAME_CONSTANTS } from '@/lib/constants/game'
import { QuestCard }     from '@/components/game/QuestCard'
import { StreakCard }    from '@/components/game/StreakCard'
import Link from 'next/link'
import { Flame, Zap, Star, Shield, ArrowRight } from 'lucide-react'

export default function HomePage() {
  const profile  = useUserStore(s => s.profile)
  const energy   = useEnergy()
  const { daily, completingId, completeQuest, isLoadingDaily } = useQuests()

  const completed   = daily.filter(q => q.status === 'completed').length
  const total       = daily.length
  const allDone     = total > 0 && completed === total
  const activeBoost = profile?.ecosystemBoost ?? 0

  // Level ring progress (mirror XPBar clamp logic)
  const needed   = profile ? xpForLevel(Math.min(profile.level, 29)) : 1
  const levelPct = profile ? Math.min(100, (profile.xpCurrentLevel / needed) * 100) : 0
  const R = 78, C = 2 * Math.PI * R

  return (
    <div className="flex flex-col min-h-full pb-6 relative z-10">

      {/* ── TOP: greeting + season ─────────────────────────────── */}
      {profile && (
        <div className="flex items-center justify-between px-5 pt-4 animate-rise">
          <div>
            <p className="text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>Welcome back</p>
            <h1 className="display text-[19px] text-white leading-tight">{profile.telegramFirstName}</h1>
          </div>
          <div className="chip" style={{ color: 'var(--text-secondary)' }}>
            <span className="w-1.5 h-1.5 rounded-full pulse-glow" style={{ background: 'var(--cyan-soft)' }} />
            Season · {GAME_CONSTANTS.SEASON_DURATION_DAYS}d
          </div>
        </div>
      )}

      {/* ── PROGRESSION HUB ────────────────────────────────────── */}
      <div className="relative flex flex-col items-center pt-6 pb-2 animate-rise" style={{ animationDelay: '60ms' }}>
        {/* ambient halo */}
        <div className="absolute top-2 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.22), transparent 68%)', filter: 'blur(8px)' }} />

        <div className="relative" style={{ width: 200, height: 200 }}>
          <svg width="200" height="200" viewBox="0 0 200 200" className="ring-spin" style={{ position: 'absolute', inset: 0, opacity: 0.18 }}>
            <defs>
              <linearGradient id="hubGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="55%" stopColor="#5B8DEF" />
                <stop offset="100%" stopColor="#5EEAD4" />
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r={R} fill="none" stroke="url(#hubGrad)" strokeWidth="2" strokeDasharray="3 9" strokeLinecap="round" />
          </svg>

          <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
            <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
            <circle cx="100" cy="100" r={R} fill="none" stroke="url(#hubGrad)" strokeWidth="9" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C - (levelPct / 100) * C}
              style={{ transition: 'stroke-dashoffset 1.1s var(--ease-out)', filter: 'drop-shadow(0 0 8px rgba(139,92,246,0.6))' }} />
          </svg>

          {/* center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="eyebrow" style={{ color: 'var(--violet-bright)' }}>Level</span>
            <span className="display-xl text-[58px] leading-none gradient-text">{profile?.level ?? '—'}</span>
            <span className="text-[11px] font-semibold tabular-nums mt-1" style={{ color: 'var(--text-muted)' }}>
              {Math.round(levelPct)}% to {(profile?.level ?? 0) + 1}
            </span>
          </div>
        </div>

        {/* Season XP headline */}
        <div className="text-center mt-3">
          <p className="display-xl text-[30px] text-white leading-none tabular-nums">
            {profile ? profile.seasonXp.toLocaleString() : '—'}
          </p>
          <p className="eyebrow mt-1.5">Season XP</p>
        </div>
      </div>

      {/* ── FLOATING STATUS CHIPS ──────────────────────────────── */}
      <div className="px-5 mt-4 grid grid-cols-2 gap-2.5 animate-rise" style={{ animationDelay: '120ms' }}>
        <StatChip icon={<Flame size={15} fill="#FBBF24" style={{ color: '#FBBF24' }} />} label="Streak"
          value={`${profile?.streakCurrent ?? 0}d`} tint="#FBBF24" />
        <StatChip icon={<Star size={15} fill="#A78BFA" style={{ color: '#A78BFA' }} />} label="Today XP"
          value={formatNumber(profile?.xpEarnedToday ?? 0)} tint="#A78BFA" />
        <StatChip icon={<Zap size={15} fill={energy.current < 20 ? '#FB7185' : '#5EEAD4'} style={{ color: energy.current < 20 ? '#FB7185' : '#5EEAD4' }} />} label="Energy"
          value={`${energy.current}/100`} tint={energy.current < 20 ? '#FB7185' : '#5EEAD4'} />
        {profile?.clan ? (
          <Link href="/clans" className="press">
            <StatChip icon={<Shield size={15} style={{ color: '#5B8DEF' }} />} label="Clan"
              value={profile.clan.name} tint="#5B8DEF" truncate />
          </Link>
        ) : (
          <Link href="/clans" className="press">
            <StatChip icon={<Shield size={15} style={{ color: 'rgba(255,255,255,0.4)' }} />} label="Clan"
              value="Join one" tint="rgba(255,255,255,0.5)" truncate />
          </Link>
        )}
      </div>

      {/* ── STREAK ─────────────────────────────────────────────── */}
      <div className="px-5 mt-4 animate-rise" style={{ animationDelay: '160ms' }}>
        <StreakCard />
      </div>

      {/* ── DAILY MISSION FEED ─────────────────────────────────── */}
      <div className="px-5 mt-5 flex-1 animate-rise" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="display text-[15px] text-white">Today's Missions</h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {completed} of {total} complete
            </p>
          </div>
          <Link href="/quests" className="chip press" style={{ color: 'var(--violet-bright)' }}>
            All <ArrowRight size={12} />
          </Link>
        </div>

        {/* segmented progress */}
        {total > 0 && (
          <div className="flex gap-1 mb-4">
            {daily.map((q, i) => (
              <div key={q.id} className="flex-1 h-1.5 rounded-full transition-all duration-500"
                style={{
                  background: q.status === 'completed'
                    ? (allDone ? 'linear-gradient(90deg,#10B981,#5EEAD4)' : 'var(--aurora)')
                    : 'rgba(255,255,255,0.07)',
                  boxShadow: q.status === 'completed' ? '0 0 8px rgba(139,92,246,0.5)' : 'none',
                  animationDelay: `${i * 60}ms`,
                }} />
            ))}
          </div>
        )}

        {isLoadingDaily ? (
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[88px] shimmer ml-[30px]" />
            ))}
          </div>
        ) : allDone ? (
          <div className="surface-accent p-6 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <p className="display text-[15px] text-white">All missions complete</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Fresh missions arrive at midnight UTC
            </p>
          </div>
        ) : (
          <div>
            {daily.slice(0, 4).map((q, i) => (
              <QuestCard
                key={q.id}
                quest={q}
                onComplete={(id) => completeQuest(id, 'daily')}
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

function StatChip({ icon, label, value, tint, truncate }: {
  icon: React.ReactNode; label: string; value: string; tint: string; truncate?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] px-3.5 py-3"
      style={{ background: 'var(--surface-1)', boxShadow: 'inset 0 1px 0 var(--edge-light), var(--shadow-sm)' }}>
      <div className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
        style={{ background: `${tint}1a`, boxShadow: `inset 0 0 0 1px ${tint}26` }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={`text-[14px] font-extrabold leading-tight ${truncate ? 'truncate' : 'tabular-nums'}`}
          style={{ color: tint, fontFamily: 'var(--font-display)' }}>
          {value}
        </p>
        <p className="text-[10px] font-semibold mt-0.5" style={{ color: 'var(--text-faint)' }}>{label}</p>
      </div>
    </div>
  )
}
