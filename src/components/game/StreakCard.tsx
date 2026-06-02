// src/components/game/StreakCard.tsx — Redesigned (Aurora OS)
'use client'
import { Flame, Gift, Check } from 'lucide-react'
import { useStreak } from '@/features/hooks'

export function StreakCard() {
  const { streakCurrent, streakLongest, canClaim, isClaiming, claimStreak } = useStreak()

  return (
    <div className="relative overflow-hidden rounded-[22px] p-4"
      style={{
        background: canClaim
          ? 'linear-gradient(150deg, rgba(245,158,11,0.16) 0%, rgba(251,191,36,0.05) 55%, transparent 100%), var(--surface-1)'
          : 'var(--surface-1)',
        boxShadow: canClaim
          ? 'inset 0 1px 0 rgba(251,191,36,0.25), 0 12px 34px rgba(245,158,11,0.14)'
          : 'inset 0 1px 0 var(--edge-light), var(--shadow-sm)',
      }}>

      {canClaim && (
        <div className="absolute -top-6 -right-6 w-32 h-32 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.22), transparent 70%)' }} />
      )}

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl"
            style={{
              background: canClaim ? 'rgba(245,158,11,0.14)' : 'var(--surface-2)',
              boxShadow: canClaim ? 'inset 0 0 0 1px rgba(251,191,36,0.3)' : 'inset 0 1px 0 var(--edge-light)',
            }}>
            <Flame
              size={26}
              style={{
                color: canClaim ? '#FBBF24' : 'rgba(255,255,255,0.32)',
                filter: canClaim ? 'drop-shadow(0 0 10px rgba(251,191,36,0.7))' : 'none',
              }}
              fill={canClaim ? '#FBBF24' : 'none'}
              className={canClaim ? 'flame' : ''}
            />
          </div>

          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="display-xl text-3xl"
                style={{
                  color: canClaim ? '#FBBF24' : 'rgba(255,255,255,0.72)',
                  textShadow: canClaim ? '0 0 22px rgba(251,191,36,0.5)' : 'none',
                }}>
                {streakCurrent}
              </span>
              <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                day{streakCurrent === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--text-faint)' }}>
              Best streak · {streakLongest}d
            </p>
          </div>
        </div>

        {!canClaim ? (
          <div className="chip" style={{ color: 'var(--text-muted)' }}>
            <Check size={12} /> Claimed
          </div>
        ) : (
          <button
            onClick={() => claimStreak()}
            disabled={isClaiming}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm text-white press disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
              boxShadow: '0 6px 18px rgba(245,158,11,0.38), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}>
            {isClaiming
              ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : <><Gift size={14} /> Claim</>
            }
          </button>
        )}
      </div>
    </div>
  )
}
