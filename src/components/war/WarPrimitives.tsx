// src/components/war/WarPrimitives.tsx 
// Game-Grade-Bausteine für Clan Wars (Aurora-Design V3):
//   <WarStyles/>   — einmalige Keyframes/Klassen (in WarCard & War-Page gemountet)
//   <Crest/>       — Clan-Wappen (SVG-Schild, Monogramm, Level-Gem, Glow)
//   <VsBadge/>     — VS-Emblem mit rotierendem Energie-Burst
//   <BeamClash/>   — Signature: zwei Energiestrahlen prallen an der Frontlinie
//   <WarTimer/>    — Segment-Countdown (T:H:M), tickt lokal
//   <GameButton/>  — 3D-Button mit Druckkante (violet | gold)
//   <Ribbon/>      — Banner mit gefalteten Enden
//   <Medal/>       — Gold/Silber/Bronze-Medaille
'use client'
import { useEffect, useMemo, useState } from 'react'

/* ── einmalige Styles (idempotent über id) ─────────────────────────── */
export function WarStyles() {
  return (
    <style id="war-styles">{`
      @keyframes warSpin{to{transform:rotate(360deg)}}
      @keyframes warClashPulse{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.25);opacity:1}}
      @keyframes warTwinkle{0%,100%{opacity:.15}50%{opacity:.85}}
      @keyframes warRise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
      @keyframes warConf{0%{transform:translateY(-24px) rotate(0)}100%{transform:translateY(115vh) rotate(320deg);opacity:0}}
      .war-rise{animation:warRise .55s cubic-bezier(0.22,1,0.36,1) both}
      /* Glaskarte — identisch zu .surface aus globals.css */
      .war-plate{position:relative;border-radius:24px;
        background:linear-gradient(150deg,rgba(255,255,255,.16) 0%,rgba(255,255,255,.06) 42%,rgba(255,255,255,.035) 100%);
        backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.28),inset 0 0 0 .5px rgba(255,255,255,.10),0 18px 40px rgba(0,0,0,.45)}
      /* Nieten gibt es im neuen Design nicht mehr */
      .war-rivet{display:none}
      .war-gem{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-display);font-weight:400;font-size:11.5px;
        color:var(--text-secondary);border-radius:999px;padding:0 12px;height:30px;
        background:linear-gradient(150deg,rgba(255,255,255,.13),rgba(255,255,255,.04));
        box-shadow:inset 0 1px 0 rgba(255,255,255,.20),inset 0 0 0 .5px rgba(255,255,255,.07)}
      .war-gem.gold{color:var(--gold)}
      .war-hairline{height:.5px;background:rgba(255,255,255,.09)}
    `}</style>
  )
}

export function Rivets({ gold = false }: { gold?: boolean }) {
  const bg = gold ? { background: 'radial-gradient(circle at 35% 30%,#FEF3C7,#92400E)' } : undefined
  return (<>
    <span className="war-rivet" style={{ top: 9, left: 9, ...bg }} />
    <span className="war-rivet" style={{ top: 9, right: 9, ...bg }} />
    <span className="war-rivet" style={{ bottom: 9, left: 9, ...bg }} />
    <span className="war-rivet" style={{ bottom: 9, right: 9, ...bg }} />
  </>)
}

/* ── Crest — Clan-Wappen ───────────────────────────────────────────── */
export type CrestPalette = 'violet' | 'crimson' | 'gold'
const CREST_COLORS: Record<CrestPalette, { g1: string; g2: string; stroke: string; glow: string }> = {
  violet:  { g1: '#7BA5FF', g2: '#1D4ED8', stroke: 'rgba(255,255,255,.55)', glow: 'rgba(37,99,255,.50)' },
  crimson: { g1: '#FB7185', g2: '#9F1239', stroke: 'rgba(255,255,255,.45)', glow: 'rgba(244,63,94,.40)' },
  gold:    { g1: '#FCD34D', g2: '#B45309', stroke: 'rgba(255,255,255,.60)', glow: 'rgba(245,158,11,.55)' },
}

export function Crest({ name, avatarUrl, level, palette = 'violet', size = 64 }: {
  name: string; avatarUrl?: string | null; level?: number | null
  palette?: CrestPalette; size?: number
}) {
  const c    = CREST_COLORS[palette]
  const mono = (name || '?').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).length > 1
    ? (name || '?').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : (name || '?').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase()

  return (
    <div style={{ position: 'relative', width: size, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        width: size, height: size,
        borderRadius: Math.round(size * 0.30),
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(140deg, ${c.g1}, ${c.g2})`,
        boxShadow: `inset 0 1.5px 0 rgba(255,255,255,.32), 0 10px 26px ${c.glow}`,
      }}>
        {avatarUrl
          ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 500,
              fontSize: Math.round(size * 0.30),
              color: palette === 'gold' ? '#3B2405' : '#fff',
            }}>{mono}</span>}
      </div>

      {level != null && (
        <div style={{
          marginTop: 7,
          fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 9.5,
          whiteSpace: 'nowrap', color: 'var(--text-muted)',
        }}>
          Level {level}
        </div>
      )}
    </div>
  )
}

export function VsBadge({ size = 56 }: { size?: number }) {
  return (
    <div style={{ width: size, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 11,
        letterSpacing: '.14em', color: 'var(--text-muted)',
      }}>VS</span>
    </div>
  )
}

export function BeamClash({ frontline, height = 22, clashSize = 40 }: {
  /** 0..1 — Anteil des eigenen Clans (links, blau) */
  frontline: number; height?: number; clashSize?: number
}) {
  const pct = Math.max(0, Math.min(1, frontline)) * 100
  return (
    <div className="progress-bar" style={{ height: 6, background: 'rgba(255,110,140,.32)' }}>
      <div className="progress-fill" style={{ width: `${pct}%`, transition: 'width .6s var(--ease-out)' }} />
    </div>
  )
}

export function WarTimer({ endsAt, compact = false }: { endsAt: string; compact?: boolean }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const diff = Math.max(0, new Date(endsAt).getTime() - now)
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)

  const seg = (v: number, label: string) => (
    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: compact ? 11 : 12,
      background: 'linear-gradient(180deg,#1E1B36,#12101F)', borderRadius: 8,
      padding: compact ? '4px 6px' : '5px 7px',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.1), inset 0 -2px 4px rgba(0,0,0,.6)',
      color: '#E9D5FE', minWidth: compact ? 26 : 30, textAlign: 'center' }}>
      {v}
      <span style={{ display: 'block', fontSize: 6.5, fontWeight: 700, letterSpacing: '.12em',
        color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
  const col = <span style={{ color: 'var(--text-faint)', fontWeight: 800 }}>:</span>

  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {seg(d, compact ? 'T' : 'TAGE')}{col}{seg(h, compact ? 'H' : 'STD')}{col}{seg(m, compact ? 'M' : 'MIN')}
    </div>
  )
}

/* ── GameButton — 3D-Button mit Druckkante ─────────────────────────── */
export function GameButton({ children, variant = 'violet', onClick, disabled, style }: {
  children: React.ReactNode; variant?: 'violet' | 'gold'
  onClick?: () => void; disabled?: boolean; style?: React.CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={variant === 'gold' ? 'btn-secondary press' : 'btn-primary press'}
      style={{ opacity: disabled ? 0.55 : 1, ...style }}
    >
      {children}
    </button>
  )
}

export function Ribbon({ children }: { children: React.ReactNode }) {
  return (
    <span className="war-gem" style={{ fontSize: 10.5, height: 26 }}>{children}</span>
  )
}

export function Medal({ place, size = 26, children }: {
  place: 1 | 2 | 3 | 'win' | 'draw' | 'loss'; size?: number; children?: React.ReactNode
}) {
  const tone: Record<string, string> = {
    '1': 'var(--gold)', '2': 'var(--text-secondary)', '3': '#FFB27A',
    win: 'var(--emerald)', draw: 'var(--text-secondary)', loss: 'var(--rose)',
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.32), flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: Math.round(size * 0.42),
      color: tone[String(place)] ?? 'var(--text-secondary)',
      background: 'linear-gradient(150deg,rgba(255,255,255,.16),rgba(255,255,255,.05))',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.24), inset 0 0 0 .5px rgba(255,255,255,.08)',
    }}>
      {children ?? (place === 'win' ? '✓' : place === 'draw' ? '=' : place === 'loss' ? '·' : place)}
    </div>
  )
}
