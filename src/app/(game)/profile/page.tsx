// src/app/(game)/profile/page.tsx — VEXALGO 2.0
// Aufbau nach Design-Vorschau:
//   Kopf (Avatar im XP-Ring links, Name + Chips rechts)
//   Kennzahlen-Karte (Total XP · Season XP · Bester Streak) + XP-Sparkline
//   Abschnitt "Fortschritt": Achievements · XP-Verlauf · Relics
//   Abschnitt "Konto": Wallet · Freunde einladen · Einstellungen
// Datenanbindung und Sheets sind unveraendert uebernommen.
'use client'
import { useEffect, useState } from 'react'
import { useRouter }       from 'next/navigation'
import { useQuery }        from '@tanstack/react-query'
import { useUserStore }    from '@/stores/useUserStore'
import { useAuthStore }    from '@/stores/useAuthStore'
import { xpForLevel }      from '@/lib/constants/game'
import { TelegramAvatar }  from '@/components/layout/GameHeader'
import { WalletConnect }   from '@/components/ton/WalletConnect'
import { ReferralSection } from '@/components/game/ReferralSection'
import { NotificationSettings } from '@/components/game/NotificationSettings'
import { LanguageSettings }     from '@/components/game/LanguageSettings'
import { BottomSheet }     from '@/components/ui/BottomSheet'
import { XpHistorySheet }  from '@/components/game/XpHistorySheet'

import { Icon, IconTile, type IconName } from '@/components/ui/Icon'
import { useI18n }     from '@/lib/i18n'
import { authedFetch } from '@/lib/authedFetch'

type SheetId = 'wallet' | 'referral' | 'settings' | 'activity' | null

const RING_R = 35
const RING_C = 2 * Math.PI * RING_R
const fd: React.CSSProperties = { fontFamily: 'var(--font-display)' }

/** Zeile in den Abschnitts-Listen */
function Row({
  icon, title, sub, right, onClick, last = false,
}: {
  icon: IconName; title: string; sub?: string
  right?: React.ReactNode; onClick: () => void; last?: boolean
}) {
  return (
    <>
      <button onClick={onClick} className="w-full flex items-center text-left press"
        style={{ gap: 13, padding: '13px 0', background: 'none', border: 'none' }}>
        <IconTile name={icon} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ ...fd, fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</p>
          {sub && (
            <p className="truncate" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</p>
          )}
        </div>
        {right}
        <Icon name="chevronRight" size={15} strokeWidth={1.8}
          style={{ color: 'var(--text-faint)', marginLeft: 8 }} />
      </button>
      {!last && <div className="hairline" />}
    </>
  )
}

export default function ProfilePage() {
  const profile = useUserStore(s => s.profile)
  const router  = useRouter()
  const token   = useAuthStore(s => s.accessToken)
  const [sheet, setSheet]   = useState<SheetId>(null)
  const [ringIn, setRingIn] = useState(false)
  const { t, lang }         = useI18n()

  // Gleicher Query-Key wie ReferralSection -> von React Query dedupliziert
  const { data: refData } = useQuery({
    queryKey: ['referrals'],
    enabled:  !!token,
    staleTime: 60_000,
    queryFn:  async () => {
      const res  = await fetch('/api/v1/referrals', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      return json.success ? json.data : null
    },
  })

  // Sparkline: Tageswerte kommen fertig aggregiert vom Server.
  // Frueher wurden die letzten 100 Eintraege im Client gebuendelt — das
  // deckte bei aktiven Nutzern nur ein bis zwei Tage ab, der Rest blieb
  // leer und das Diagramm sah kaputt aus.
  const { data: trend } = useQuery<number[]>({
    queryKey: ['xp-trend'],
    enabled:  !!token,
    staleTime: 300_000,
    queryFn:  async () => {
      const res  = await authedFetch('/api/v1/users/xp-daily?days=14')
      const json = await res.json().catch(() => null)
      const days = json?.success ? json.data?.days : null
      return Array.isArray(days) ? days.map((d: { xp: number }) => Number(d.xp) || 0) : []
    },
  })

  useEffect(() => {
    const raf = requestAnimationFrame(() => setRingIn(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  if (!profile) {
    return (
      <div className="px-5 pt-5 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 shimmer" />)}
      </div>
    )
  }

  const nf = (n: number) => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US').format(n)

  const needed     = xpForLevel(Math.min(profile.level, 29))
  const pct        = Math.min(100, Math.round((profile.xpCurrentLevel / needed) * 100))
  const dashOffset = RING_C * (1 - (ringIn ? pct : 0) / 100)

  const walletConnected = !!profile.wallet && profile.wallet.status === 'connected'
  const walletAddr = walletConnected && profile.wallet?.address
    ? `${profile.wallet.address.slice(0, 4)}…${profile.wallet.address.slice(-4)}`
    : t('profile.walletNone')

  const refEligible = !!refData?.referralEligible || profile.referralEligible
  const referralSub = refEligible
    ? t('profile.inviteStats', { invited: refData?.invitedCount ?? 0, valid: refData?.validReferrals ?? 0 })
    : (lang === 'de' ? 'Gesperrt · 3 Schritte zum Freischalten' : 'Locked · 3 steps to unlock')

  const hasTrend = !!trend && trend.some(v => v > 0)
  const trendMax = hasTrend ? Math.max(...trend!, 1) : 1
  const trendPct = hasTrend && trend!.length >= 4
    ? (() => {
        const half = Math.floor(trend!.length / 2)
        const a = trend!.slice(0, half).reduce((x, y) => x + y, 0)
        const b = trend!.slice(half).reduce((x, y) => x + y, 0)
        return a > 0 ? Math.round(((b - a) / a) * 100) : null
      })()
    : null

  return (
    <div className="overflow-y-auto relative z-10" style={{ padding: '26px 20px 24px' }}>

      {/* Kopf: Avatar im XP-Ring + Name */}
      <div className="flex items-center animate-rise" style={{ gap: 16, marginBottom: 20 }}>
        <div style={{ position: 'relative', width: 78, height: 78, flexShrink: 0 }}>
          <svg viewBox="0 0 78 78" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
            <defs>
              <linearGradient id="pf-ring-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#9CC0FF" /><stop offset="100%" stopColor="#2563FF" />
              </linearGradient>
            </defs>
            <circle cx="39" cy="39" r={RING_R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
            <circle cx="39" cy="39" r={RING_R} fill="none" stroke="url(#pf-ring-g)" strokeWidth="4"
              strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 1.1s var(--ease-out) 0.25s' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', overflow: 'hidden' }}>
            <TelegramAvatar photoUrl={profile.telegramPhotoUrl}
              firstName={profile.telegramFirstName} size={62} />
          </div>
          <div style={{ position: 'absolute', right: -2, bottom: -2, borderRadius: 11,
            padding: '2px 8px', fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 500,
            background: 'linear-gradient(135deg,#7BA5FF,#1D4ED8)',
            border: '3px solid var(--bg-void)' }}>
            {profile.level}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="truncate" style={{ ...fd, fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em' }}>
            {profile.telegramFirstName}
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            {profile.telegramUsername ? `@${profile.telegramUsername}` : t('profile.noUsername')}
          </p>
          <div className="flex items-center" style={{ gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
            {profile.isFounder && (
              <span className="chip" style={{ height: 25, fontSize: 10.5, color: 'var(--gold)' }}>
                Founding Member
              </span>
            )}
            <span className="chip" style={{ height: 25, fontSize: 10.5, textTransform: 'capitalize' }}>
              {profile.league}
            </span>
          </div>
        </div>
      </div>

      {/* Kennzahlen + Sparkline */}
      <div className="surface animate-rise" style={{ padding: 18, animationDelay: '60ms' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: hasTrend ? 15 : 0 }}>
          <div>
            <p style={{ ...fd, fontSize: 21, fontWeight: 500, color: 'var(--blue-2)' }}>
              {nf(profile.xpTotal)}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('profile.totalXp')}</p>
          </div>
          <div style={{ width: 0.5, height: 34, background: 'rgba(255,255,255,0.12)' }} />
          <div>
            <p style={{ ...fd, fontSize: 21, fontWeight: 500 }}>{nf(profile.seasonXp)}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('home.seasonXp')}</p>
          </div>
          <div style={{ width: 0.5, height: 34, background: 'rgba(255,255,255,0.12)' }} />
          <div>
            <p style={{ ...fd, fontSize: 21, fontWeight: 500 }}>{profile.streakLongest}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('profile.bestStreak')}</p>
          </div>
        </div>

        {hasTrend && (
          <>
            <div className="hairline" style={{ marginBottom: 14 }} />
            <div className="flex items-center justify-between">
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('profile.xpTrend')}</p>
              {trendPct !== null && (
                <span style={{ fontSize: 10.5, color: trendPct >= 0 ? 'var(--emerald)' : 'var(--rose)' }}>
                  {trendPct >= 0 ? '▲' : '▼'} {Math.abs(trendPct)}%
                </span>
              )}
            </div>
            <div className="flex items-end" style={{ gap: 2.5, height: 28, marginTop: 11 }}>
              {trend!.map((v, i) => (
                <span key={i} style={{
                  width: 5, borderRadius: 2,
                  height: `${Math.max(8, (v / trendMax) * 100)}%`,
                  background: 'linear-gradient(180deg,#7BA5FF,rgba(37,99,255,0.25))',
                }} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Fortschritt */}
      <p className="eyebrow" style={{ margin: '22px 2px 11px' }}>{t('profile.progress')}</p>
      <div className="surface-2" style={{ padding: '3px 16px', borderRadius: 22 }}>
        {profile.achievementsEnabled && (
          <Row icon="trophy" title={t('profile.achievements')} sub={t('profile.achievementsSub')}
            onClick={() => router.push('/achievements')} />
        )}
        <Row icon="clock" title={t('profile.xpHistory')} sub={t('profile.xpHistorySub')}
          onClick={() => setSheet('activity')} />
        <Row icon="gem" title={t('profile.relics')}
          sub={profile.ecosystemBoost
            ? t('profile.relicsActive', { percent: profile.ecosystemBoost })
            : t('profile.relicsSub')}
          onClick={() => router.push('/ecosystem')} last />
      </div>

      {/* Konto */}
      <p className="eyebrow" style={{ margin: '20px 2px 11px' }}>{t('profile.account')}</p>
      <div className="surface-2" style={{ padding: '3px 16px', borderRadius: 22 }}>
        <Row icon="wallet" title={t('profile.wallet')} sub={walletAddr}
          onClick={() => setSheet('wallet')}
          right={walletConnected
            ? <span className="chip" style={{ height: 22, fontSize: 10, padding: '0 9px', color: 'var(--emerald)' }}>
                {t('common.connected')}
              </span>
            : undefined} />
        <Row icon="users" title={t('profile.invite')} sub={referralSub}
          onClick={() => setSheet('referral')}
          right={<span style={{ fontSize: 11, color: 'var(--blue-2)' }}>+500 XP</span>} />
        <Row icon="gear" title={t('profile.settings')} sub={t('profile.settingsSub')}
          onClick={() => setSheet('settings')} last />
      </div>

      {/* Sheets — unveraenderte Komponenten */}
      <BottomSheet open={sheet === 'wallet'} onClose={() => setSheet(null)} title={t('profile.wallet')}>
        <WalletConnect />
      </BottomSheet>

      <BottomSheet open={sheet === 'referral'} onClose={() => setSheet(null)} title={t('profile.invite')}>
        <ReferralSection />
      </BottomSheet>

      <BottomSheet open={sheet === 'settings'} onClose={() => setSheet(null)} title={t('profile.settings')}>
        <div className="space-y-3">
          <NotificationSettings />
          <LanguageSettings />
        </div>
      </BottomSheet>

      <XpHistorySheet open={sheet === 'activity'} onClose={() => setSheet(null)} />
    </div>
  )
}
