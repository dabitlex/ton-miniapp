// src/app/(game)/profile/page.tsx — Redesigned (Aurora OS · Identity Center 2.0)
// Hero with XP ring · tiered stats · progressive disclosure via bottom sheets
'use client'
import { useEffect, useState } from 'react'
import { useQuery }        from '@tanstack/react-query'
import { useUserStore }    from '@/stores/useUserStore'
import { useAuthStore }    from '@/stores/useAuthStore'
import { useEnergy }       from '@/features/hooks'
import { xpForLevel }      from '@/lib/constants/game'
import { TelegramAvatar }  from '@/components/layout/GameHeader'
import { WalletConnect }   from '@/components/ton/WalletConnect'
import { ReferralSection } from '@/components/game/ReferralSection'
import { NotificationSettings } from '@/components/game/NotificationSettings'
import { BottomSheet }     from '@/components/ui/BottomSheet'
import { formatNumber }    from '@/lib/utils'
import { Wallet, Users, Settings, ChevronRight, Flame, Zap, TrendingUp, Trophy } from 'lucide-react'

type SheetId = 'wallet' | 'referral' | 'settings' | null

const RING_R = 52
const RING_C = 2 * Math.PI * RING_R // ≈ 326.7

export default function ProfilePage() {
  const profile = useUserStore(s => s.profile)
  const token   = useAuthStore(s => s.accessToken)
  const energy  = useEnergy()
  const [sheet, setSheet]   = useState<SheetId>(null)
  const [ringIn, setRingIn] = useState(false)

  // Same query key/options as ReferralSection → deduped by React Query
  const { data: refData } = useQuery({
    queryKey: ['referrals'],
    enabled:  !!token,
    staleTime: 60_000,
    queryFn:  async () => {
      const res  = await fetch('/api/v1/referrals', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      return json.success ? json.data : null
    },
  })

  // Animate XP ring in after mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setRingIn(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  if (!profile) {
    return (
      <div className="px-5 pt-5 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 shimmer" />
        ))}
      </div>
    )
  }

  // XP progress (same logic as XPBar)
  const needed = xpForLevel(Math.min(profile.level, 29))
  const pct    = Math.min(100, Math.round((profile.xpCurrentLevel / needed) * 100))
  const toNext = Math.max(0, needed - profile.xpCurrentLevel)
  const dashOffset = RING_C * (1 - (ringIn ? pct : 0) / 100)

  // Row sublines
  const walletConnected = !!profile.wallet && profile.wallet.status === 'connected'
  const walletSub = walletConnected ? 'Connected' : 'Not connected'

  const refEligible = !!refData?.referralEligible || profile.referralEligible
  const referralSub = refEligible
    ? refData?.nextMilestone
      ? `${refData.validReferrals ?? 0} confirmed · next reward at ${refData.nextMilestone.threshold}`
      : `${refData?.validReferrals ?? 0} confirmed · +500 XP per friend`
    : 'Locked · 3 steps to unlock'

  const lowEnergy = energy.current < 20

  return (
    <div className="overflow-y-auto pb-8 relative z-10">

      {/* ── Identity hero — avatar + XP ring fused ─────────────── */}
      <div className="relative px-5 pt-[18px] pb-1 animate-rise">
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-[300px] h-[170px] pointer-events-none"
          style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(139,92,246,0.20), transparent 70%)' }} />

        <div className="relative flex flex-col items-center text-center">

          {/* XP ring */}
          <div className="relative w-[112px] h-[112px]">
            <svg viewBox="0 0 112 112" className="absolute inset-0 -rotate-90">
              <defs>
                <linearGradient id="pf-ring-g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%"   stopColor="#8B5CF6" />
                  <stop offset="55%"  stopColor="#5B8DEF" />
                  <stop offset="100%" stopColor="#5EEAD4" />
                </linearGradient>
              </defs>
              <circle cx="56" cy="56" r={RING_R} fill="none"
                stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
              <circle cx="56" cy="56" r={RING_R} fill="none"
                stroke="url(#pf-ring-g)" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={RING_C} strokeDashoffset={dashOffset}
                style={{
                  transition: 'stroke-dashoffset 1.1s var(--ease-out) 0.25s',
                  filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.55))',
                }} />
            </svg>
            <div className="absolute inset-[11px] rounded-full overflow-hidden"
              style={{ background: '#1A1530', boxShadow: 'inset 0 0 0 2px var(--bg-void), 0 10px 30px rgba(124,58,237,0.35)' }}>
              <TelegramAvatar
                photoUrl={profile.telegramPhotoUrl}
                firstName={profile.telegramFirstName}
                size={90}
              />
            </div>
          </div>

          {/* Level chip */}
          <div className="-mt-[13px] relative z-[2] px-3 py-[5px] rounded-full"
            style={{ background: 'var(--aurora)', boxShadow: '0 4px 14px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.25)' }}>
            <span className="text-[11px] font-extrabold text-white" style={{ fontFamily: 'var(--font-display)' }}>
              LEVEL {profile.level}
            </span>
          </div>

          <h1 className="display text-[21px] text-white leading-tight mt-3">
            {profile.telegramFirstName} {profile.telegramLastName ?? ''}
          </h1>
          {profile.telegramUsername && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>@{profile.telegramUsername}</p>
          )}
          <p className="text-[11px] mt-[7px]" style={{ color: 'var(--text-muted)' }}>
            <b className="font-bold" style={{ color: 'var(--violet-bright)' }}>{toNext.toLocaleString()} XP</b>
            {' '}to Level {profile.level + 1} · {pct}%
          </p>

          {/* Founding member badge */}
          {profile.isFounder && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-[11px] py-[5px] rounded-full"
              style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.40)' }}>
              <svg width={12} height={12} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <defs>
                  <linearGradient id="pf-founder-g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%"   stopColor="#FBBF24" />
                    <stop offset="55%"  stopColor="#A78BFA" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>
                <path d="M12 1 L21 6.5 L21 17.5 L12 23 L3 17.5 L3 6.5 Z"
                      fill="url(#pf-founder-g)" stroke="#FCD34D" strokeWidth="1" />
                <path d="M12 6.2 L13.5 10 L17.5 10.2 L14.4 12.7 L15.4 16.6 L12 14.4 L8.6 16.6 L9.6 12.7 L6.5 10.2 L10.5 10 Z"
                      fill="#fff" opacity="0.95" />
              </svg>
              <span className="text-[10px] font-extrabold tracking-wide"
                style={{ color: '#FCD34D', fontFamily: 'var(--font-display)' }}>
                FOUNDING MEMBER
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Hero stat band — Total XP · Season XP · Streak ─────── */}
      <div className="mx-5 mt-[18px] rounded-[22px] relative overflow-hidden grid items-stretch animate-rise"
        style={{
          animationDelay: '80ms',
          gridTemplateColumns: '1.25fr 1fr 1fr',
          background: 'linear-gradient(160deg, rgba(139,92,246,0.13), rgba(91,141,239,0.07) 60%, rgba(255,255,255,0.03))',
          boxShadow: 'inset 0 1px 0 var(--edge-light), var(--shadow-md)',
        }}>
        {[
          { value: profile.xpTotal.toLocaleString(), label: 'Total XP', hero: true },
          { value: profile.seasonXp.toLocaleString(), label: 'Season XP', hero: false },
          { value: `${profile.streakCurrent}d 🔥`, label: 'Streak', hero: false, tint: '#FB923C' },
        ].map(({ value, label, hero, tint }, i) => (
          <div key={label} className="relative px-1.5 pt-[15px] pb-[13px] text-center">
            {i > 0 && (
              <div className="absolute left-0 top-[18%] bottom-[18%] w-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            )}
            <div className="font-extrabold tabular-nums leading-[1.05]"
              style={{
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.02em',
                fontSize: hero
                  ? (String(value).length > 7 ? 19 : 23)
                  : (String(value).length > 7 ? 14 : 17),
                ...(hero
                  ? { background: 'var(--aurora-text)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
                  : { color: tint ?? '#fff' }),
              }}>
              {value}
            </div>
            <div className="text-[9.5px] font-bold uppercase mt-1"
              style={{ letterSpacing: '0.10em', color: tint ?? 'var(--text-faint)' }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Secondary stat strip — Energy · Today XP · Best ────── */}
      <div className="mx-5 mt-2.5 grid grid-cols-3 gap-2 animate-rise" style={{ animationDelay: '140ms' }}>
        {[
          {
            icon: <Zap size={14} fill={lowEnergy ? '#FB7185' : '#5EEAD4'} style={{ color: lowEnergy ? '#FB7185' : '#5EEAD4' }} />,
            value: <>{energy.current}<span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>/100</span></>,
            tint: lowEnergy ? 'var(--rose)' : 'var(--cyan-accent)',
            label: 'Energy',
          },
          {
            icon: <TrendingUp size={14} style={{ color: '#34D399' }} />,
            value: `+${profile.xpEarnedToday.toLocaleString()}`,
            tint: 'var(--emerald)',
            label: 'Today XP',
          },
          {
            icon: <Trophy size={14} style={{ color: '#FBBF24' }} />,
            value: `${profile.streakLongest}d`,
            tint: 'var(--gold)',
            label: 'Best Streak',
          },
        ].map(({ icon, value, tint, label }) => (
          <div key={label} className="rounded-2xl min-h-[44px] px-2 py-[9px] flex items-center justify-center gap-[7px]"
            style={{ background: 'var(--surface-1)', boxShadow: 'inset 0 1px 0 var(--edge-soft)' }}>
            <span className="shrink-0">{icon}</span>
            <div className="min-w-0">
              <span className="block text-[13px] font-bold tabular-nums leading-tight"
                style={{ fontFamily: 'var(--font-display)', color: tint }}>
                {value}
              </span>
              <span className="block text-[9px] font-semibold mt-px" style={{ color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Clan ───────────────────────────────────────────────── */}
      {profile.clan && (
        <div className="mx-5 mt-[18px] rounded-[20px] px-[15px] py-[13px] flex items-center gap-3 animate-rise"
          style={{
            animationDelay: '200ms',
            background: 'linear-gradient(120deg, var(--surface-accent), var(--surface-1))',
            boxShadow: 'inset 0 1px 0 var(--edge-soft), inset 0 0 0 1px rgba(139,92,246,0.14)',
          }}>
          <div className="w-[38px] h-[38px] rounded-[13px] flex items-center justify-center text-lg shrink-0"
            style={{ background: 'rgba(139,92,246,0.14)', boxShadow: 'inset 0 0 0 1px rgba(139,92,246,0.22)' }}>
            🛡️
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: '#DDD6FE' }}>{(profile.clan as any).name}</p>
            <p className="text-[11px] mt-px" style={{ color: 'var(--text-muted)' }}>
              {profile.clan.role === 'leader' ? '👑 Leader' : profile.clan.role === 'officer' ? '⚔️ Officer' : '🎮 Member'}
            </p>
          </div>
          <span className="text-[12px] font-bold whitespace-nowrap"
            style={{ color: 'var(--violet-bright)', fontFamily: 'var(--font-display)' }}>
            ⭐ {formatNumber((profile.clan as any).seasonXp ?? 0)}
          </span>
        </div>
      )}

      {/* ── Account — progressive disclosure rows ──────────────── */}
      <div className="mx-5 mt-6 animate-rise" style={{ animationDelay: '260ms' }}>
        <h3 className="eyebrow mb-2.5">Account</h3>
        <div className="rounded-[22px] overflow-hidden" style={{ background: 'var(--surface-1)', boxShadow: 'inset 0 1px 0 var(--edge-soft)' }}>
          {[
            {
              id: 'wallet' as const,
              title: 'TON Wallet',
              sub: walletSub,
              dot: walletConnected ? 'var(--emerald)' : null,
              dotGlow: 'rgba(52,211,153,0.6)',
              icon: <Wallet size={18} style={{ color: '#5EEAD4' }} strokeWidth={1.8} />,
              iconBg: 'rgba(94,234,212,0.10)',
              iconRing: 'rgba(94,234,212,0.20)',
            },
            {
              id: 'referral' as const,
              title: 'Invite Friends',
              sub: referralSub,
              dot: refEligible ? 'var(--gold)' : null,
              dotGlow: 'rgba(251,191,36,0.5)',
              icon: <Users size={18} style={{ color: '#A78BFA' }} strokeWidth={1.8} />,
              iconBg: 'rgba(139,92,246,0.12)',
              iconRing: 'rgba(139,92,246,0.22)',
            },
            {
              id: 'settings' as const,
              title: 'Settings',
              sub: 'Notifications & preferences',
              dot: null,
              dotGlow: '',
              icon: <Settings size={18} style={{ color: 'rgba(255,255,255,0.55)' }} strokeWidth={1.8} />,
              iconBg: 'var(--surface-2)',
              iconRing: 'transparent',
            },
          ].map(({ id, title, sub, dot, dotGlow, icon, iconBg, iconRing }, i) => (
            <button
              key={id}
              onClick={() => setSheet(id)}
              className="w-full flex items-center gap-[13px] px-4 py-[15px] min-h-[60px] text-left transition-colors active:bg-white/[0.025]"
              style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
            >
              <div className="w-[38px] h-[38px] rounded-[13px] shrink-0 flex items-center justify-center"
                style={{ background: iconBg, boxShadow: `inset 0 0 0 1px ${iconRing}` }}>
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
                <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                  {dot && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full mr-[5px] align-[1px]"
                      style={{ background: dot, boxShadow: `0 0 6px ${dotGlow}` }} />
                  )}
                  {sub}
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0" style={{ color: 'var(--text-faint)' }} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Sheets — existing components, untouched logic ──────── */}
      <BottomSheet open={sheet === 'wallet'} onClose={() => setSheet(null)} title="TON Wallet">
        <WalletConnect />
      </BottomSheet>

      <BottomSheet open={sheet === 'referral'} onClose={() => setSheet(null)} title="Invite Friends">
        <ReferralSection />
      </BottomSheet>

      <BottomSheet open={sheet === 'settings'} onClose={() => setSheet(null)} title="Settings">
        <NotificationSettings />
      </BottomSheet>
    </div>
  )
}
