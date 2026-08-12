// src/app/(game)/home/page.tsx — VEXALGO 2.0
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUserStore }        from '@/stores/useUserStore'
import { useLeaderboardStore } from '@/stores/useLeaderboardStore'
import { useEnergy, useStreak } from '@/features/hooks'
import { useClanWar }          from '@/features/war/hooks'
import { useVault }            from '@/features/vault/hooks'
import { formatNumber }        from '@/lib/utils'
import { xpForLevel, GAME_CONSTANTS } from '@/lib/constants/game'
import { Icon, IconTile }      from '@/components/ui/Icon'

const fd: React.CSSProperties = { fontFamily: 'var(--font-display)' }

/* ── Info-Banner: feste Inhalte, spaeter aus einer announcements-Tabelle ── */
interface Banner { tag: string; tone: string; title: string; body: string; cta: string; href: string; logo?: boolean }

export default function HomePage() {
  const profile  = useUserStore(s => s.profile)
  const userRank = useLeaderboardStore(s => s.userRank)
  const energy   = useEnergy()
  const { streakCurrent, streakLongest, canClaim, isClaiming, claimStreak } = useStreak()
  const { war }  = useClanWar()
  const { vault } = useVault()

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
    { tag: 'UPDATE', tone: 'var(--emerald)', title: 'VEXALGO 2.0\nist da',
      body: 'Komplett neues Design', cta: 'Was ist neu', href: '/quests', logo: true },
  ]
  if (vault?.state === 'open') {
    banners.push({ tag: 'NEU', tone: 'var(--emerald)', title: 'Weekly Vault',
      body: 'Lose sammeln · Ziehung Sonntag', cta: 'Mehr erfahren', href: '/vault' })
  }
  if (war?.state === 'live') {
    banners.push({ tag: 'KRIEG', tone: 'var(--rose)', title: 'Clan War läuft',
      body: `Dein Cap heute: ${formatNumber(war.myContribution.today)}/${formatNumber(war.myContribution.dailyCap)}`,
      cta: 'Zum Schlachtfeld', href: '/clans/war' })
  }
  if (seasonDaysLeft !== null) {
    banners.push({ tag: 'SEASON', tone: 'var(--gold)', title: `Season ${profile?.season?.number ?? 2} · ${seasonDaysLeft} Tage`,
      body: 'Top 10 erhalten Bonus-XP', cta: 'Rangliste ansehen', href: '/leaderboard' })
  }

  const [bIdx, setBIdx] = useState(0)
  useEffect(() => {
    if (banners.length < 2) return
    const t = setInterval(() => setBIdx(i => (i + 1) % banners.length), 4500)
    return () => clearInterval(t)
  }, [banners.length])

  if (!profile) return null

  return (
    <div className="flex flex-col min-h-full relative z-10" style={{ padding: '24px 20px 18px' }}>

      {/* ── Kopfzeile ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Willkommen zurück</p>
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
            <p className="eyebrow">Season XP</p>
            <p style={{ ...fd, fontSize: 30, fontWeight: 500, letterSpacing: '-0.035em', margin: '5px 0 0', lineHeight: 1 }}>
              {formatNumber(profile.seasonXp)}
            </p>
            <div className="flex items-center" style={{ gap: 9, marginTop: 10, flexWrap: 'wrap' }}>
              {profile.xpEarnedToday > 0 && (
                <span style={{ fontSize: 10.5, color: 'var(--emerald)' }}>
                  ▲ {formatNumber(profile.xpEarnedToday)}
                </span>
              )}
              {userRank && (<>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,.22)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Rang #{userRank}</span>
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
          Noch {formatNumber(xpToNext)} XP bis Level {Math.min(profile.level + 1, 30)}
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
              +1 · {minsToNext}m
            </p>
          )}
        </div>
      </div>

      {/* ── Schnellzugriff ────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
        <Link href="/quests"><IconTile name="quest" size={56} active /></Link>
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
            <p style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Streak</p>
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
                {isClaiming ? 'Wird geholt…' : `Tag ${streakCurrent + 1} abholen`}
              </p>
              <Icon name="chevronRight" size={13} strokeWidth={2} style={{ color: 'var(--blue-2)' }} />
            </div>
          ) : (
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 'auto', paddingTop: 11, position: 'relative' }}>
              ✓ Heute abgeholt{streakLongest > 0 ? ` · Best ${streakLongest}` : ''}
            </p>
          )}
        </button>

        {/* Info-Karussell */}
        <Link href={banners[bIdx]?.href ?? '/quests'} className="surface-2"
          style={{ padding: 0, borderRadius: 21, position: 'relative', overflow: 'hidden', minWidth: 0, display: 'block' }}>
          <div style={{ display: 'flex', transition: 'transform .55s cubic-bezier(.4,0,.2,1)',
            transform: `translateX(-${bIdx * 100}%)`, height: '100%' }}>
            {banners.map((b, i) => (
              <div key={i} style={{ minWidth: '100%', padding: 15, display: 'flex',
                flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
                {b.logo && (
                  <img src="/icon-mark.png" alt="" aria-hidden
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
            <div style={{ position: 'absolute', bottom: 11, right: 14, display: 'flex', gap: 4 }}>
              {banners.map((_, i) => (
                <span key={i} style={{ width: 5, height: 5, borderRadius: '50%',
                  background: i === bIdx ? 'linear-gradient(135deg,#7BA5FF,#2563FF)' : 'rgba(255,255,255,.14)' }} />
              ))}
            </div>
          )}
        </Link>

        {/* Weekly Vault */}
        {vault?.state === 'open' && (
          <Link href="/vault" className="surface-accent"
            style={{ padding: 15, borderRadius: 21, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center justify-between">
              <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,.62)', whiteSpace: 'nowrap' }}>Weekly Vault</p>
              <Icon name="lock" size={16} style={{ color: 'rgba(255,255,255,.8)' }} />
            </div>
            <p style={{ ...fd, fontSize: 23, fontWeight: 500, marginTop: 3 }}>{formatNumber(vault.jackpot)}</p>
            <div className="flex items-center" style={{ gap: 6, marginTop: 11 }}>
              <Icon name="ticket" size={13} style={{ color: 'rgba(255,255,255,.7)' }} />
              <p style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>{vault.myTickets} Lose</p>
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 'auto', paddingTop: 10, whiteSpace: 'nowrap' }}>
              Ziehung {new Date(vault.drawAt).toLocaleDateString('de-DE', { weekday: 'short' })} 21:00
            </p>
          </Link>
        )}

        {/* Clan War */}
        {war?.state === 'live' && (
          <Link href="/clans/war" className="surface-2"
            style={{ padding: 15, borderRadius: 21, position: 'relative', minWidth: 0,
              display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center justify-between">
              <p style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Clan War</p>
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
                  {formatNumber(war.myClan.perCapita)}
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
                  {formatNumber(war.rival.perCapita)}
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
              <p style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Clan</p>
              <Icon name="clan" size={16} style={{ color: 'var(--blue-2)' }} />
            </div>
            <p style={{ ...fd, fontSize: 15, fontWeight: 500, marginTop: 6 }}>Clan beitreten</p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 'auto', paddingTop: 10 }}>
              Clan Wars, Missionen und XP im Team
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
