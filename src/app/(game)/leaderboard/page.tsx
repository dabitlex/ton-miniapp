// src/app/(game)/leaderboard/page.tsx — Redesigned + Relic Gem
'use client'
import { useCallback, useRef, forwardRef } from 'react'
import { Crown } from 'lucide-react'
import { useLeaderboard }   from '@/features/leaderboard/hooks'
import { useUserStore }     from '@/stores/useUserStore'
import { TelegramAvatar }   from '@/components/layout/GameHeader'
import type { LeaderboardEntry } from '@/types/game'

// ── Relic Crystal — exact same SVG as Boost tab, scaled small ─
const RELIC_CFG: Record<string, { c1: string; c2: string; c3: string; glow: string }> = {
  tier_1:   { c1: '#BCC4FF', c2: '#6E7BFF', c3: '#4A5AE8', glow: 'rgba(110,123,255,0.6)' },
  tier_5:   { c1: '#9CF0FF', c2: '#06B6D4', c3: '#0891B2', glow: 'rgba(6,182,212,0.6)'   },
  tier_20:  { c1: '#D7B3FF', c2: '#A855F7', c3: '#7C3AED', glow: 'rgba(168,85,247,0.6)'  },
  tier_50:  { c1: '#FFD0B3', c2: '#F97316', c3: '#EA580C', glow: 'rgba(249,115,22,0.6)'  },
  tier_100: { c1: '#FFF0C8', c2: '#FBBF24', c3: '#F59E0B', glow: 'rgba(251,191,36,0.7)'  },
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

  const { entries, userRank, userEntry, isLoading, hasMore, refreshedAt, loadMore } =
    useLeaderboard(league)

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

  const podium = entries.slice(0, 3)
  const rest   = entries.slice(3)

  return (
    <div className="flex flex-col h-full relative z-10">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pt-4 pb-2 animate-rise">
        <h1 className="display-xl text-[24px] text-white leading-none">Arena</h1>
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>Global season rankings</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">

        {/* ── Podium ───────────────────────────────────────────── */}
        {isLoading && entries.length === 0 ? (
          <div className="h-44 shimmer rounded-[26px] mt-2" />
        ) : podium.length > 0 && (
          <div className="relative mt-1 mb-4 animate-rise" style={{ animationDelay: '40ms' }}>
            <div className="absolute inset-x-6 top-0 h-32 pointer-events-none"
              style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(251,191,36,0.16), transparent 70%)' }} />
            <div className="relative flex items-end justify-center gap-3 pt-4">
              {podium[1] && <PodiumPillar entry={podium[1]} place={2} />}
              {podium[0] && <PodiumPillar entry={podium[0]} place={1} />}
              {podium[2] && <PodiumPillar entry={podium[2]} place={3} />}
            </div>
          </div>
        )}

        {/* ── Your rank banner ─────────────────────────────────── */}
        {(userRank || userEntry) && (
          <div className="surface-accent p-4 mb-4 animate-rise" style={{ animationDelay: '80ms' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl"
                  style={{ background: 'var(--surface-2)', boxShadow: 'inset 0 1px 0 var(--edge-light)' }}>
                  <span className="display-xl text-[18px] gradient-text leading-none">#{userRank ?? '—'}</span>
                </div>
                <div>
                  <p className="eyebrow" style={{ color: 'var(--violet-bright)' }}>Your rank</p>
                  <p className="text-[12px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Global leaderboard</p>
                </div>
              </div>
              {userEntry && (
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Relic gem in YOUR RANK banner */}
                    {(userEntry as any).relicTier && (
                      <RelicGem tier={(userEntry as any).relicTier} size={13} />
                    )}
                    <p className="display text-[19px] text-white tabular-nums">{userEntry.seasonXp.toLocaleString()}</p>
                  </div>
                  <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>Season XP</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Ranked list ──────────────────────────────────────── */}
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
    </div>
  )
}

// ── Podium pillar ─────────────────────────────────────────────
function PodiumPillar({ entry, place }: { entry: LeaderboardEntry; place: 1 | 2 | 3 }) {
  const cfg = {
    1: { ring: 'linear-gradient(135deg,#FBBF24,#F59E0B)', glow: 'rgba(251,191,36,0.55)', size: 64, h: 96, label: '#FBBF24' },
    2: { ring: 'linear-gradient(135deg,#D1D5DB,#9CA3AF)', glow: 'rgba(209,213,219,0.4)',  size: 52, h: 74, label: '#D1D5DB' },
    3: { ring: 'linear-gradient(135deg,#E0A06A,#CD7F32)', glow: 'rgba(205,127,50,0.4)',   size: 52, h: 62, label: '#E0A06A' },
  }[place]

  const relicTier = (entry as any).relicTier as string | null

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
  const relicTier = (entry as any).relicTier as string | null

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
          {/* Relic gem neben dem Namen */}
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
