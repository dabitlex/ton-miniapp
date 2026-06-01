// src/app/(game)/leaderboard/page.tsx
'use client'
import { useCallback, useRef, forwardRef, useEffect } from 'react'
import { Medal, Crown, Trophy } from 'lucide-react'
import { useLeaderboard }   from '@/features/leaderboard/hooks'
import { useUserStore }     from '@/stores/useUserStore'
import type { LeagueTier, LeaderboardEntry } from '@/types/game'

export default function LeaderboardPage() {
  const profile = useUserStore(s => s.profile)

  // Standard: eigene Liga des Nutzers
  const league = null // Liga-Filter deaktiviert bis Saison 2

  const { entries, userRank, userEntry, isLoading, hasMore, refreshedAt, loadMore } =
    useLeaderboard(league)

  const displayRank = userRank
  const rankLabel = 'GLOBAL RANK'
  const showRankBanner = displayRank !== null

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


  return (
    <div className="flex flex-col h-full">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-4 pb-2"
        style={{ background: 'linear-gradient(180deg, rgba(124,58,237,0.06) 0%, transparent 100%)' }}>
        <h1 className="text-xl font-black text-white"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>
          LEADERBOARD
        </h1>
      </div>

      {/* ── Subtitle ─────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pb-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Global Season Rankings
        </p>
      </div>

      {/* ── Your Rank Banner ──────────────────────────────────── */}
      {showRankBanner && (userRank || userEntry) && (
        <div className="shrink-0 mx-4 mt-3 px-4 py-3 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(168,85,247,0.08))',
            border: '1px solid rgba(124,58,237,0.3)',
            boxShadow: '0 4px 20px rgba(124,58,237,0.12)',
          }}>
          <div className="flex items-center justify-between">

            {/* Rank + Liga */}
            <div className="flex items-center gap-3">
              <div>
                <span className="text-[10px] font-bold tracking-widest block"
                  style={{ color: 'rgba(168,85,247,0.6)', fontFamily: 'var(--font-display)' }}>
                  YOUR RANK
                </span>
                <span className="text-2xl font-black"
                  style={{
                    fontFamily: 'var(--font-display)',
                    background: 'linear-gradient(135deg, #A855F7, #3B82F6)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>
                  #{userRank ?? '—'}
                </span>
              </div>

            </div>

            {/* XP */}
            {userEntry && (
              <div className="text-right">
                <p className="text-lg font-black text-white tabular-nums"
                  style={{ fontFamily: 'var(--font-display)' }}>
                  {userEntry.seasonXp.toLocaleString()}
                </p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Season XP
                </p>
              </div>
            )}
          </div>
        </div>
      )}



      {/* ── Entries ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-1.5">
        {isLoading && entries.length === 0 ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl shimmer"
              style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))
        ) : (
          entries.map((entry, i) => (
            <EntryRow
              key={entry.userId}
              entry={entry}
              ref={i === entries.length - 1 ? lastItemRef : null}
            />
          ))
        )}

        {isLoading && entries.length > 0 && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 rounded-full border-2 animate-spin"
              style={{ borderColor: 'rgba(124,58,237,0.3)', borderTopColor: '#A855F7' }} />
          </div>
        )}

        {refreshedAt && (
          <p className="text-center text-[10px] py-2"
            style={{ color: 'rgba(255,255,255,0.15)', fontFamily: 'var(--font-display)',
              letterSpacing: '0.1em' }}>
            UPDATED {new Date(refreshedAt).toLocaleTimeString('en-US')}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Entry Row ─────────────────────────────────────────────────
const EntryRow = forwardRef<HTMLDivElement, { entry: LeaderboardEntry }>(({ entry }, ref) => {
  const MEDAL_ICONS = [
    <Trophy key={0} size={16}
      style={{ color: '#F59E0B', filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.7))' }}
      fill="#F59E0B" />,
    <Medal key={1} size={16}
      style={{ color: '#9CA3AF', filter: 'drop-shadow(0 0 6px rgba(156,163,175,0.6))' }}
      fill="#9CA3AF" />,
    <Medal key={2} size={16}
      style={{ color: '#CD7F32', filter: 'drop-shadow(0 0 6px rgba(205,127,50,0.6))' }}
      fill="#CD7F32" />,
  ]

  const isTop3 = entry.rank <= 3

  // Top 3 Hintergrundfarben
  const top3Bg = isTop3 ? [
    'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))',
    'linear-gradient(135deg, rgba(156,163,175,0.1), rgba(156,163,175,0.03))',
    'linear-gradient(135deg, rgba(205,127,50,0.1), rgba(205,127,50,0.03))',
  ][entry.rank - 1] : null

  const top3Border = isTop3 ? [
    '1px solid rgba(245,158,11,0.25)',
    '1px solid rgba(156,163,175,0.2)',
    '1px solid rgba(205,127,50,0.2)',
  ][entry.rank - 1] : null

  return (
    <div ref={ref}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
      style={{
        background: entry.isCurrentUser
          ? 'linear-gradient(135deg, rgba(124,58,237,0.14), rgba(168,85,247,0.07))'
          : isTop3
          ? top3Bg!
          : 'rgba(255,255,255,0.025)',
        border: entry.isCurrentUser
          ? '1px solid rgba(124,58,237,0.35)'
          : isTop3
          ? top3Border!
          : '1px solid rgba(255,255,255,0.04)',
        boxShadow: isTop3
          ? entry.rank === 1 ? '0 4px 20px rgba(245,158,11,0.1)' : '0 2px 10px rgba(0,0,0,0.15)'
          : 'none',
      }}>

      {/* Rank number — always visible */}
      <div className="w-8 shrink-0 flex items-center justify-center">
        {entry.rank <= 3 ? (
          <div className="flex flex-col items-center gap-0.5">
            {MEDAL_ICONS[entry.rank - 1]}
            <span className="text-[8px] font-black tabular-nums"
              style={{
                color: entry.rank === 1 ? '#F59E0B'
                  : entry.rank === 2 ? '#9CA3AF' : '#CD7F32',
                fontFamily: 'var(--font-display)',
              }}>
              #{entry.rank}
            </span>
          </div>
        ) : (
          <span className="text-xs font-black tabular-nums"
            style={{
              color: entry.isCurrentUser ? 'rgba(168,85,247,0.9)' : 'rgba(255,255,255,0.3)',
              fontFamily: 'var(--font-display)',
            }}>
            #{entry.rank}
          </span>
        )}
      </div>

      {/* Avatar */}
      {entry.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.photoUrl} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0"
          style={{
            boxShadow: entry.isCurrentUser
              ? '0 0 10px rgba(124,58,237,0.5)'
              : isTop3 && entry.rank === 1
              ? '0 0 10px rgba(245,158,11,0.3)'
              : 'none'
          }} />
      ) : (
        <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center
                        text-sm font-black"
          style={{
            background: entry.isCurrentUser
              ? 'linear-gradient(135deg, #7C3AED, #A855F7)'
              : 'rgba(255,255,255,0.07)',
            color: entry.isCurrentUser ? 'white' : 'rgba(255,255,255,0.4)',
          }}>
          {entry.firstName[0]}
        </div>
      )}

      {/* Name + Clan */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold truncate"
            style={{
              color: entry.isCurrentUser
                ? 'rgba(216,180,254,0.95)'
                : isTop3 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.8)'
            }}>
            {entry.firstName}
          </span>
          {entry.isCurrentUser && (
            <span className="shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded"
              style={{
                color: '#A855F7', background: 'rgba(168,85,247,0.15)',
                fontFamily: 'var(--font-display)', letterSpacing: '0.05em',
              }}>
              YOU
            </span>
          )}
        </div>
        {entry.clanName && (
          <p className="text-[10px] truncate mt-0.5"
            style={{ color: 'rgba(255,255,255,0.28)' }}>
            🛡️ {entry.clanName}
          </p>
        )}
      </div>

      {/* XP + League (no Level) */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        <span className="text-sm font-black tabular-nums"
          style={{
            color: entry.isCurrentUser ? 'white' : 'rgba(255,255,255,0.75)',
            fontFamily: 'var(--font-display)',
          }}>
          {entry.seasonXp.toLocaleString()}
        </span>
      </div>
    </div>
  )
})
EntryRow.displayName = 'EntryRow'
