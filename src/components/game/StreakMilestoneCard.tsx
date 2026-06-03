// src/components/game/StreakMilestoneCard.tsx
'use client'
import { useUserStore } from '@/stores/useUserStore'

interface StreakMs { day: number; xpReward: number; reached: boolean }
interface NextStreakMs { day: number; xpReward: number; remaining: number }

const TRACK_POS: Record<number, number> = { 3: 5, 7: 22, 14: 42, 30: 62, 60: 80, 100: 96 }
const DAY_ICON: Record<number, string> = { 3: '🔥', 7: '🔥', 14: '⚡', 30: '⭐', 60: '💎', 100: '👑' }

function fmtXp(xp: number): string {
  return xp >= 1000 ? `${xp / 1000}K` : `${xp}`
}

export function StreakMilestoneCard() {
  const profile = useUserStore(s => s.profile)
  const milestones    = (profile as any)?.streakMilestones as StreakMs[] | undefined
  const next          = (profile as any)?.nextStreakMilestone as NextStreakMs | null
  const streakCurrent = profile?.streakCurrent ?? 0

  if (!milestones || milestones.length === 0) return null

  // Fill-Breite bis zur aktuellen Streak-Position
  const fillPct = (() => {
    if (streakCurrent >= 100) return 96
    if (streakCurrent >= 60)  return 80 + ((streakCurrent - 60) / 40) * 16
    if (streakCurrent >= 30)  return 62 + ((streakCurrent - 30) / 30) * 18
    if (streakCurrent >= 14)  return 42 + ((streakCurrent - 14) / 16) * 20
    if (streakCurrent >= 7)   return 22 + ((streakCurrent - 7) / 7) * 20
    if (streakCurrent >= 3)   return 5 + ((streakCurrent - 3) / 4) * 17
    return (streakCurrent / 3) * 5
  })()

  return (
    <div className="rounded-[20px] p-4 pb-3.5"
      style={{ background: 'var(--surface-1)', boxShadow: 'inset 0 1px 0 var(--edge-light)' }}>

      <p className="text-[14px] font-extrabold text-white" style={{ fontFamily: 'var(--font-display)' }}>
        Streak Milestones
      </p>
      <p className="text-[11px] mt-0.5 mb-7" style={{ color: 'var(--text-muted)' }}>
        Bonus rewards · resets if you miss 2+ days
      </p>

      {/* Progress track */}
      <div className="relative mx-1.5 mb-3.5">
        <div className="rounded-full" style={{ height: 6, background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full transition-all"
            style={{
              width: `${fillPct}%`,
              background: 'linear-gradient(90deg,#F59E0B,#FBBF24)',
              boxShadow: '0 0 10px rgba(245,158,11,0.6)',
            }} />
        </div>

        {milestones.map((m) => {
          const isDone = m.reached
          const isNext = next?.day === m.day
          return (
            <div key={m.day} className="absolute flex flex-col items-center"
              style={{ left: `${TRACK_POS[m.day]}%`, top: '50%', transform: 'translate(-50%,-50%)' }}>
              <span className="absolute text-[8px] font-bold whitespace-nowrap px-1.5 py-0.5 rounded-md"
                style={{
                  top: -28, fontFamily: 'var(--font-display)',
                  color: isDone || isNext ? '#FBBF24' : 'var(--text-faint)',
                  background: isDone ? 'rgba(251,191,36,0.1)' : isNext ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.04)',
                }}>
                +{fmtXp(m.xpReward)}
              </span>
              <span className="flex items-center justify-center text-[8px] font-extrabold rounded-full"
                style={{
                  width: 18, height: 18, border: '2px solid var(--bg-void)',
                  background: isDone ? 'linear-gradient(135deg,#FBBF24,#F59E0B)' : isNext ? 'linear-gradient(135deg,#FBBF24,#F59E0B)' : 'var(--surface-2)',
                  color: isDone || isNext ? '#1a1206' : 'var(--text-faint)',
                  boxShadow: isDone ? '0 0 10px rgba(245,158,11,0.6)' : isNext ? '0 0 12px rgba(251,191,36,0.8)' : 'inset 0 0 0 1px var(--edge-soft)',
                }}>
                {isDone ? '✓' : m.day}
              </span>
              <span className="absolute text-[9px] font-bold whitespace-nowrap" style={{ top: 22, fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>
                {m.day}d
              </span>
            </div>
          )
        })}
      </div>

      {/* Next bonus callout */}
      {next && (
        <div className="flex items-center gap-3 p-3 rounded-2xl mt-8"
          style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.14),rgba(251,191,36,0.04))', boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.25)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: 'rgba(245,158,11,0.15)' }}>
            {DAY_ICON[next.day] ?? '🎯'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
              {next.remaining} more day{next.remaining !== 1 ? 's' : ''} to your next bonus
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Reach a {next.day}-day streak
            </p>
          </div>
          <span className="text-[14px] font-extrabold shrink-0" style={{ fontFamily: 'var(--font-display)', color: '#FBBF24' }}>
            +{next.xpReward.toLocaleString()}
          </span>
        </div>
      )}

      {!next && (
        <div className="text-center mt-5 py-3 rounded-2xl" style={{ background: 'rgba(251,191,36,0.08)' }}>
          <p className="text-[12px] font-bold" style={{ color: '#FBBF24' }}>
            👑 All streak milestones reached — unstoppable!
          </p>
        </div>
      )}
    </div>
  )
}
