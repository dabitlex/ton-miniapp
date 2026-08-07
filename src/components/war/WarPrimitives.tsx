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
      @keyframes warClashPulse{0%,100%{transform:scale(1);opacity:.95}50%{transform:scale(1.3);opacity:1}}
      @keyframes warTwinkle{0%,100%{opacity:.15}50%{opacity:.85}}
      @keyframes warRise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
      @keyframes warConf{0%{transform:translateY(-24px) rotate(0)}100%{transform:translateY(115vh) rotate(320deg);opacity:0}}
      .war-rise{animation:warRise .55s cubic-bezier(0.22,1,0.36,1) both}
      .war-plate{position:relative;border-radius:20px;
        background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.028) 60%);
        box-shadow:inset 0 1.5px 0 rgba(255,255,255,.14),inset 0 0 0 1px rgba(255,255,255,.05),0 10px 28px rgba(0,0,0,.5)}
      .war-rivet{position:absolute;width:5px;height:5px;border-radius:50%;
        background:radial-gradient(circle at 35% 30%,#C4B5FD,#4C1D95);box-shadow:0 0 5px rgba(167,139,250,.6)}
      .war-gem{display:inline-flex;align-items:center;gap:5px;font-family:var(--font-display);font-weight:800;font-size:11px;
        color:#DDD6FE;background:rgba(139,92,246,.14);border-radius:999px;padding:4px 10px;
        box-shadow:inset 0 0 0 1px rgba(167,139,250,.3)}
      .war-gem.gold{color:#FDE68A;background:rgba(251,191,36,.12);box-shadow:inset 0 0 0 1px rgba(251,191,36,.3)}
      .war-hairline{height:1px;background:var(--border)}
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
  violet:  { g1: '#7C3AED', g2: '#312E81', stroke: '#C4B5FD', glow: 'rgba(139,92,246,.55)' },
  crimson: { g1: '#BE123C', g2: '#4C0519', stroke: '#FDA4AF', glow: 'rgba(225,29,72,.45)'  },
  gold:    { g1: '#FDE68A', g2: '#92400E', stroke: '#FEF3C7', glow: 'rgba(251,191,36,.7)'  },
}

export function Crest({ name, avatarUrl, level, palette = 'violet', size = 64 }: {
  name: string; avatarUrl?: string | null; level?: number | null
  palette?: CrestPalette; size?: number
}) {
  const c    = CREST_COLORS[palette]
  const gid  = useMemo(() => `crest-${palette}-${Math.random().toString(36).slice(2, 8)}`, [palette])
  const mono = (name || '?').replace(/[^\p{L}\p{N} ]/gu, '').split(' ')
    .map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const h = Math.round(size * 52 / 46)

  return (
    <div style={{ position: 'relative', width: size, height: h,
      filter: `drop-shadow(0 0 ${Math.round(size / 3)}px ${c.glow}) drop-shadow(0 8px 16px rgba(0,0,0,.5))` }}>
      <svg width={size} height={h} viewBox="0 0 46 52" style={{ display: 'block' }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c.g1} />
            {palette === 'gold' && <stop offset=".5" stopColor="#F59E0B" />}
            <stop offset="1" stopColor={c.g2} />
          </linearGradient>
          {avatarUrl && (
            <clipPath id={`${gid}-clip`}>
              <path d="M23 4L41 10v16.5c0 11-7.6 17.8-18 21.4C12.6 44.3 5 37.5 5 26.5V10z" />
            </clipPath>
          )}
        </defs>
        <path d="M23 1L44 8v18c0 13-9 21-21 25C11 47 2 39 2 26V8z"
          fill={`url(#${gid})`} stroke={c.stroke} strokeWidth="1.6" />
        {avatarUrl && (
          <image href={avatarUrl} x="3" y="2" width="40" height="46"
            preserveAspectRatio="xMidYMid slice" clipPath={`url(#${gid}-clip)`} opacity="0.92" />
        )}
        <path d="M23 5L40 10.5V26c0 10.5-7.2 17-17 20.5C13.2 43 6 36.5 6 26V10.5z"
          fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1" />
      </svg>
      {!avatarUrl && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: Math.round(size * 0.33),
          color: palette === 'gold' ? '#451A03' : '#F5F3FF',
          textShadow: palette === 'gold' ? '0 1px 1px rgba(255,255,255,.45)' : '0 2px 4px rgba(0,0,0,.6)' }}>
          {mono}
        </div>
      )}
      {level != null && (
        <div style={{ position: 'absolute', left: '50%', bottom: -7, transform: 'translateX(-50%)',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 9, whiteSpace: 'nowrap',
          color: palette === 'crimson' ? '#4C0519' : '#1E1B4B',
          background: palette === 'crimson'
            ? 'linear-gradient(180deg,#FECDD3,#FB7185)' : 'linear-gradient(180deg,#FDE68A,#F59E0B)',
          borderRadius: 999, padding: '2.5px 8px',
          boxShadow: '0 2px 6px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.6)' }}>
          LV {level}
        </div>
      )}
    </div>
  )
}

/* ── VsBadge ───────────────────────────────────────────────────────── */
export function VsBadge({ size = 56 }: { size?: number }) {
  const core = Math.round(size * 0.75)
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
        animation: 'warSpin 14s linear infinite', filter: 'blur(.4px)',
        background: 'conic-gradient(from 0deg,transparent 0deg,rgba(196,181,253,.55) 8deg,transparent 16deg,transparent 45deg,rgba(253,164,175,.5) 53deg,transparent 61deg,transparent 98deg,rgba(196,181,253,.45) 106deg,transparent 114deg,transparent 143deg,rgba(253,164,175,.4) 151deg,transparent 159deg,transparent 188deg,rgba(196,181,253,.5) 196deg,transparent 204deg,transparent 233deg,rgba(253,164,175,.45) 241deg,transparent 249deg,transparent 278deg,rgba(196,181,253,.4) 286deg,transparent 294deg,transparent 323deg,rgba(253,164,175,.5) 331deg,transparent 339deg)' }} />
      <div style={{ position: 'relative', width: core, height: core, borderRadius: 12,
        transform: 'rotate(-8deg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontWeight: 800, fontStyle: 'italic',
        fontSize: Math.round(size * 0.3), color: '#fff',
        background: 'linear-gradient(155deg,#312E81,#0F0A24)',
        boxShadow: '0 0 0 2px rgba(233,213,255,.5), 0 0 26px rgba(167,139,250,.7), inset 0 2px 0 rgba(255,255,255,.25)',
        textShadow: '0 0 12px rgba(196,181,253,.9)' }}>
        VS
      </div>
    </div>
  )
}

/* ── BeamClash — Signature-Element ─────────────────────────────────── */
export function BeamClash({ frontline, height = 22, clashSize = 40 }: {
  /** 0..1 — Anteil des eigenen Clans (links, violett) */
  frontline: number; height?: number; clashSize?: number
}) {
  const f     = Math.min(0.94, Math.max(0.06, frontline))
  const left  = Math.max(0.04, f - 0.015)      // kleine Lücke an der Front
  const right = Math.max(0.04, 1 - f - 0.015)
  return (
    <div style={{ position: 'relative', height, margin: '0 4px',
      filter: 'drop-shadow(0 4px 14px rgba(0,0,0,.5))' }}>
      <div style={{ position: 'absolute', inset: '2px 0', borderRadius: 99,
        background: 'linear-gradient(180deg,#0B0918,#161028)',
        boxShadow: 'inset 0 2px 5px rgba(0,0,0,.8), inset 0 0 0 1px rgba(255,255,255,.06)' }} />
      <div style={{ position: 'absolute', top: 4, bottom: 4, left: 3,
        width: `calc(${(left * 100).toFixed(2)}% - 3px)`, borderRadius: '99px 0 0 99px',
        background: 'linear-gradient(90deg,#6D28D9,#8B5CF6 55%,#C4B5FD 96%)',
        clipPath: 'polygon(0 0,96% 0,100% 28%,94% 52%,100% 74%,95% 100%,0 100%)',
        boxShadow: '0 0 20px rgba(139,92,246,.8), inset 0 2px 0 rgba(255,255,255,.35)',
        transition: 'width .8s cubic-bezier(0.22,1,0.36,1)' }} />
      <div style={{ position: 'absolute', top: 4, bottom: 4, right: 3,
        width: `calc(${(right * 100).toFixed(2)}% - 3px)`, borderRadius: '0 99px 99px 0',
        background: 'linear-gradient(270deg,#BE123C,#F43F5E 55%,#FDA4AF 96%)',
        clipPath: 'polygon(4% 0,100% 0,100% 100%,5% 100%,0 70%,6% 48%,0 26%)',
        boxShadow: '0 0 20px rgba(244,63,94,.6), inset 0 2px 0 rgba(255,255,255,.3)',
        transition: 'width .8s cubic-bezier(0.22,1,0.36,1)' }} />
      <div style={{ position: 'absolute', top: '50%', left: `${(f * 100).toFixed(2)}%`,
        transform: 'translate(-50%,-50%)', width: clashSize, height: clashSize,
        pointerEvents: 'none', transition: 'left .8s cubic-bezier(0.22,1,0.36,1)' }}>
        <div style={{ position: 'absolute', inset: -6, borderRadius: '50%',
          animation: 'warSpin 5s linear infinite', filter: 'blur(.5px)',
          background: 'conic-gradient(from 20deg,transparent 0 10deg,rgba(255,255,255,.8) 12deg 14deg,transparent 16deg 80deg,rgba(255,255,255,.7) 82deg 84deg,transparent 86deg 170deg,rgba(255,255,255,.75) 172deg 174deg,transparent 176deg 260deg,rgba(255,255,255,.7) 262deg 264deg,transparent 266deg)' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
          animation: 'warClashPulse 1.6s ease-in-out infinite',
          background: 'radial-gradient(circle,#fff 0%,#E9D5FF 22%,rgba(167,139,250,.55) 45%,transparent 70%)' }} />
      </div>
    </div>
  )
}

/* ── WarTimer — Segment-Countdown, tickt lokal ─────────────────────── */
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
  const violet = {
    background: 'linear-gradient(180deg,#A78BFA 0%,#8B5CF6 40%,#6D28D9 100%)',
    boxShadow:  '0 5px 0 #4C1D95, 0 14px 30px rgba(124,58,237,.45), inset 0 2px 0 rgba(255,255,255,.4), inset 0 -3px 6px rgba(46,16,101,.5)',
    color: '#fff', textShadow: '0 1.5px 2px rgba(0,0,0,.45)',
  }
  const gold = {
    background: 'linear-gradient(180deg,#FDE68A 0%,#F59E0B 45%,#B45309 100%)',
    boxShadow:  '0 5px 0 #78350F, 0 14px 30px rgba(245,158,11,.4), inset 0 2px 0 rgba(255,255,255,.55), inset 0 -3px 6px rgba(120,53,15,.5)',
    color: '#451A03', textShadow: '0 1px 1px rgba(255,255,255,.35)',
  }
  return (
    <button onClick={onClick} disabled={disabled} className="press"
      style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, width: '100%', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14.5,
        letterSpacing: '.02em', border: 'none', borderRadius: 18, padding: 15, cursor: 'pointer',
        opacity: disabled ? 0.55 : 1,
        ...(variant === 'gold' ? gold : violet), ...style }}>
      <span aria-hidden style={{ position: 'absolute', left: '8%', right: '8%', top: 3, height: '42%',
        borderRadius: 14, pointerEvents: 'none',
        background: 'linear-gradient(180deg,rgba(255,255,255,.32),rgba(255,255,255,0))' }} />
      {children}
    </button>
  )
}

/* ── Ribbon — Banner mit gefalteten Enden ──────────────────────────── */
export function Ribbon({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', margin: '2px 0 12px' }}>
      <span aria-hidden style={{ position: 'absolute', top: 6, left: 'calc(50% - 96px)', width: 34, height: 22,
        background: 'linear-gradient(180deg,#4C1D95,#2E1065)', transform: 'skewY(-14deg)' }} />
      <span aria-hidden style={{ position: 'absolute', top: 6, right: 'calc(50% - 96px)', width: 34, height: 22,
        background: 'linear-gradient(180deg,#4C1D95,#2E1065)', transform: 'skewY(14deg)' }} />
      <div style={{ position: 'relative', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11,
        letterSpacing: '.24em', color: '#EDE9FE',
        background: 'linear-gradient(180deg,#7C3AED,#5B21B6)', padding: '8px 26px',
        clipPath: 'polygon(10px 0,calc(100% - 10px) 0,100% 50%,calc(100% - 10px) 100%,10px 100%,0 50%)',
        boxShadow: '0 6px 20px rgba(124,58,237,.45)', textShadow: '0 1px 2px rgba(0,0,0,.5)' }}>
        {children}
      </div>
    </div>
  )
}

/* ── Medal ─────────────────────────────────────────────────────────── */
export function Medal({ place, size = 26, children }: {
  place: 1 | 2 | 3 | 'win' | 'loss'; size?: number; children?: React.ReactNode
}) {
  const styles: Record<string, React.CSSProperties> = {
    1:    { background: 'radial-gradient(circle at 35% 28%,#FEF3C7,#F59E0B 60%,#92400E)', color: '#451A03',
            boxShadow: '0 0 14px rgba(251,191,36,.55), inset 0 1px 0 rgba(255,255,255,.7)' },
    2:    { background: 'radial-gradient(circle at 35% 28%,#F8FAFC,#94A3B8 60%,#475569)', color: '#1E293B',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.8)' },
    3:    { background: 'radial-gradient(circle at 35% 28%,#FDBA74,#C2410C 65%,#7C2D12)', color: '#431407',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5)' },
    win:  { background: 'radial-gradient(circle at 35% 28%,#FEF3C7,#F59E0B 60%,#92400E)', color: '#451A03',
            boxShadow: '0 0 14px rgba(251,191,36,.55), inset 0 1px 0 rgba(255,255,255,.7)' },
    loss: { background: 'radial-gradient(circle at 35% 28%,#FDA4AF,#9F1239 65%)', color: '#FFE4E6',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)' },
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800,
      fontSize: Math.round(size * 0.42), flexShrink: 0, ...styles[String(place)] }}>
      {children ?? (place === 'win' ? '✓' : place === 'loss' ? '✕' : place)}
    </div>
  )
}
