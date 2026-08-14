// src/components/game/ReferralMeilensteins.tsx
'use client'

interface Meilenstein {
  threshold: number
  xpReward:  number
  reached:   boolean
  granted:   boolean
}
interface NextMeilenstein {
  threshold: number
  xpReward:  number
  remaining: number
}

const MEDALS: Record<number, string> = { 5: '🥉', 10: '🥈', 25: '🥇', 50: '👑' }
const TRACK_POS: Record<number, number> = { 5: 10, 10: 30, 25: 60, 50: 90 }

export function ReferralMeilensteins({
  validCount, milestones, nextMeilenstein,
}: {
  validCount:    number
  milestones:    Meilenstein[]
  nextMeilenstein: NextMeilenstein | null
}) {
  if (!milestones || milestones.length === 0) return null

  // Fill-Breite: bis zur Position des aktuellen Fortschritts
  const fillPct = (() => {
    if (validCount >= 50) return 90
    if (validCount >= 25) return 60 + ((validCount - 25) / 25) * 30
    if (validCount >= 10) return 30 + ((validCount - 10) / 15) * 30
    if (validCount >= 5)  return 10 + ((validCount - 5) / 5) * 20
    return (validCount / 5) * 10
  })()

  return (
    <div className="rounded-[20px] p-4 mb-3"
      style={{ background: 'var(--surface-1)', boxShadow: 'inset 0 1px 0 var(--edge-light)' }}>

      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-[15px] font-extrabold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Meilenstein Progress
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {validCount} valid referral{validCount !== 1 ? 's' : ''} so far
          </p>
        </div>
        <div className="flex items-baseline gap-1 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(139,92,246,0.12)' }}>
          <span className="text-[18px] font-extrabold tabular-nums" style={{ fontFamily: 'var(--font-display)', color: 'var(--violet-bright)' }}>{validCount}</span>
          <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>friends</span>
        </div>
      </div>

      {/* Progress track with nodes */}
      <div className="relative mx-2 mt-9 mb-5">
        <div className="rounded-full" style={{ height: 6, background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full transition-all"
            style={{
              width: `${fillPct}%`,
              background: 'linear-gradient(90deg,#7BA5FF,#2563FF)',
              boxShadow: '0 0 10px rgba(139,92,246,0.6)',
            }} />
        </div>

        {milestones.map((m) => {
          const isDone = m.reached
          const isNext = nextMeilenstein?.threshold === m.threshold
          return (
            <div key={m.threshold} className="absolute flex flex-col items-center"
              style={{ left: `${TRACK_POS[m.threshold]}%`, top: '50%', transform: 'translate(-50%,-50%)' }}>
              {/* XP above */}
              <span className="absolute text-[9px] font-bold whitespace-nowrap px-1.5 py-0.5 rounded-md"
                style={{
                  top: -30, fontFamily: 'var(--font-display)',
                  color: isDone ? 'var(--emerald)' : isNext ? 'var(--violet-bright)' : 'var(--text-faint)',
                  background: isDone ? 'rgba(52,211,153,0.1)' : isNext ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.04)',
                }}>
                +{m.xpReward >= 1000 ? `${m.xpReward / 1000}K` : m.xpReward}
              </span>
              {/* Dot */}
              <span className="flex items-center justify-center text-[9px] font-extrabold rounded-full"
                style={{
                  width: 18, height: 18, border: '2px solid var(--bg-void)',
                  background: isDone ? 'linear-gradient(135deg,#8FF0C0,#22C55E)' : isNext ? 'linear-gradient(135deg,#7BA5FF,#1D4ED8)' : 'var(--surface-2)',
                  color: isDone ? '#04210f' : isNext ? '#fff' : 'var(--text-faint)',
                  boxShadow: isDone ? '0 0 10px rgba(52,211,153,0.6)' : isNext ? '0 0 12px rgba(139,92,246,0.7)' : 'inset 0 0 0 1px var(--edge-soft)',
                }}>
                {isDone ? '✓' : m.threshold}
              </span>
              {/* Friends count below */}
              <span className="absolute text-[10px] font-bold whitespace-nowrap" style={{ top: 22, fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>
                {m.threshold}
              </span>
            </div>
          )
        })}
      </div>

      {/* Next milestone callout */}
      {nextMeilenstein && (
        <div className="flex items-center gap-3 p-3 rounded-2xl mt-7"
          style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.14),rgba(91,141,239,0.05))', boxShadow: 'inset 0 0 0 1px rgba(167,139,250,0.25)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: 'rgba(139,92,246,0.15)' }}>
            {MEDALS[nextMeilenstein.threshold] ?? '🎯'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
              {nextMeilenstein.remaining} more friend{nextMeilenstein.remaining !== 1 ? 's' : ''} to your next reward
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Reach {nextMeilenstein.threshold} valid referrals
            </p>
          </div>
          <span className="text-[14px] font-extrabold shrink-0" style={{ fontFamily: 'var(--font-display)', color: 'var(--violet-bright)' }}>
            +{nextMeilenstein.xpReward.toLocaleString()}
          </span>
        </div>
      )}

      {/* All reached + nothing left */}
      {!nextMeilenstein && (
        <div className="text-center mt-6 py-3 rounded-2xl" style={{ background: 'rgba(52,211,153,0.08)' }}>
          <p className="text-[12px] font-bold" style={{ color: 'var(--emerald)' }}>
            🎉 All milestones reached — legendary recruiter!
          </p>
        </div>
      )}
    </div>
  )
}
