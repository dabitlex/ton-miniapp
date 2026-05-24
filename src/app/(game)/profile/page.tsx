// src/app/(game)/profile/page.tsx
'use client'
import { useUserStore }  from '@/stores/useUserStore'
import { useEnergy }     from '@/features/hooks'
import { XPBar }         from '@/components/game/XPBar'
import { LeagueBadge }   from '@/components/game/LeagueBadge'
import { LevelBadge }    from '@/components/game/LevelBadge'
import { SkeletonCard }  from '@/components/ui/Skeleton'
import { formatNumber, xpForLevel } from '@/lib/utils'
import { LEAGUES }       from '@/lib/constants/game'
import { Copy, CheckCircle } from 'lucide-react'
import { useState }      from 'react'

export default function ProfilePage() {
  const profile   = useUserStore(s => s.profile)
  const energy    = useEnergy()
  const [copied, setCopied] = useState(false)

  if (!profile) return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      <SkeletonCard lines={3} />
      <SkeletonCard lines={2} />
    </div>
  )

  const leagueRange = LEAGUES[profile.league]
  const levelsToNext = leagueRange.max - profile.level

  function copyReferral() {
    navigator.clipboard.writeText(
      `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}?start=${profile.referralCode}`
    ).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="px-4 pt-4 pb-6 space-y-4 max-w-lg mx-auto">

      {/* Header */}
      <div className="flex items-center gap-4 py-2">
        {profile.telegramPhotoUrl ? (
          <img src={profile.telegramPhotoUrl} alt=""
            className="w-16 h-16 rounded-2xl ring-2 ring-violet-500/30" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-violet-500/20 flex items-center
                          justify-center text-2xl font-black text-violet-300">
            {profile.telegramFirstName[0]}
          </div>
        )}
        <div>
          <h1 className="text-lg font-black text-white leading-tight">
            {profile.telegramFirstName} {profile.telegramLastName ?? ''}
          </h1>
          {profile.telegramUsername && (
            <p className="text-sm text-white/40">@{profile.telegramUsername}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <LevelBadge level={profile.level} size="md" />
            <LeagueBadge league={profile.league} />
          </div>
        </div>
      </div>

      {/* XP progress */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
        <div className="flex justify-between text-xs text-white/40">
          <span>Level Progress</span>
          <span className="tabular-nums">{profile.xpCurrentLevel.toLocaleString()} / {xpForLevel(profile.level).toLocaleString()} XP</span>
        </div>
        <XPBar />
        <p className="text-xs text-white/30 text-center">
          {profile.level < 30
            ? `${levelsToNext} level${levelsToNext !== 1 ? 's' : ''} to next league`
            : '🏆 Max level reached!'}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Total XP',    value: formatNumber(profile.xpTotal),    icon: '⭐' },
          { label: 'Season XP',   value: formatNumber(profile.seasonXp),   icon: '🗓' },
          { label: 'Streak',      value: `${profile.streakCurrent} days`,  icon: '🔥' },
          { label: 'Best Streak', value: `${profile.streakLongest} days`,  icon: '🏆' },
          { label: 'Energy',      value: `${energy.current}/100`,          icon: '⚡' },
          { label: 'XP Today',    value: formatNumber(profile.xpEarnedToday), icon: '📈' },
        ].map(({ label, value, icon }) => (
          <div key={label}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <div>
              <p className="text-sm font-bold text-white leading-tight tabular-nums">{value}</p>
              <p className="text-[10px] text-white/35">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Referral */}
      {profile.referralEligible && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-2">
          <h3 className="text-sm font-bold text-white">Invite Friends</h3>
          <p className="text-xs text-white/40">Share your referral link to earn bonus XP</p>
          <button
            onClick={copyReferral}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl
                       bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-white/60
                       active:scale-[0.98] transition-transform"
          >
            <span className="truncate">{profile.referralCode}</span>
            {copied
              ? <CheckCircle size={14} className="text-emerald-400 shrink-0" />
              : <Copy size={14} className="text-white/30 shrink-0" />}
          </button>
        </div>
      )}

      {/* Wallet */}
      {profile.wallet ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-semibold text-emerald-300">Wallet Connected</span>
          </div>
          <p className="text-xs font-mono text-white/40 truncate">{profile.wallet.address}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
          <p className="text-sm text-white/40">Connect a TON wallet to claim rewards</p>
        </div>
      )}
    </div>
  )
}