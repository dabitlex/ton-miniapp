// src/app/(game)/profile/page.tsx — Redesigned (Aurora OS · Identity Center)
'use client'
import { useUserStore }    from '@/stores/useUserStore'
import { useEnergy }       from '@/features/hooks'
import { XPBar }           from '@/components/game/XPBar'
import { TelegramAvatar }  from '@/components/layout/GameHeader'
import { WalletConnect }   from '@/components/ton/WalletConnect'
import { ReferralSection } from '@/components/game/ReferralSection'
import { NotificationSettings } from '@/components/game/NotificationSettings'
import { formatNumber }    from '@/lib/utils'
import { Flame, Star, Zap, TrendingUp, Trophy, Calendar } from 'lucide-react'

export default function ProfilePage() {
  const profile = useUserStore(s => s.profile)
  const energy  = useEnergy()

  if (!profile) {
    return (
      <div className="px-5 pt-5 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 shimmer" />
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-y-auto pb-8 relative z-10">

      {/* ── Identity hero ──────────────────────────────────────── */}
      <div className="relative px-5 pt-6 pb-5 animate-rise">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-40 pointer-events-none"
          style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(139,92,246,0.18), transparent 70%)' }} />

        <div className="relative flex flex-col items-center text-center">
          <div className="rounded-3xl p-[3px]" style={{ background: 'var(--aurora)', boxShadow: '0 10px 30px rgba(124,58,237,0.35)' }}>
            <div className="rounded-3xl p-[2px]" style={{ background: 'var(--bg-void)' }}>
              <TelegramAvatar photoUrl={profile.telegramPhotoUrl} firstName={profile.telegramFirstName} size={84} className="rounded-[20px]" />
            </div>
          </div>
          <div className="-mt-3 px-2.5 py-1 rounded-full"
            style={{ background: 'var(--aurora)', boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}>
            <span className="text-[11px] font-extrabold text-white" style={{ fontFamily: 'var(--font-display)' }}>
              LEVEL {profile.level}
            </span>
          </div>

          <h1 className="display text-[20px] text-white leading-tight mt-3">
            {profile.telegramFirstName} {profile.telegramLastName ?? ''}
          </h1>
          {profile.telegramUsername && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>@{profile.telegramUsername}</p>
          )}
        </div>
      </div>

      <div className="px-5 space-y-4">

        {/* ── XP progression ───────────────────────────────────── */}
        <div className="surface p-4 animate-rise" style={{ animationDelay: '60ms' }}>
          <XPBar />
        </div>

        {/* ── Clan ─────────────────────────────────────────────── */}
        {profile.clan && (
          <div className="surface-accent flex items-center gap-3 px-4 py-3 animate-rise" style={{ animationDelay: '90ms' }}>
            <span className="text-lg">🛡️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: '#DDD6FE' }}>{profile.clan.name}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {profile.clan.role === 'leader' ? '👑 Leader' : profile.clan.role === 'officer' ? '⚔️ Officer' : '🎮 Member'}
              </p>
            </div>
            <span className="text-[12px] font-bold" style={{ color: 'var(--violet-bright)', fontFamily: 'var(--font-display)' }}>
              ⭐ {formatNumber((profile.clan as any).seasonXp ?? 0)}
            </span>
          </div>
        )}

        {/* ── Stats grid ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2.5 animate-rise" style={{ animationDelay: '120ms' }}>
          {[
            { icon: <Star size={17} fill="#FBBF24" style={{ color: '#FBBF24' }} />, label: 'Total XP',    value: formatNumber(profile.xpTotal),          tint: '#FBBF24' },
            { icon: <Calendar size={17} style={{ color: '#A78BFA' }} />,            label: 'Season XP',   value: profile.seasonXp.toLocaleString(),       tint: '#A78BFA' },
            { icon: <Flame size={17} fill="#FB923C" style={{ color: '#FB923C' }} />,label: 'Streak',      value: `${profile.streakCurrent}d`,             tint: '#FB923C' },
            { icon: <Trophy size={17} style={{ color: '#FBBF24' }} />,              label: 'Best Streak', value: `${profile.streakLongest}d`,             tint: '#FBBF24' },
            { icon: <Zap size={17} fill={energy.current < 20 ? '#FB7185' : '#5EEAD4'} style={{ color: energy.current < 20 ? '#FB7185' : '#5EEAD4' }} />, label: 'Energy', value: `${energy.current}/100`, tint: energy.current < 20 ? '#FB7185' : '#5EEAD4' },
            { icon: <TrendingUp size={17} style={{ color: '#34D399' }} />,          label: 'Today XP',    value: profile.xpEarnedToday.toLocaleString(),  tint: '#34D399' },
          ].map(({ icon, label, value, tint }) => (
            <div key={label} className="surface flex items-center gap-3 px-3.5 py-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                style={{ background: `${tint}1a`, boxShadow: `inset 0 0 0 1px ${tint}26` }}>
                {icon}
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold tabular-nums leading-tight" style={{ color: tint, fontFamily: 'var(--font-display)' }}>
                  {value}
                </p>
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: 'var(--text-faint)' }}>{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── TON Wallet ───────────────────────────────────────── */}
        <div className="animate-rise" style={{ animationDelay: '150ms' }}>
          <h3 className="eyebrow mb-2.5">TON Wallet</h3>
          <WalletConnect />
        </div>

        {/* ── Referral ─────────────────────────────────────────── */}
        <div className="animate-rise" style={{ animationDelay: '180ms' }}>
          <h3 className="eyebrow mb-2.5">Referral</h3>
          <ReferralSection />
        </div>

        {/* ── Settings ─────────────────────────────────────────── */}
        <div className="animate-rise" style={{ animationDelay: '210ms' }}>
          <h3 className="eyebrow mb-2.5">Settings</h3>
          <NotificationSettings />
        </div>
      </div>
    </div>
  )
}
