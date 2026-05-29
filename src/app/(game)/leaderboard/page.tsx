// src/app/(game)/leaderboard/page.tsx 
'use client'
import { useState, useCallback, useRef } from 'react'
import { useLeaderboard }    from '@/features/leaderboard/hooks'
import { LeagueBadge }       from '@/components/game/LeagueBadge'
import { LevelBadge }        from '@/components/game/LevelBadge'
import { Skeleton }          from '@/components/ui/Skeleton'
import { cn, formatNumber }  from '@/lib/utils'
import type { LeagueTier, LeaderboardEntry } from '@/types/game'

const LEAGUES: Array<{ key: LeagueTier | null; label: string; icon: string }> = [
  { key: null,        label: 'Global',    icon: '🌍' },
  { key: 'legendary', label: 'Legend',    icon: '👑' },
  { key: 'diamond',   label: 'Diamond',   icon: '💠' },
  { key: 'platinum',  label: 'Platinum',  icon: '💎' },
  { key: 'gold',      label: 'Gold',      icon: '🥇' },
  { key: 'silver',    label: 'Silver',    icon: '🥈' },
  { key: 'bronze',    label: 'Bronze',    icon: '🥉' },
]

export default function LeaderboardPage() {
  const [league, setLeague] = useState<LeagueTier | null>(null)
  const { entries, userRank, userEntry, isLoading, hasMore, refreshedAt, loadMore } =
    useLeaderboard(league)

  const observerRef = useRef<IntersectionObserver | null>(null)
  const lastItemRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect()
    if (!node || !hasMore) return
    observerRef.current = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) loadMore()
    }, { threshold: 0.1 })
    observerRef.current.observe(node)
  }, [hasMore, loadMore])

  return (
    <div className="flex flex-col h-full">
      {/* League filter scroll */}
      <div className="shrink-0 flex gap-2 px-4 py-2 overflow-x-auto
                      [scrollbar-width:none] border-b border-white/[0.05]">
        {LEAGUES.map(({ key, label, icon }) => (
          <button
            key={key ?? 'global'}
            onClick={() => setLeague(key)}
            className={cn(
              'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold',
              'border transition-all',
              league === key
                ? 'bg-violet-500/20 border-violet-500/40 text-violet-200'
                : 'bg-white/[0.04] border-white/[0.06] text-white/50'
            )}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* User rank banner */}
      {(userRank || userEntry) && (
        <div className="shrink-0 mx-4 mt-3 rounded-2xl border border-violet-500/25
                        bg-violet-500/[0.07] px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-violet-400 font-black text-lg">#{userRank ?? '—'}</span>
            <span className="text-xs text-white/50">Your rank</span>
          </div>
          {userEntry && (
            <span className="text-sm font-bold text-violet-200 tabular-nums">
              {formatNumber(userEntry.seasonXp)} XP
            </span>
          )}
        </div>
      )}

      {/* Entries list */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6 space-y-1.5">
        {isLoading && entries.length === 0 ? (
          Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="w-7 h-4 rounded" />
              <Skeleton className="w-9 h-9 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
              <Skeleton className="w-16 h-4 rounded" />
            </div>
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
            <div className="w-5 h-5 border-2 border-violet-500/40 border-t-violet-400
                            rounded-full animate-spin" />
          </div>
        )}
        {refreshedAt && (
          <p className="text-center text-[10px] text-white/20 py-2">
            Updated {new Date(refreshedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  )
}

import { forwardRef } from 'react'
const EntryRow = forwardRef<HTMLDivElement, { entry: LeaderboardEntry }>(
  ({ entry }, ref) => {
    const MEDALS = ['🥇', '🥈', '🥉']
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition-colors',
          entry.isCurrentUser
            ? 'border-violet-500/30 bg-violet-500/[0.07]'
            : 'border-white/[0.04] bg-white/[0.015]'
        )}
      >
        {/* Rank */}
        <div className="shrink-0 w-7 text-center">
          {entry.rank <= 3 ? (
            <span className="text-base">{MEDALS[entry.rank - 1]}</span>
          ) : (
            <span className="text-xs font-bold text-white/30 tabular-nums">{entry.rank}</span>
          )}
        </div>

        {/* Avatar */}
        {entry.photoUrl ? (
          <img src={entry.photoUrl} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center
                          text-sm font-bold text-white/50 shrink-0">
            {entry.firstName[0]}
          </div>
        )}

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn('text-sm font-semibold truncate', entry.isCurrentUser ? 'text-violet-200' : 'text-white/85')}>
              {entry.firstName}
            </span>
            {entry.isCurrentUser && (
              <span className="shrink-0 text-[9px] font-black text-violet-400
                               bg-violet-500/15 px-1.5 py-0.5 rounded-md border border-violet-500/20">
                YOU
              </span>
            )}
          </div>
          {entry.clanName && <p className="text-[11px] text-white/30 truncate">{entry.clanName}</p>}
        </div>

        {/* Stats */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className="text-sm font-bold tabular-nums text-white/80">
            {formatNumber(entry.seasonXp)}
          </span>
          <div className="flex items-center gap-1">
            <LevelBadge level={entry.level} />
            <LeagueBadge league={entry.league} compact />
          </div>
        </div>
      </div>
    )
  }
)
EntryRow.displayName = 'EntryRow'
