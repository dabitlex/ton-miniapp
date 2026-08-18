// src/app/(game)/vault/page.tsx — VEXALGO 2.0 · Weekly Vault
// Wöchentliche Verlosung ohne Einsatz. Lose entstehen durch Aktivität
// (DB-Trigger), der Jackpot wächst mit jedem ausgegebenen Los.
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useVault }  from '@/features/vault/hooks'

import { useI18n, type DictKey } from '@/lib/i18n'
import { Icon, IconTile, type IconName } from '@/components/ui/Icon'
import type { VaultSource } from '@/lib/constants/vault'

const fd: React.CSSProperties = { fontFamily: 'var(--font-display)' }

const SOURCE_ICON: Record<VaultSource['key'], IconName> = {
  daily_quests:  'quest',
  streak:        'flame',
  ads:           'tv',
  clan_missions: 'target',
  weekly_quest:  'trophy',
}

/** Los-Quellen -> Uebersetzungsschluessel */
const SOURCE_KEY: Record<VaultSource['key'], DictKey> = {
  daily_quests:  'vault.src.dailyQuests',
  streak:        'vault.src.streak',
  ads:           'vault.src.ads',
  clan_missions: 'vault.src.clanMissions',
  weekly_quest:  'vault.src.weeklyQuest',
}

/** Restzeit bis zur Ziehung, aktualisiert sich jede Minute */
function useCountdown(target?: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  if (!target) return null
  const diff = new Date(target).getTime() - now
  if (diff <= 0) return 'gleich'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return d > 0 ? `${d}T ${h}Std` : h > 0 ? `${h}Std ${m}Min` : `${m}Min`
}

const nfFor = (lang: string) => (n: number) =>
  new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US').format(n)

export default function VaultPage() {
  const router = useRouter()
  const { vault, isLoading } = useVault()
  const { t, lang } = useI18n()
  const formatNumber = nfFor(lang)
  const drawIn = useCountdown(vault && vault.state === 'open' ? vault.drawAt : undefined)

  const Header = (
    <div className="flex items-center" style={{ gap: 12, padding: '22px 20px 14px' }}>
      <button onClick={() => router.back()} aria-label="Zurück" className="press"
        style={{ width: 38, height: 38, borderRadius: 13, border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(150deg,rgba(255,255,255,.16),rgba(255,255,255,.05))',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)' }}>
        <Icon name="chevronLeft" size={17} strokeWidth={1.8} />
      </button>
      <h1 style={{ ...fd, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>{t('vault.title')}</h1>
    </div>
  )

  if (isLoading) {
    return (
      <div className="relative z-10">{Header}
        <div style={{ padding: '0 20px' }}>
          <div className="surface" style={{ height: 168, borderRadius: 24, opacity: .5 }} />
          <div className="surface-2" style={{ height: 96, borderRadius: 22, marginTop: 11, opacity: .5 }} />
        </div>
      </div>
    )
  }

  // Feature aus oder keine laufende Runde
  if (!vault || vault.state === 'off' || vault.state === 'result') {
    return (
      <div className="relative z-10">{Header}
        <div style={{ padding: '0 20px' }}>
          <div className="surface-2" style={{ padding: 28, borderRadius: 22, textAlign: 'center' }}>
            <IconTile name="lock" size={52} style={{ margin: '0 auto 14px' }} />
            <p style={{ ...fd, fontSize: 15, fontWeight: 500 }}>{t('vault.resting')}</p>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.45 }}>
              Sobald die nächste Runde läuft, sammelst du hier wieder Lose.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (vault.state === 'idle') {
    return (
      <div className="relative z-10">{Header}
        <div style={{ padding: '0 20px' }}>
          <div className="surface-2" style={{ padding: 28, borderRadius: 22, textAlign: 'center' }}>
            <IconTile name="clock" size={52} style={{ margin: '0 auto 14px' }} />
            <p style={{ ...fd, fontSize: 15, fontWeight: 500 }}>{t('vault.nextMonday')}</p>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
              Die Ziehung der letzten Runde ist durch.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const ticketPct = Math.min(100, (vault.myTickets / vault.maxTickets) * 100)

  return (
    <div className="overflow-y-auto relative z-10" style={{ paddingBottom: 24 }}>
      {Header}

      <div style={{ padding: '0 20px' }}>

        {/* ── Jackpot ─────────────────────────────────────────── */}
        <div className="surface-accent animate-rise" style={{ padding: '24px 20px', textAlign: 'center' }}>
          <p className="eyebrow">{t('vault.jackpot')}</p>
          <p style={{ ...fd, fontSize: 40, fontWeight: 500, letterSpacing: '-0.035em',
            margin: '8px 0 2px', lineHeight: 1 }}>
            {formatNumber(vault.jackpot)}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('vault.jackpotSub')}</p>
          <div className="flex items-center justify-center" style={{ gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <span className="chip" style={{ height: 28 }}>{t('vault.drawIn', { time: drawIn })}</span>
            <span className="chip" style={{ height: 28 }}>{t('vault.winners', { count: 13 })}</span>
          </div>
        </div>

        {/* ── Eigene Lose ─────────────────────────────────────── */}
        <div className="surface-2 animate-rise" style={{ padding: 16, marginTop: 11, animationDelay: '60ms' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center" style={{ gap: 10 }}>
              <Icon name="ticket" size={17} style={{ color: 'var(--blue-2)' }} />
              <p style={{ ...fd, fontSize: 14.5, fontWeight: 500 }}>{t('vault.myTickets')}</p>
            </div>
            <p style={{ ...fd, fontSize: 19, fontWeight: 500 }}>
              {vault.myTickets}<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/{vault.maxTickets}</span>
            </p>
          </div>
          <div className="progress-bar" style={{ marginTop: 12 }}>
            <div className="progress-fill" style={{ width: `${ticketPct}%` }} />
          </div>
          <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 9, textAlign: 'center' }}>
            {vault.oddsOneIn
              ? t('vault.odds', { odds: vault.oddsOneIn, total: formatNumber(vault.totalTickets) })
              : t('vault.odds', { odds: '—', total: formatNumber(vault.totalTickets) })}
          </p>
        </div>

        {/* ── Los-Quellen ─────────────────────────────────────── */}
        <p className="eyebrow" style={{ margin: '20px 2px 11px' }}>{t('vault.sourcesToday')}</p>
        <div className="surface-2" style={{ padding: '3px 16px', borderRadius: 22 }}>
          {vault.sources.map((s, i) => {
            const done = s.earned
            return (
              <div key={s.key}>
                <div className="flex items-center" style={{ gap: 12, padding: '12px 0' }}>
                  <IconTile name={done ? 'check' : SOURCE_ICON[s.key]} size={36}
                    tone={done ? 'var(--emerald)' : undefined} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ ...fd, fontSize: 13.5, fontWeight: 500,
                      color: done ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                      {t(SOURCE_KEY[s.key])}
                    </p>
                    {!done && s.target > 0 && (
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {s.current} / {s.target}
                      </p>
                    )}
                  </div>
                  <span className="chip" style={{ height: 23, fontSize: 10, padding: '0 9px',
                    ...(done ? { color: 'var(--emerald)' } : {}) }}>
                    {done ? t('vault.received', { count: s.tickets }) : `+${s.tickets}`}
                  </span>
                </div>
                {i < vault.sources.length - 1 && <div className="hairline" />}
              </div>
            )
          })}
        </div>

        {/* ── Gewinne ─────────────────────────────────────────── */}
        <p className="eyebrow" style={{ margin: '20px 2px 11px' }}>{t('vault.prizes')}</p>
        <div style={{ display: 'flex', gap: 9 }}>
          {vault.prizes.map((p, i) => (
            <div key={p.rank} className="surface-2"
              style={{ flex: 1, minWidth: 0, padding: '14px 8px', textAlign: 'center', borderRadius: 18 }}>
              <p style={{ fontSize: 15 }}>{['🥇', '🥈', '🥉'][i] ?? '·'}</p>
              <p className="truncate" style={{ ...fd, fontSize: 14, fontWeight: 500, marginTop: 4,
                color: i === 0 ? 'var(--gold)' : 'var(--text-primary)' }}>
                {formatNumber(p.xp)}
              </p>
              <p style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {p.count}× {i === 0 ? (lang === 'de' ? 'Haupt' : '1st')
                  : i === 1 ? (lang === 'de' ? 'Zweit' : '2nd') : (lang === 'de' ? 'Dritt' : '3rd')}
              </p>
            </div>
          ))}
        </div>

        {/* ── Fairness ────────────────────────────────────────── */}
        <div className="flex items-center justify-center" style={{ gap: 7, marginTop: 14 }}>
          <Icon name="lock" size={12} style={{ color: 'var(--text-faint)' }} />
          <p style={{ fontSize: 10, color: 'var(--text-faint)' }}>
            Nachweisbar fair · Seed-Hash {vault.seedHash?.slice(0, 4)}…{vault.seedHash?.slice(-4)}
          </p>
        </div>
      </div>
    </div>
  )
}
