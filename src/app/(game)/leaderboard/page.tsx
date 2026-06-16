// src/app/(game)/leaderboard/page.tsx — Redesigned + Relic Gem + Season Rewards
'use client'
import { useCallback, useRef, forwardRef, useState, useEffect, useLayoutEffect } from 'react'
import { Crown, Gift, X } from 'lucide-react'
import { useLeaderboard }   from '@/features/leaderboard/hooks'
import { useUserStore }     from '@/stores/useUserStore'
import { TelegramAvatar }   from '@/components/layout/GameHeader'
import type { LeaderboardEntry } from '@/types/game'

// ── Season reward tiers (mirrors calc_season_reward SQL) ─────
interface RewardTier { label: string; medal: string; xp: number; min: number; max: number }
const REWARD_TIERS: RewardTier[] = [
  { label: 'Rank 1',       medal: '🥇', xp: 50000, min: 1,   max: 1   },
  { label: 'Rank 2',       medal: '🥈', xp: 35000, min: 2,   max: 2   },
  { label: 'Rank 3',       medal: '🥉', xp: 25000, min: 3,   max: 3   },
  { label: 'Rank 4–10',    medal: '⭐', xp: 15000, min: 4,   max: 10  },
  { label: 'Rank 11–25',   medal: '✨', xp: 8000,  min: 11,  max: 25  },
  { label: 'Rank 26–50',   medal: '✨', xp: 5000,  min: 26,  max: 50  },
  { label: 'Rank 51–100',  medal: '✨', xp: 3000,  min: 51,  max: 100 },
  { label: 'Rank 101–250', medal: '·',  xp: 1500,  min: 101, max: 250 },
  { label: 'Rank 251–500', medal: '·',  xp: 750,   min: 251, max: 500 },
  { label: 'Rank 501+',    medal: '·',  xp: 250,   min: 501, max: Infinity },
]

// ── Relic Crystal — exact same SVG as Boost tab, scaled small ─
const RELIC_CFG: Record<string, { c1: string; c2: string; c3: string; glow: string }> = {
  tier_1:   { c1: '#BCC4FF', c2: '#6E7BFF', c3: '#4A5AE8', glow: 'rgba(110,123,255,0.6)' },
  tier_5:   { c1: '#9CF0FF', c2: '#06B6D4', c3: '#0891B2', glow: 'rgba(6,182,212,0.6)'   },
  tier_20:  { c1: '#D7B3FF', c2: '#A855F7', c3: '#7C3AED', glow: 'rgba(168,85,247,0.6)'  },
  tier_50:  { c1: '#FFD0B3', c2: '#F97316', c3: '#EA580C', glow: 'rgba(249,115,22,0.6)'  },
  tier_100: { c1: '#FFF0C8', c2: '#FBBF24', c3: '#F59E0B', glow: 'rgba(251,191,36,0.7)'  },
}

// Founder-Badge: dauerhaftes Statussymbol für Season-1-Mitglieder (rein kosmetisch).
// Aurora-Stil: Hexagon mit Gold→Violett-Verlauf + Stern.
function FounderBadge({ size = 12 }: { size?: number }) {
  const uid = 'founder-bdg'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0,
      filter: 'drop-shadow(0 0 3px rgba(251,191,36,0.55)) drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>
      <defs>
        <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#FBBF24" />
          <stop offset="55%"  stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      {/* Hexagon-Körper */}
      <path d="M12 1 L21 6.5 L21 17.5 L12 23 L3 17.5 L3 6.5 Z"
            fill={`url(#${uid}-g)`} stroke="#FCD34D" strokeWidth="1" />
      {/* Stern */}
      <path d="M12 6.2 L13.5 10 L17.5 10.2 L14.4 12.7 L15.4 16.6 L12 14.4 L8.6 16.6 L9.6 12.7 L6.5 10.2 L10.5 10 Z"
            fill="#fff" opacity="0.95" />
    </svg>
  )
}

function RelicGem({ tier, size = 14 }: { tier: string; size?: number }) {
  const r = RELIC_CFG[tier]
  if (!r) return null
  const h   = Math.round(size * 1.3)
  const uid = `rg-${tier}`
  return (
    <svg width={size} height={h} viewBox="0 0 60 78" style={{ flexShrink: 0,
      filter: `drop-shadow(0 0 3px ${r.glow}) drop-shadow(0 1px 5px rgba(0,0,0,0.55))` }}>
      <defs>
        <linearGradient id={`${uid}-a`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%"   stopColor={r.c1} />
          <stop offset="55%"  stopColor={r.c2} />
          <stop offset="100%" stopColor={r.c3} />
        </linearGradient>
        <linearGradient id={`${uid}-b`} x1="0" y1="0" x2="1" y2="0.5">
          <stop offset="0%"   stopColor="#fff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Main body */}
      <path d="M30 2 L57 23 L30 76 L3 23 Z" fill={`url(#${uid}-a)`} />
      {/* Left facet — highlight */}
      <path d="M30 2 L3 23 L30 40 Z"  fill="white" opacity="0.22" />
      {/* Right facet — shimmer */}
      <path d="M30 2 L57 23 L30 40 Z" fill={`url(#${uid}-b)`} />
      {/* Bottom-left shadow */}
      <path d="M3 23 L30 40 L30 76 Z" fill="black" opacity="0.14" />
      {/* Center line */}
      <line x1="30" y1="2" x2="30" y2="76" stroke="white" strokeOpacity="0.07" strokeWidth="1" />
      {/* Top sparkle */}
      <circle cx="30" cy="4" r="2.5" fill="white" opacity="0.75" />
    </svg>
  )
}

export default function LeaderboardPage() {
  useUserStore(s => s.profile)
  const league = null // League filter disabled until Season 2
  const [rewardsOpen, setRewardsOpen] = useState(false)

  const { entries, userRank, isLoading, hasMore, refreshedAt, loadMore,
          focusMode, neighbors, total, fetchRange, appendNeighbors, prependNeighbors } =
    useLeaderboard(league)

  // ── Normalmodus: Infinite-Scroll nach unten (wie bisher) ──
  const observerRef = useRef<IntersectionObserver | null>(null)
  const lastItemRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect()
    if (!node || !hasMore) return
    observerRef.current = new IntersectionObserver(
      ([e]) => { if (e?.isIntersecting) loadMore() },
      { threshold: 0.1 }
    )
    observerRef.current.observe(node)
  }, [hasMore, loadMore])

  // ══ Fokus-Modus: feste Podium-Höhe + eigener Scroll-Container mit
  //    bidirektionalem Nachladen (oben + unten) und Scroll-Anker ══
  const focusScrollRef = useRef<HTMLDivElement>(null)
  const upBusy   = useRef(false)
  const downBusy = useRef(false)
  const pendingPrependHeight = useRef<number | null>(null)
  const CHUNK = 10

  // nach oben nachladen (kleinere Ränge Richtung Platz 4)
  const loadUp = useCallback(async () => {
    if (upBusy.current) return
    const first = neighbors[0]
    if (!first || first.rank <= 4) return     // 1-3 stehen im festen Podium
    upBusy.current = true
    const toRank   = first.rank - 1
    const fromRank = Math.max(4, toRank - CHUNK + 1)
    const more = await fetchRange(fromRank, toRank - fromRank + 1)
    if (more.length > 0) {
      // Höhe VOR dem Einfügen merken → useLayoutEffect hält die Position
      pendingPrependHeight.current = focusScrollRef.current?.scrollHeight ?? 0
      prependNeighbors(more)
    }
    upBusy.current = false
  }, [neighbors, fetchRange, prependNeighbors])

  // nach unten nachladen (größere Ränge)
  const loadDown = useCallback(async () => {
    if (downBusy.current) return
    const last = neighbors[neighbors.length - 1]
    if (!last) return
    if (total && last.rank >= total) return   // Ende erreicht
    downBusy.current = true
    const more = await fetchRange(last.rank + 1, CHUNK)
    if (more.length > 0) appendNeighbors(more)
    downBusy.current = false
  }, [neighbors, total, fetchRange, appendNeighbors])

  // Scroll-Anker: nach einem Prepend die Scrollposition halten (kein Springen)
  useLayoutEffect(() => {
    if (pendingPrependHeight.current != null && focusScrollRef.current) {
      const diff = focusScrollRef.current.scrollHeight - pendingPrependHeight.current
      focusScrollRef.current.scrollTop += diff
      pendingPrependHeight.current = null
    }
  }, [neighbors])

  // Scroll-Handler triggert oben/unten nahe den Rändern
  const onFocusScroll = useCallback(() => {
    const el = focusScrollRef.current
    if (!el) return
    if (el.scrollTop < 60) loadUp()
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 60) loadDown()
  }, [loadUp, loadDown])

  // Initial: falls die 5er-Umgebung den Container nicht füllt, einmal nach
  // unten füllen, damit überhaupt gescrollt werden kann.
  useEffect(() => {
    if (!focusMode) return
    const el = focusScrollRef.current
    if (el && el.scrollHeight <= el.clientHeight + 4 && neighbors.length > 0) {
      loadDown()
    }
  }, [focusMode, neighbors, loadDown])

  const podium = entries.slice(0, 3)
  const rest   = entries.slice(3)

  return (
    <div className="flex flex-col h-full relative z-10">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pt-4 pb-2 animate-rise flex items-start justify-between">
        <div>
          <h1 className="display-xl text-[24px] text-white leading-none">Arena</h1>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>Global season rankings</p>
        </div>
        <button
          onClick={() => setRewardsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl press mt-0.5"
          style={{
            fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
            color: 'var(--violet-bright)', background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.25)', whiteSpace: 'nowrap',
          }}>
          <Gift size={13} /> Rewards
        </button>
      </div>

      {/* ── Podium: IMMER fest oben (beide Modi), scrollt nicht mit ── */}
      <div className="shrink-0 px-5">
        {isLoading && entries.length === 0 ? (
          <div className="h-44 shimmer rounded-[26px] mt-2" />
        ) : podium.length > 0 && (
          <>
            <div className="relative mt-1 mb-3">
              <div className="absolute inset-x-6 top-0 h-32 pointer-events-none"
                style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(251,191,36,0.16), transparent 70%)' }} />
              <div className="relative flex items-end justify-center gap-3 pt-4">
                {podium[1] && <PodiumPillar entry={podium[1]} place={2} />}
                {podium[0] && <PodiumPillar entry={podium[0]} place={1} />}
                {podium[2] && <PodiumPillar entry={podium[2]} place={3} />}
              </div>
            </div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex-1 h-px" style={{ background: 'var(--edge-soft)' }} />
              <span className="eyebrow" style={{ color: 'var(--violet-bright)' }}>Rangliste</span>
              <div className="flex-1 h-px" style={{ background: 'var(--edge-soft)' }} />
            </div>
          </>
        )}
      </div>

      {focusMode ? (
        /* ══════════ FOKUS-MODUS (Rang ≥ 8) ══════════
           Liste startet bei der 5er-Umgebung, lädt in beide Richtungen. */
        <div ref={focusScrollRef} onScroll={onFocusScroll}
          className="flex-1 overflow-y-auto px-5 pb-6">
          {neighbors[0] && neighbors[0].rank > 4 && (
            <p className="text-center text-[10px] py-2 eyebrow" style={{ color: 'var(--text-ultra)' }}>
              ↑ nach oben für Platz {Math.max(4, neighbors[0].rank - 1)} …
            </p>
          )}
          <div className="space-y-1.5">
            {neighbors.map((entry) => (
              <EntryRow key={`nb-${entry.userId}`} entry={entry} />
            ))}
          </div>
          {total > 0 && neighbors.length > 0 &&
            neighbors[neighbors.length - 1].rank >= total ? (
            <p className="text-center text-[10px] py-3 eyebrow" style={{ color: 'var(--text-ultra)' }}>
              — Ende der Rangliste —
            </p>
          ) : (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 rounded-full border-2 animate-spin"
                style={{ borderColor: 'rgba(139,92,246,0.3)', borderTopColor: '#A78BFA' }} />
            </div>
          )}
        </div>
      ) : (
        /* ══════════ NORMALMODUS (Top 7) ══════════
           Liste ab Platz 4, normaler Runter-Scroll. Kein Banner. */
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          <div className="space-y-1.5">
            {rest.map((entry, i) => (
              <EntryRow key={entry.userId} entry={entry} ref={i === rest.length - 1 ? lastItemRef : null} />
            ))}
          </div>

          {isLoading && entries.length > 0 && (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 rounded-full border-2 animate-spin"
                style={{ borderColor: 'rgba(139,92,246,0.3)', borderTopColor: '#A78BFA' }} />
            </div>
          )}

          {refreshedAt && (
            <p className="text-center text-[10px] py-3 eyebrow" style={{ color: 'var(--text-ultra)' }}>
              Updated {new Date(refreshedAt).toLocaleTimeString('en-US')}
            </p>
          )}
        </div>
      )}

      {/* ── Season Rewards Sheet ──────────────────────────────── */}
      <RewardsSheet open={rewardsOpen} onClose={() => setRewardsOpen(false)} userRank={userRank} />
    </div>
  )
}

// ── Bottom sheet: full reward tier breakdown ──────────────────
function RewardsSheet({ open, onClose, userRank }: { open: boolean; onClose: () => void; userRank: number | null }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(3,3,8,0.7)', backdropFilter: 'blur(6px)',
          opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.3s',
        }} />
      {/* Sheet */}
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 101,
          maxWidth: 420, margin: '0 auto',
          background: 'linear-gradient(180deg,#16132e,#0c0a1a)',
          borderRadius: '26px 26px 0 0',
          padding: '8px 20px calc(24px + env(safe-area-inset-bottom))',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.34,1.2,0.5,1)',
        }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '8px auto 16px' }} />

        <div className="flex items-center justify-between mb-1">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: '#fff' }}>
            Season Rewards
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)' }}>
            <X size={20} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
          XP added to your Total XP at season end, based on final rank.
        </p>

        {REWARD_TIERS.map((t) => {
          const isYou = userRank != null && userRank >= t.min && userRank <= t.max
          return (
            <div key={t.label}
              className="flex items-center justify-between mb-1.5"
              style={{
                padding: '11px 13px', borderRadius: 13,
                background: isYou
                  ? 'linear-gradient(135deg,rgba(139,92,246,0.2),rgba(91,141,239,0.06))'
                  : 'var(--surface-1)',
                boxShadow: isYou ? 'inset 0 0 0 1px rgba(167,139,250,0.4)' : 'none',
              }}>
              <div className="flex items-center gap-2.5">
                <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{t.medal}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: isYou ? '#fff' : 'var(--text-secondary)' }}>
                  {t.label}
                  {isYou && (
                    <span style={{ fontSize: 8, fontWeight: 800, color: '#C4B5FD', background: 'rgba(167,139,250,0.2)', padding: '2px 6px', borderRadius: 5, marginLeft: 7 }}>
                      YOU · #{userRank}
                    </span>
                  )}
                </span>
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: 'var(--emerald)' }}>
                +{t.xp.toLocaleString()}
              </span>
            </div>
          )
        })}

        <p style={{ fontSize: 10, color: 'var(--text-faint)', textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
          Minimum 500 Season XP required to qualify · Rewards added automatically
        </p>
      </div>
    </>
  )
}

// ── Podium pillar ─────────────────────────────────────────────
function PodiumPillar({ entry, place }: { entry: LeaderboardEntry; place: 1 | 2 | 3 }) {
  const cfg = {
    1: { ring: 'linear-gradient(135deg,#FBBF24,#F59E0B)', glow: 'rgba(251,191,36,0.55)', size: 64, h: 96, label: '#FBBF24' },
    2: { ring: 'linear-gradient(135deg,#D1D5DB,#9CA3AF)', glow: 'rgba(209,213,219,0.4)',  size: 52, h: 74, label: '#D1D5DB' },
    3: { ring: 'linear-gradient(135deg,#E0A06A,#CD7F32)', glow: 'rgba(205,127,50,0.4)',   size: 52, h: 62, label: '#E0A06A' },
  }[place]

  const relicTier = entry.relicTier as string | null

  return (
    <div className="flex flex-col items-center flex-1 max-w-[110px]">
      {place === 1 && <Crown size={20} fill="#FBBF24" style={{ color: '#FBBF24', filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.7))', marginBottom: 2 }} />}
      <div className="rounded-full p-[2.5px] animate-pop" style={{ background: cfg.ring, boxShadow: `0 0 18px ${cfg.glow}` }}>
        <div className="rounded-full p-[2px]" style={{ background: 'var(--bg-void)' }}>
          <TelegramAvatar photoUrl={entry.photoUrl ?? null} firstName={entry.firstName} size={cfg.size} />
        </div>
      </div>
      {/* Name + Relic gem */}
      <div className="flex items-center gap-1 mt-1.5">
        <p className="text-[12px] font-bold truncate max-w-[80px]" style={{ color: 'var(--text-primary)' }}>
          {entry.firstName}
        </p>
        {entry.isFounder && <FounderBadge size={11} />}
        {relicTier && <RelicGem tier={relicTier} size={10} />}
      </div>
      <p className="text-[11px] font-extrabold tabular-nums" style={{ color: cfg.label, fontFamily: 'var(--font-display)' }}>
        {entry.seasonXp.toLocaleString()}
      </p>
      <div className="w-full rounded-t-2xl mt-2 flex items-start justify-center pt-2"
        style={{
          height: cfg.h,
          background: place === 1
            ? 'linear-gradient(180deg, rgba(251,191,36,0.18), rgba(251,191,36,0.02))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.01))',
          boxShadow: 'inset 0 1px 0 var(--edge-light)',
        }}>
        <span className="display-xl text-lg" style={{ color: cfg.label }}>{place}</span>
      </div>
    </div>
  )
}

// ── Entry row ─────────────────────────────────────────────────
const EntryRow = forwardRef<HTMLDivElement, { entry: LeaderboardEntry }>(({ entry }, ref) => {
  const me        = entry.isCurrentUser
  const relicTier = entry.relicTier as string | null

  return (
    <div ref={ref}
      className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl"
      style={{
        background: me ? 'linear-gradient(135deg, rgba(139,92,246,0.16), rgba(91,141,239,0.06))' : 'var(--surface-1)',
        boxShadow: me ? 'inset 0 0 0 1px rgba(167,139,250,0.35)' : 'inset 0 1px 0 var(--edge-soft)',
      }}>

      <span className="w-7 text-center text-[13px] font-extrabold tabular-nums shrink-0"
        style={{ color: me ? 'var(--violet-bright)' : 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
        {entry.rank}
      </span>

      <TelegramAvatar photoUrl={entry.photoUrl ?? null} firstName={entry.firstName} size={36} className="shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold truncate" style={{ color: me ? '#DDD6FE' : 'var(--text-primary)' }}>
            {entry.firstName}
          </span>
          {me && (
            <span className="shrink-0 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md"
              style={{ color: '#C4B5FD', background: 'rgba(167,139,250,0.18)', fontFamily: 'var(--font-display)' }}>
              YOU
            </span>
          )}
          {/* Founder-Badge + Relic gem neben dem Namen */}
          {entry.isFounder && <FounderBadge size={12} />}
          {relicTier && <RelicGem tier={relicTier} size={12} />}
        </div>
        {entry.clanName && (
          <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-faint)' }}>🛡️ {entry.clanName}</p>
        )}
      </div>

      <span className="text-sm font-extrabold tabular-nums shrink-0"
        style={{ color: me ? 'white' : 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
        {entry.seasonXp.toLocaleString()}
      </span>
    </div>
  )
})
EntryRow.displayName = 'EntryRow'
