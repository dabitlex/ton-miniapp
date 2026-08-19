// src/app/(game)/home/page.tsx — VEXALGO 2.0
'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useUserStore }        from '@/stores/useUserStore'
import { useLeaderboardStore } from '@/stores/useLeaderboardStore'
import { useEnergy, useStreak } from '@/features/hooks'
import { useClanWar }          from '@/features/war/hooks'
import { useVault }            from '@/features/vault/hooks'

import { xpForLevel, GAME_CONSTANTS } from '@/lib/constants/game'
import { Icon, IconTile }      from '@/components/ui/Icon'
import { useI18n }             from '@/lib/i18n'

const fd: React.CSSProperties = { fontFamily: 'var(--font-display)' }

/* ── Info-Banner: feste Inhalte, spaeter aus einer announcements-Tabelle ── */
interface Banner {
  tag: string; tone: string; title: string; body: string; cta: string
  href: string; logo?: boolean
  /** true = Telegram-Link (Gruppe/Kanal), wird ueber openTelegramLink geoeffnet */
  external?: boolean
}

/** Einladungslink zur VEXALGO-Community-Gruppe */
const GROUP_LINK = 'https://t.me/+qYNbVhXczxNjMjFi'

/**
 * Telegram-Links MUESSEN ueber openTelegramLink() geoeffnet werden.
 * Ein normaler <a href> wuerde im Mini-App-Fenster laden statt in
 * Telegram selbst — die Gruppe waere dann nicht beitretbar.
 * Ausserhalb von Telegram (Browser-Vorschau) faellt es auf window.open zurueck.
 */
function openTelegram(url: string) {
  const tg = (typeof window !== 'undefined' ? (window as any)?.Telegram?.WebApp : null)
  if (tg?.openTelegramLink) tg.openTelegramLink(url)
  else window.open(url, '_blank', 'noopener,noreferrer')
}

export default function HomePage() {
  const profile  = useUserStore(s => s.profile)
  const userRank = useLeaderboardStore(s => s.userRank)
  const energy   = useEnergy()
  const { streakCurrent, streakLongest, canClaim, isClaiming, claimStreak } = useStreak()
  const { war }  = useClanWar()
  const { vault } = useVault()
  const { t, lang } = useI18n()

  const nf = (n: number) => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US').format(n)

  const needed   = profile ? xpForLevel(Math.min(profile.level, 29)) : 1
  const levelPct = profile ? Math.min(100, (profile.xpCurrentLevel / needed) * 100) : 0
  const xpToNext = profile ? Math.max(0, needed - profile.xpCurrentLevel) : 0
  const R = 32, C = 2 * Math.PI * R

  const seasonDaysLeft = (() => {
    const endsAt = profile?.season?.endsAt
    if (!endsAt) return null
    const diff = new Date(endsAt).getTime() - Date.now()
    return diff <= 0 ? 0 : Math.ceil(diff / 86400000)
  })()

  const energyPct = Math.min(100, (energy.current / GAME_CONSTANTS.MAX_ENERGY) * 100)

  // Minuten bis zum naechsten Energiepunkt (nextRegenAt ist ein Zeitstempel)
  const minsToNext = (() => {
    if (energy.isFull || !energy.nextRegenAt) return null
    const diff = new Date(energy.nextRegenAt).getTime() - Date.now()
    return diff <= 0 ? 0 : Math.max(1, Math.ceil(diff / 60000))
  })()

  /* ── Banner zusammenstellen ── */
  const banners: Banner[] = [
    { tag: t('home.banner.update'), tone: 'var(--emerald)',
      title: lang === 'de' ? 'VEXALGO 2.0\nist da' : 'VEXALGO 2.0\nis here',
      body: lang === 'de' ? 'Komplett neues Design' : 'A completely new design',
      cta: t('home.banner.whatsNew'), href: '/quests', logo: true },
    { tag: t('home.banner.group'), tone: 'var(--blue-2)',
      title: lang === 'de' ? 'VEXALGO Gruppe\nist da' : 'VEXALGO group\nis live',
      body: lang === 'de' ? 'Austausch, Tipps und News' : 'Chat, tips and news',
      cta: t('home.banner.joinGroup'), href: GROUP_LINK, external: true },
  ]
  if (vault?.state === 'open') {
    banners.push({ tag: t('home.banner.new'), tone: 'var(--emerald)', title: t('vault.title'),
      body: lang === 'de' ? 'Lose sammeln · Ziehung Sonntag' : 'Collect tickets · draw on Sunday',
      cta: t('home.banner.learnMore'), href: '/vault' })
  }
  if (war?.state === 'live') {
    banners.push({ tag: t('home.banner.war'), tone: 'var(--rose)', title: t('war.title'),
      body: `${t('war.myContribution')}: ${nf(war.myContribution.today)}/${nf(war.myContribution.dailyCap)}`,
      cta: t('home.banner.toBattle'), href: '/clans/war' })
  }
  if (seasonDaysLeft !== null) {
    banners.push({ tag: t('home.banner.season'), tone: 'var(--gold)',
      title: `Season ${profile?.season?.number ?? 2} · ${seasonDaysLeft}${lang === 'de' ? ' Tage' : 'd'}`,
      body: lang === 'de' ? 'Top 10 erhalten Bonus-XP' : 'Top 10 earn bonus XP',
      cta: t('home.banner.toRanks'), href: '/leaderboard' })
  }

  const [bIdx, setBIdx] = useState(0)
  // Nach einer Wischgeste pausiert der automatische Wechsel kurz,
  // damit der Nutzer in Ruhe lesen kann.
  const [bPaused, setBPaused] = useState(false)
  const touchX = useRef<number | null>(null)

  useEffect(() => {
    if (banners.length < 2 || bPaused) return
    const t = setInterval(() => setBIdx(i => (i + 1) % banners.length), 4500)
    return () => clearInterval(t)
  }, [banners.length, bPaused])

  useEffect(() => {
    if (!bPaused) return
    const t = setTimeout(() => setBPaused(false), 12000)
    return () => clearTimeout(t)
  }, [bPaused, bIdx])

  const goBanner = (dir: 1 | -1) => {
    setBPaused(true)
    setBIdx(i => (i + dir + banners.length) % banners.length)
  }

  if (!profile) return null

  return (
    <div className="flex flex-col min-h-full relative z-10" style={{ padding: '24px 20px 18px' }}>

      {/* ── Kopfzeile ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{t('home.welcome')}</p>
          <h1 style={{ ...fd, fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 2 }}>
            {profile.telegramFirstName}
          </h1>
        </div>
        {profile.clan ? (
          <Link href="/clans/chat" style={{ position: 'relative' }} aria-label="Clan Chat">
            <IconTile name="chat" size={40} active />
          </Link>
        ) : (
          <span className="chip">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--emerald)' }} />
            {seasonDaysLeft !== null ? `${seasonDaysLeft}d` : 'Season'}
          </span>
        )}
      </div>

      {/* ── Kopf-Karte: Season-XP, Level-Ring, Energie ─────────── */}
      <div className="surface animate-rise" style={{ padding: 18 }}>
        <div className="flex items-start justify-between">
          <div style={{ minWidth: 0 }}>
            <p className="eyebrow">{t('home.seasonXp')}</p>
            <p style={{ ...fd, fontSize: 30, fontWeight: 500, letterSpacing: '-0.035em', margin: '5px 0 0', lineHeight: 1 }}>
              {nf(profile.seasonXp)}
            </p>
            <div className="flex items-center" style={{ gap: 9, marginTop: 10, flexWrap: 'wrap' }}>
              {profile.xpEarnedToday > 0 && (
                <span style={{ fontSize: 10.5, color: 'var(--emerald)' }}>
                  ▲ {nf(profile.xpEarnedToday)}
                </span>
              )}
              {userRank && (<>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,.22)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('home.rank', { rank: userRank })}</span>
              </>)}
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,.22)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {profile.league}
              </span>
            </div>
          </div>

          <div style={{ position: 'relative', width: 74, height: 74, flexShrink: 0 }}>
            <svg width="74" height="74" viewBox="0 0 74 74" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="37" cy="37" r={R} fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="5" />
              <defs>
                <linearGradient id="lvlRing" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#9CC0FF" /><stop offset="1" stopColor="#2563FF" />
                </linearGradient>
              </defs>
              <circle cx="37" cy="37" r={R} fill="none" stroke="url(#lvlRing)" strokeWidth="5"
                strokeLinecap="round" strokeDasharray={`${(levelPct / 100) * C} ${C}`} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ ...fd, fontSize: 24, fontWeight: 500, lineHeight: 1 }}>{profile.level}</span>
              <span style={{ fontSize: 7.5, letterSpacing: '.18em', color: 'var(--text-muted)', marginTop: 2 }}>LEVEL</span>
            </div>
          </div>
        </div>

        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 9 }}>
          {t('home.toNextLevel', { xp: nf(xpToNext), level: Math.min(profile.level + 1, 30) })}
        </p>

        <div className="hairline" style={{ margin: '13px 0 11px' }} />

        <div className="flex items-center" style={{ gap: 10, minWidth: 0 }}>
          <Icon name="bolt" size={14} strokeWidth={1.7} style={{ color: 'var(--blue-2)' }} />
          <div className="progress-bar" style={{ flex: 1, height: 5 }}>
            <div className="progress-fill" style={{ width: `${energyPct}%` }} />
          </div>
          <p style={{ ...fd, fontSize: 12.5, whiteSpace: 'nowrap' }}>
            {energy.current}<span style={{ fontSize: 10, color: 'var(--text-muted)' }}>/{GAME_CONSTANTS.MAX_ENERGY}</span>
          </p>
          {!energy.isFull && minsToNext != null && (
            <p style={{ fontSize: 9.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {t('home.energyNext', { amount: energy.regenMultiplier, minutes: minsToNext ?? 0 })}
            </p>
          )}
        </div>
      </div>

      {/* ── Schnellzugriff ────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
        {/* Erstes Symbol: XP Rush. Quests sind ohnehin ueber die
            Navigation erreichbar, der Platz war also frei. */}
        <Link href="/arcade"><IconTile name="gamepad" size={56} /></Link>
        {vault?.enabled
          ? <Link href="/vault"><IconTile name="lock" size={56} /></Link>
          : <Link href="/achievements"><IconTile name="trophy" size={56} /></Link>}
        <Link href={profile.clan ? '/clans/war' : '/clans'}><IconTile name="swords" size={56} /></Link>
        <Link href="/quests"><IconTile name="box" size={56} /></Link>
        <Link href="/ecosystem"><IconTile name="gem" size={56} /></Link>
      </div>

      {/* ── Raster: Streak · Info · Vault · Krieg ──────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
        gap: 11, marginTop: 14, alignItems: 'stretch' }}>

        {/* Streak — die ganze Karte ist der Abhol-Knopf */}
        <button
          onClick={() => canClaim && claimStreak()}
          disabled={!canClaim || isClaiming}
          className="surface-2 press"
          style={{ padding: 15, borderRadius: 21, position: 'relative', textAlign: 'left',
            border: 'none', display: 'flex', flexDirection: 'column', cursor: canClaim ? 'pointer' : 'default' }}
        >
          {canClaim && (
            <span aria-hidden style={{ position: 'absolute', inset: -1, borderRadius: 21, pointerEvents: 'none',
              boxShadow: '0 0 0 1px rgba(91,141,255,.55), 0 0 22px rgba(37,99,255,.28)',
              animation: 'pulse-glow 2.4s ease-in-out infinite' }} />
          )}
          <div className="flex items-center justify-between" style={{ position: 'relative' }}>
            <p style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{t('home.streak')}</p>
            <Icon name="flame" size={16} style={{ color: canClaim ? 'var(--blue-3)' : 'var(--gold)' }} />
          </div>
          <p style={{ ...fd, fontSize: 26, fontWeight: 500, marginTop: 3, position: 'relative' }}>{streakCurrent}</p>

          <div className="flex" style={{ gap: 5, marginTop: 11, position: 'relative' }}>
            {Array.from({ length: 7 }).map((_, i) => {
              const filled = i < Math.min(streakCurrent % 7 === 0 && streakCurrent > 0 ? 7 : streakCurrent % 7, 7)
              const isToday = !filled && i === (streakCurrent % 7)
              return (
                <span key={i} style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: filled ? 'linear-gradient(135deg,#7BA5FF,#2563FF)' : 'rgba(255,255,255,.14)',
                  boxShadow: filled ? '0 0 8px rgba(37,99,255,.7)'
                    : (isToday && canClaim ? '0 0 0 2px rgba(91,141,255,.35)' : 'none'),
                }} />
              )
            })}
          </div>

          {canClaim ? (
            <div className="flex items-center justify-between"
              style={{ marginTop: 'auto', paddingTop: 11, position: 'relative' }}>
              <p style={{ fontSize: 10, color: 'var(--blue-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {isClaiming ? t('home.streakClaiming') : t('home.streakClaim', { day: streakCurrent + 1 })}
              </p>
              <Icon name="chevronRight" size={13} strokeWidth={2} style={{ color: 'var(--blue-2)' }} />
            </div>
          ) : (
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 'auto', paddingTop: 11, position: 'relative' }}>
              {t('home.streakDone')}{streakLongest > 0 ? ` · ${streakLongest}` : ''}
            </p>
          )}
        </button>

        {/* Info-Karussell */}
        <Link href={banners[bIdx]?.external ? '#' : (banners[bIdx]?.href ?? '/quests')}
          className="surface-2"
          style={{ padding: 0, borderRadius: 21, position: 'relative', overflow: 'hidden',
            minWidth: 0, display: 'block', touchAction: 'pan-y' }}
          onClick={e => {
            const b = banners[bIdx]
            if (b?.external) { e.preventDefault(); openTelegram(b.href) }
          }}
          onTouchStart={e => { touchX.current = e.touches[0]?.clientX ?? null }}
          onTouchEnd={e => {
            const start = touchX.current
            touchX.current = null
            if (start == null) return
            const dx = (e.changedTouches[0]?.clientX ?? start) - start
            if (Math.abs(dx) < 34) return
            e.preventDefault()          // Wischen soll nicht als Tippen gelten
            goBanner(dx < 0 ? 1 : -1)
          }}>
          <div style={{ display: 'flex', transition: 'transform .55s cubic-bezier(.4,0,.2,1)',
            transform: `translateX(-${bIdx * 100}%)`, height: '100%' }}>
            {banners.map((b, i) => (
              <div key={i} style={{ minWidth: '100%', padding: 15, display: 'flex',
                flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
                {b.logo && (
                  <img src="/icon-mark-v2.png" alt="" aria-hidden
                    style={{ position: 'absolute', right: -16, top: '50%', transform: 'translateY(-50%)',
                      width: 104, height: 'auto', opacity: .30, pointerEvents: 'none' }} />
                )}
                <span className="chip" style={{ height: 20, fontSize: 9, padding: '0 8px',
                  color: b.tone, alignSelf: 'flex-start', position: 'relative' }}>{b.tag}</span>
                <p style={{ ...fd, fontSize: 12.5, fontWeight: 500, marginTop: 8, lineHeight: 1.25,
                  position: 'relative', whiteSpace: 'pre-line' }}>{b.title}</p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.3, position: 'relative' }}>
                  {b.body}
                </p>
                <p style={{ fontSize: 9.5, color: 'var(--blue-2)', marginTop: 'auto',
                  paddingTop: 10, paddingRight: 34, position: 'relative' }}>{b.cta} ›</p>
              </div>
            ))}
          </div>
          {banners.length > 1 && (
            <div style={{ position: 'absolute', bottom: 6, right: 8, display: 'flex', gap: 2 }}>
              {banners.map((_, i) => (
                <button key={i} aria-label={`Banner ${i + 1}`}
                  onClick={e => { e.preventDefault(); setBPaused(true); setBIdx(i) }}
                  style={{ border: 'none', background: 'none', padding: 6, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', display: 'block',
                    background: i === bIdx ? 'linear-gradient(135deg,#7BA5FF,#2563FF)' : 'rgba(255,255,255,.14)' }} />
                </button>
              ))}
            </div>
          )}
        </Link>

        {/* Weekly Vault */}
        {vault?.state === 'open' && (
          <Link href="/vault" className="surface-accent"
            style={{ padding: 15, borderRadius: 21, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center justify-between">
              <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,.62)', whiteSpace: 'nowrap' }}>{t('vault.title')}</p>
              <Icon name="lock" size={16} style={{ color: 'rgba(255,255,255,.8)' }} />
            </div>
            <p style={{ ...fd, fontSize: 23, fontWeight: 500, marginTop: 3 }}>{nf(vault.jackpot)}</p>
            <div className="flex items-center" style={{ gap: 6, marginTop: 11 }}>
              <Icon name="ticket" size={13} style={{ color: 'rgba(255,255,255,.7)' }} />
              <p style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>{vault.myTickets} {t('vault.myTickets')}</p>
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 'auto', paddingTop: 10, whiteSpace: 'nowrap' }}>
              {t('vault.drawIn', { time: new Date(vault.drawAt).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { weekday: 'short' }) + ' 21:00' })}
            </p>
          </Link>
        )}

        {/* Clan War */}
        {war?.state === 'live' && (
          <Link href="/clans/war" className="surface-2"
            style={{ padding: 15, borderRadius: 21, position: 'relative', minWidth: 0,
              display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center justify-between">
              <p style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{t('war.title')}</p>
              <Icon name="swords" size={16} style={{ color: 'var(--rose)' }} />
            </div>
            <div className="flex items-start justify-between" style={{ marginTop: 9, gap: 6, minWidth: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, fontSize: 7.5, ...fd,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(140deg,#7BA5FF,#1D4ED8)' }}>
                  {initials(war.myClan.name)}
                </div>
                <p style={{ ...fd, fontSize: 17, fontWeight: 500, color: 'var(--blue-2)', marginTop: 5,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {nf(war.myClan.perCapita)}
                </p>
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, fontSize: 7.5, ...fd, marginLeft: 'auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(140deg,#FB7185,#9F1239)' }}>
                  {initials(war.rival.name)}
                </div>
                <p style={{ ...fd, fontSize: 17, fontWeight: 500, color: 'var(--rose)', marginTop: 5,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {nf(war.rival.perCapita)}
                </p>
              </div>
            </div>
            <div className="progress-bar" style={{ marginTop: 'auto', height: 4,
              background: 'rgba(255,110,140,.32)' }}>
              <div className="progress-fill" style={{ width: `${Math.round(war.frontline * 100)}%` }} />
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              vs. {war.rival.name}
            </p>
          </Link>
        )}

        {/* Kein Clan: Einstieg anbieten */}
        {!profile.clan && (
          <Link href="/clans" className="surface-2"
            style={{ padding: 15, borderRadius: 21, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center justify-between">
              <p style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{t('clan.title')}</p>
              <Icon name="clan" size={16} style={{ color: 'var(--blue-2)' }} />
            </div>
            <p style={{ ...fd, fontSize: 15, fontWeight: 500, marginTop: 6 }}>{t('home.clanJoin')}</p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 'auto', paddingTop: 10 }}>
              {t('home.clanJoinSub')}
            </p>
          </Link>
        )}
      </div>
    </div>
  )
}

function initials(name: string): string {
  const clean = (name || '').replace(/[^\p{L}\p{N} ]/gu, '').trim()
  if (!clean) return '?'
  const words = clean.split(/\s+/)
  // Mehrere Woerter: Anfangsbuchstaben. Ein Wort: erste zwei Buchstaben.
  const s = words.length > 1
    ? words.map(w => w[0]).join('')
    : clean.slice(0, 2)
  return s.slice(0, 2).toUpperCase()
}
