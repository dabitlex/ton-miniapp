// src/components/game/StreakCard.tsx
'use client'
import { Button } from '@/components/ui/Button'

interface StreakCardProps {
  current:    number
  longest:    number
  canClaim:   boolean
  isClaiming: boolean
  onClaim:    () => void
}

export function StreakCard({ current, longest, canClaim, isClaiming, onClaim }: StreakCardProps) {
  const flames = Math.min(Math.max(current, 1), 7)

  return (
    <div className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.04] p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1 mb-1">
            {Array.from({ length: flames }).map((_, i) => (
              <span
                key={i}
                className="text-base"
                style={{ opacity: 0.4 + (i / flames) * 0.6 }}
              >
                🔥
              </span>
            ))}
          </div>
          <p className="text-xl font-black text-white tabular-nums">
            {current} day streak
          </p>
          <p className="text-xs text-white/35">Best: {longest} days</p>
        </div>

        {canClaim ? (
          <Button
            size="sm"
            loading={isClaiming}
            onClick={onClaim}
            className="bg-orange-500 hover:bg-orange-400 text-white border-transparent h-9 px-4"
          >
            Claim!
          </Button>
        ) : (
          <span className="text-xs text-white/25 font-medium">✓ Claimed today</span>
        )}
      </div>
    </div>
  )
}
