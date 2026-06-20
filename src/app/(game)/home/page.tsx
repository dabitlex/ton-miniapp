// src/app/(game)/home/page.tsx — Redesigned (Aurora OS · Progression Hub)
'use client'
import { useUserStore }  from '@/stores/useUserStore'
import { useQuests }     from '@/features/quests/hooks'
import { useLeaderboardStore } from '@/stores/useLeaderboardStore'
import { EnergyStrip }   from '@/components/layout/EnergyStrip'
import { formatNumber }  from '@/lib/utils'
import { xpForLevel, GAME_CONSTANTS } from '@/lib/constants/game'
import { StreakCard }    from '@/components/game/StreakCard'
import Link from 'next/link'
import { Flame, Star, Shield, Trophy, Swords, Sparkles } from 'lucide-react'

export default function HomePage() {
  const profile  = useUserStore(s => s.profile)
  const userRank = useLeaderboardStore(s => s.userRank)
  const { daily } = useQuests()

  const completed   = daily.filter(q => q.status === 'completed').length
  const total       = daily.length

  // Level ring progress (mirror XPBar clamp logic)
  const needed   = profile ? xpForLevel(Math.min(profile.level, 29)) : 1
  const levelPct = profile ? Math.min(100, (profile.xpCurrentLevel / needed) * 100) : 0
  const R = 78, C = 2 * Math.PI * R

  // Verbleibende Saison-Tage berechnen
  const seasonDaysLeft = (() => {
    const endsAt = profile?.season?.endsAt
    if (!endsAt) return null
    const diff = new Date(endsAt).getTime() - Date.now()
    if (diff <= 0) return 0
    return Math.ceil(diff / 86400000)
  })()

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
            {seasonDaysLeft !== null
              ? `Season · ${seasonDaysLeft}d left`
              : `Season · ${GAME_CONSTANTS.SEASON_DURATION_DAYS}d`}
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

      {/* ── ENERGY BAR (zwischen Season XP und Chips) ──────────── */}
      <div className="px-1 mt-4 animate-rise" style={{ animationDelay: '100ms' }}>
        <EnergyStrip />
      </div>

      {/* ── FLOATING STATUS CHIPS ──────────────────────────────── */}
      <div className="px-5 mt-4 grid grid-cols-2 gap-2.5 animate-rise" style={{ animationDelay: '120ms' }}>
        <StatChip icon={<Flame size={15} fill="#FBBF24" style={{ color: '#FBBF24' }} />} label="Streak"
          value={`${profile?.streakCurrent ?? 0}d`} tint="#FBBF24" />
        <StatChip icon={<Star size={15} fill="#A78BFA" style={{ color: '#A78BFA' }} />} label="Today XP"
          value={formatNumber(profile?.xpEarnedToday ?? 0)} tint="#A78BFA" />
        <StatChip icon={<Trophy size={15} style={{ color: '#FBBF24' }} />} label="Rank"
          value={userRank ? `#${userRank}` : '—'} tint="#FBBF24" />
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
      <div className="px-5 mt-4 animate-rise space-y-3" style={{ animationDelay: '160ms' }}>
        <StreakCard />
      </div>

      {/* ── QUICK ACTIONS: Missions + Boost ────────────────────── */}
      <div className="px-5 mt-4 grid grid-cols-2 gap-2.5 animate-rise" style={{ animationDelay: '200ms' }}>
        <Link href="/quests" className="press">
          <ActionButton
            icon={<Swords size={18} style={{ color: '#A78BFA' }} />}
            label="Missions"
            sub={total > 0 ? `${completed}/${total} done` : 'View tasks'}
            tint="#A78BFA"
          />
        </Link>
        <Link href="/ecosystem" className="press">
          <ActionButton
            icon={<Sparkles size={18} style={{ color: '#5EEAD4' }} />}
            label="Boost"
            sub="Power up"
            tint="#5EEAD4"
          />
        </Link>
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

function ActionButton({ icon, label, sub, tint }: {
  icon: React.ReactNode; label: string; sub: string; tint: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] px-3.5 py-3"
      style={{ background: 'var(--surface-1)', boxShadow: 'inset 0 1px 0 var(--edge-light), var(--shadow-sm)' }}>
      <div className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
        style={{ background: `${tint}1a`, boxShadow: `inset 0 0 0 1px ${tint}26` }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-extrabold leading-tight truncate"
          style={{ color: '#fff', fontFamily: 'var(--font-display)' }}>
          {label}
        </p>
        <p className="text-[10px] font-semibold mt-0.5 truncate" style={{ color: 'var(--text-faint)' }}>{sub}</p>
      </div>
    </div>
  )
}
