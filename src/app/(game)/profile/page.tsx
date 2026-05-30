// src/app/(game)/profile/page.tsx
'use client'
import { useUserStore }      from '@/stores/useUserStore'
import { useEnergy }         from '@/features/hooks'
import { XPBar }             from '@/components/game/XPBar'
import { LeagueBadge }       from '@/components/game/LeagueBadge'
import { LevelBadge }        from '@/components/game/LevelBadge'
import { SkeletonCard }      from '@/components/ui/Skeleton'
import { TelegramAvatar }    from '@/components/layout/GameHeader'
import { WalletConnect }     from '@/components/ton/WalletConnect'
import { ReferralSection }   from '@/components/game/ReferralSection'
import { formatNumber }      from '@/lib/utils'
import { xpForLevel, LEAGUES } from '@/lib/constants/game'

export default function ProfilePage() {
  const profile = useUserStore(s => s.profile)
  const energy  = useEnergy()

  if (!profile) return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      <SkeletonCard lines={3} />
      <SkeletonCard lines={2} />
    </div>
  )

  const leagueRange  = LEAGUES[profile.league]
  const levelsToNext = leagueRange.max - profile.level
  const xpNeeded     = xpForLevel(Math.min(profile.level, 29))

  return (
    <div className="px-4 pt-4 pb-6 space-y-4 max-w-lg mx-auto">

      {/* Header */}
      <div className="flex items-center gap-4 py-2">
        <TelegramAvatar
          photoUrl={profile.telegramPhotoUrl}
          firstName={profile.telegramFirstName}
          size={64}
          className="ring-2 ring-violet-500/30 rounded-2xl"
        />
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

      {/* Clan Badge */}
      {profile.clan && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.05]
                        px-3 py-2 flex items-center gap-2">
          <span className="text-base">🛡️</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-violet-300 truncate">{profile.clan.name}</p>
            <p className="text-[10px] text-white/30">
              {profile.clan.role === 'leader'  ? '👑 Leader'
               : profile.clan.role === 'officer' ? '⚔️ Officer'
               : '🎮 Mitglied'}
            </p>
          </div>
          <span className="text-xs text-white/30">⭐ {formatNumber((profile.clan as any).seasonXp ?? 0)}</span>
        </div>
      )}

      {/* XP */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
        <div className="flex justify-between text-xs text-white/40">
          <span>Level Fortschritt</span>
          <span className="tabular-nums">
            {profile.xpCurrentLevel.toLocaleString()} / {xpNeeded.toLocaleString()} XP
          </span>
        </div>
        <XPBar />
        <p className="text-xs text-white/30 text-center">
          {profile.level < 30
            ? `${levelsToNext} Level bis zur nächsten Liga`
            : '🏆 Max Level erreicht!'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Gesamt XP',     value: formatNumber(profile.xpTotal),      icon: '⭐' },
          { label: 'Saison XP',     value: formatNumber(profile.seasonXp),      icon: '🗓' },
          { label: 'Streak',        value: `${profile.streakCurrent} Tage`,     icon: '🔥' },
          { label: 'Bester Streak', value: `${profile.streakLongest} Tage`,     icon: '🏆' },
          { label: 'Energie',       value: `${energy.current}/100`,             icon: '⚡' },
          { label: 'XP Heute',      value: formatNumber(profile.xpEarnedToday), icon: '📈' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="rounded-xl border border-white/[0.06]
                                      bg-white/[0.02] p-3 flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <div>
              <p className="text-sm font-bold text-white tabular-nums">{value}</p>
              <p className="text-[10px] text-white/35">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* TON Wallet */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">TON Wallet</h3>
        <WalletConnect />
      </div>

      {/* Referral */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Referral</h3>
        <ReferralSection />
      </div>
    </div>
  )
}
