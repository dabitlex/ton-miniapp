// src/app/(game)/home/page.tsx 
'use client'
import { useUserStore }   from '@/stores/useUserStore'
import { useStreak }      from '@/features/hooks'
import { useQuests }      from '@/features/quests/hooks'
import { useEnergy }      from '@/features/hooks'
import { XPBar }          from '@/components/game/XPBar'
import { StreakCard }      from '@/components/game/StreakCard'
import { QuestCard }      from '@/components/game/QuestCard'
import { SkeletonCard }   from '@/components/ui/Skeleton'
import { Button }         from '@/components/ui/Button'
import { LeagueBadge }    from '@/components/game/LeagueBadge'
import { formatNumber }   from '@/lib/utils'
import Link               from 'next/link'
import { ArrowRight }     from 'lucide-react'

export default function HomePage() {
  const profile = useUserStore(s => s.profile)
  const energy  = useEnergy()
  const { daily, isLoadingDaily, completeQuest, completingId } = useQuests()
  const streak  = useStreak()

  const availableQuests = daily.filter(q => q.status === 'available')
  const completedCount  = daily.filter(q => q.status === 'completed').length

  return (
    <div className="px-4 pt-4 pb-6 space-y-4 max-w-lg mx-auto">

      {/* ── Hero: level + XP ─────────────────────────────────────── */}
      {profile ? (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40 font-medium mb-0.5">
                Welcome back, {profile.telegramFirstName.split(' ')[0]}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-white">Lv. {profile.level}</span>
                <LeagueBadge league={profile.league} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/40">Season XP</p>
              <p className="text-xl font-black text-violet-300 tabular-nums">
                {formatNumber(profile.seasonXp)}
              </p>
            </div>
          </div>
          <XPBar />
        </div>
      ) : (
        <SkeletonCard lines={2} />
      )}

      {/* ── Streak card ──────────────────────────────────────────── */}
      <StreakCard
        current={streak.streakCurrent}
        longest={streak.streakLongest}
        canClaim={streak.canClaim}
        isClaiming={streak.isClaiming}
        onClaim={streak.claimStreak}
      />

      {/* ── Daily quests preview ──────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Daily Quests</h2>
            <p className="text-xs text-white/35">
              {completedCount}/{daily.length} completed
            </p>
          </div>
          <Link href="/quests">
            <Button variant="ghost" size="sm" className="gap-1 text-violet-400 h-7 px-2">
              See all <ArrowRight size={12} />
            </Button>
          </Link>
        </div>

        {isLoadingDaily ? (
          <>
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
          </>
        ) : availableQuests.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.05] bg-emerald-500/[0.05] p-4 text-center">
            <p className="text-2xl mb-1">🎉</p>
            <p className="text-sm font-semibold text-emerald-300">All done for today!</p>
            <p className="text-xs text-white/40 mt-0.5">New quests reset at midnight UTC</p>
          </div>
        ) : (
          availableQuests.slice(0, 2).map(quest => (
            <QuestCard
              key={quest.id}
              quest={quest}
              userEnergy={energy.current}
              isCompleting={completingId === quest.id}
              onComplete={() => completeQuest(quest.id, 'daily')}
            />
          ))
        )}
      </div>

      {/* ── Quick stats ──────────────────────────────────────────── */}
      {profile && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Streak',   value: `${profile.streakCurrent}d`, icon: '🔥' },
            { label: 'XP Today', value: formatNumber(profile.xpEarnedToday), icon: '⭐' },
            { label: 'Energy',   value: `${energy.current}/100`, icon: '⚡' },
          ].map(({ label, value, icon }) => (
            <div key={label}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
              <p className="text-lg leading-none mb-1">{icon}</p>
              <p className="text-sm font-bold text-white tabular-nums">{value}</p>
              <p className="text-[10px] text-white/35 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
