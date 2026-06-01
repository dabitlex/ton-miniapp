// src/app/(game)/profile/page.tsx
'use client'
import { useUserStore }    from '@/stores/useUserStore'
import { useEnergy }       from '@/features/hooks'
import { XPBar }           from '@/components/game/XPBar'
import { LevelBadge }      from '@/components/game/LevelBadge'
import { TelegramAvatar }  from '@/components/layout/GameHeader'
import { WalletConnect }   from '@/components/ton/WalletConnect'
import { ReferralSection } from '@/components/game/ReferralSection'
import { formatNumber }    from '@/lib/utils'
import { Flame, Star, Zap, TrendingUp, Trophy, Calendar } from 'lucide-react'
import { xpForLevel, LEAGUES } from '@/lib/constants/game'

export default function ProfilePage() {
  const profile = useUserStore(s => s.profile)
  const energy  = useEnergy()

  if (!profile) {
    return (
      <div className="px-4 pt-5 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl shimmer"
            style={{ background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    )
  }


  return (
    <div className="overflow-y-auto pb-8">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="relative px-4 pt-5 pb-6 overflow-hidden"
        style={{ background: 'linear-gradient(180deg, rgba(124,58,237,0.08) 0%, transparent 100%)' }}>

        <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at top right, rgba(168,85,247,0.1), transparent)',
            filter: 'blur(20px)',
          }} />

        <div className="flex items-center gap-4 relative z-10">
          <div className="relative">
            <TelegramAvatar
              photoUrl={profile.telegramPhotoUrl}
              firstName={profile.telegramFirstName}
              size={68}
              className="rounded-2xl"
            />
            {/* Level badge overlay */}
            <div className="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 rounded-lg text-[10px] font-black"
              style={{
                background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
                fontFamily: 'var(--font-display)', color: 'white',
                boxShadow: '0 2px 8px rgba(124,58,237,0.5)',
              }}>
              {profile.level}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black text-white leading-tight truncate">
              {profile.telegramFirstName} {profile.telegramLastName ?? ''}
            </h1>
            {profile.telegramUsername && (
              <p className="text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                @{profile.telegramUsername}
              </p>
            )}
            <LeagueBadge league={profile.league} />
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4">

        {/* ── XP Progress ──────────────────────────────────────── */}
        <div className="rounded-2xl p-4"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}>
          <XPBar />

        </div>

        {/* ── Clan Badge ───────────────────────────────────────── */}
        {profile.clan && (
          <div className="rounded-xl px-3 py-2.5 flex items-center gap-2"
            style={{
              background: 'rgba(124,58,237,0.08)',
              border: '1px solid rgba(124,58,237,0.2)',
            }}>
            <span className="text-base">🛡️</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: 'rgba(216,180,254,0.9)' }}>
                {profile.clan.name}
              </p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {profile.clan.role === 'leader' ? '👑 Leader'
                  : profile.clan.role === 'officer' ? '⚔️ Officer'
                  : '🎮 Member'}
              </p>
            </div>
            <span className="text-[11px] font-bold" style={{ color: 'rgba(168,85,247,0.6)', fontFamily: 'var(--font-display)' }}>
              ⭐ {formatNumber((profile.clan as any).seasonXp ?? 0)}
            </span>
          </div>
        )}

        {/* ── Stats Grid ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: <Star size={18} fill='#F59E0B' style={{ color: '#F59E0B' }} />, label: 'TOTAL XP',  value: formatNumber(profile.xpTotal),      color: '#F59E0B' },
            { icon: <Calendar size={18} style={{ color: '#A855F7' }} />, label: 'SEASON XP',  value: profile.seasonXp.toLocaleString(),      color: '#A855F7' },
            { icon: <Flame size={18} fill='#F97316' style={{ color: '#F97316' }} />, label: 'STREAK',     value: `${profile.streakCurrent}d`,         color: '#F97316' },
            { icon: <Trophy size={18} style={{ color: '#F59E0B' }} />, label: 'BEST STREAK',value: `${profile.streakLongest}d`,         color: '#F59E0B' },
            { icon: <Zap size={18} fill={energy.current < 20 ? '#F43F5E' : '#06B6D4'} style={{ color: energy.current < 20 ? '#F43F5E' : '#06B6D4' }} />, label: 'ENERGY',    value: `${energy.current}/100`,             color: energy.current < 20 ? '#F43F5E' : '#06B6D4' },
            { icon: <TrendingUp size={18} style={{ color: '#10B981' }} />, label: 'TODAY XP',   value: profile.xpEarnedToday.toLocaleString(), color: '#10B981' },
          ].map(({ icon, label, value, color }) => (
            <div key={label} className="rounded-xl p-3 flex items-center gap-2.5"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
              <div className="flex items-center justify-center w-6">{icon}</div>
              <div className="min-w-0">
                <p className="text-sm font-black tabular-nums leading-tight"
                  style={{ color, fontFamily: 'var(--font-display)' }}>
                  {value}
                </p>
                <p className="text-[9px] font-bold truncate mt-0.5"
                  style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>
                  {label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── TON Wallet ───────────────────────────────────────── */}
        <div>
          <h3 className="text-[11px] font-black tracking-widest mb-2"
            style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-display)' }}>
            TON WALLET
          </h3>
          <WalletConnect />
        </div>

        {/* ── Referral ─────────────────────────────────────────── */}
        <div>
          <h3 className="text-[11px] font-black tracking-widest mb-2"
            style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-display)' }}>
            REFERRAL
          </h3>
          <ReferralSection />
        </div>
      </div>
    </div>
  )
}
