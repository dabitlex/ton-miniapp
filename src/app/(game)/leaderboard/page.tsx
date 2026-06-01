// src/app/(game)/leaderboard/page.tsx
'use client'
import { useState, useCallback, useRef, forwardRef } from 'react'
import { useLeaderboard }   from '@/features/leaderboard/hooks'
import { LeagueBadge }      from '@/components/game/LeagueBadge'
import { LevelBadge }       from '@/components/game/LevelBadge'
import { cn, formatNumber } from '@/lib/utils'
import type { LeagueTier, LeaderboardEntry } from '@/types/game'

const LEAGUES = [
  { key: null,        label: 'Global',   icon: '🌍' },
  { key: 'legendary', label: 'Legend',   icon: '👑' },
  { key: 'diamond',   label: 'Diamond',  icon: '💠' },
  { key: 'platinum',  label: 'Platinum', icon: '💎' },
  { key: 'gold',      label: 'Gold',     icon: '🥇' },
  { key: 'silver',    label: 'Silver',   icon: '🥈' },
  { key: 'bronze',    label: 'Bronze',   icon: '🥉' },
] as const

export default function LeaderboardPage() {
  const [league, setLeague] = useState<LeagueTier | null>(null)
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

      {/* ── League Filter ─────────────────────────────────────── */}
      <div className="shrink-0 flex gap-2 px-4 py-2.5 overflow-x-auto [scrollbar-width:none]"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {LEAGUES.map(({ key, label, icon }) => {
          const active = league === key
          return (
            <button key={key ?? 'global'} onClick={() => setLeague(key as LeagueTier | null)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                         text-xs font-bold transition-all duration-200 active:scale-95"
              style={{
                background: active
                  ? 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(168,85,247,0.12))'
                  : 'rgba(255,255,255,0.04)',
                border: active
                  ? '1px solid rgba(124,58,237,0.45)'
                  : '1px solid rgba(255,255,255,0.07)',
                color: active ? 'rgba(216,180,254,0.95)' : 'rgba(255,255,255,0.4)',
                boxShadow: active ? '0 0 16px rgba(124,58,237,0.2)' : 'none',
                fontFamily: 'var(--font-display)', letterSpacing: '0.03em',
              }}>
              <span>{icon}</span>
              {label}
            </button>
          )
        })}
      </div>

      {/* ── Your Rank Banner ──────────────────────────────────── */}
      {(userRank || userEntry) && (
        <div className="shrink-0 mx-4 mt-3 px-4 py-3 rounded-2xl flex items-center justify-between"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(168,85,247,0.08))',
            border: '1px solid rgba(124,58,237,0.3)',
            boxShadow: '0 4px 20px rgba(124,58,237,0.12)',
          }}>
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold tracking-widest"
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
          {userEntry && (
            <div className="text-right">
              <p className="text-lg font-black text-white tabular-nums">
                {formatNumber(userEntry.seasonXp)}
              </p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Season XP</p>
            </div>
          )}
        </div>
      )}

      {/* ── Entries ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6 space-y-1.5">
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
            UPDATED {new Date(refreshedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  )
}

const EntryRow = forwardRef<HTMLDivElement, { entry: LeaderboardEntry }>(({ entry }, ref) => {
  const MEDALS = ['🥇', '🥈', '🥉']
  const isTop3 = entry.rank <= 3

  return (
    <div ref={ref}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
      style={{
        background: entry.isCurrentUser
          ? 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(168,85,247,0.06))'
          : 'rgba(255,255,255,0.025)',
        border: entry.isCurrentUser
          ? '1px solid rgba(124,58,237,0.3)'
          : '1px solid rgba(255,255,255,0.04)',
        boxShadow: isTop3 ? '0 2px 12px rgba(0,0,0,0.15)' : 'none',
      }}>

      {/* Rank */}
      <div className="w-7 text-center shrink-0">
        {entry.rank <= 3 ? (
          <span className="text-base">{MEDALS[entry.rank - 1]}</span>
        ) : (
          <span className="text-xs font-black tabular-nums"
            style={{
              color: entry.isCurrentUser ? 'rgba(168,85,247,0.8)' : 'rgba(255,255,255,0.25)',
              fontFamily: 'var(--font-display)',
            }}>
            {entry.rank}
          </span>
        )}
      </div>

      {/* Avatar */}
      {entry.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.photoUrl} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0"
          style={{ boxShadow: entry.isCurrentUser ? '0 0 10px rgba(124,58,237,0.4)' : 'none' }} />
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

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold truncate"
            style={{ color: entry.isCurrentUser ? 'rgba(216,180,254,0.95)' : 'rgba(255,255,255,0.85)' }}>
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
          <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.28)' }}>
            🛡️ {entry.clanName}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        <span className="text-sm font-black tabular-nums"
          style={{
            color: entry.isCurrentUser ? 'white' : 'rgba(255,255,255,0.75)',
            fontFamily: 'var(--font-display)',
          }}>
          {formatNumber(entry.seasonXp)}
        </span>
        <div className="flex items-center gap-1">
          <LevelBadge level={entry.level} />
          <LeagueBadge league={entry.league} compact />
        </div>
      </div>
    </div>
  )
})
EntryRow.displayName = 'EntryRow'
