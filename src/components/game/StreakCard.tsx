// src/components/game/StreakCard.tsx
'use client'
import { Flame, Gift, Check } from 'lucide-react'
import { useStreak } from '@/features/hooks'

export function StreakCard() {
  // useStreak is the correct hook name
  const { streakCurrent, streakLongest, canClaim, isClaiming, claimStreak } = useStreak()

  return (
    <div className="rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: canClaim
          ? 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(251,191,36,0.05) 100%)'
          : 'rgba(255,255,255,0.03)',
        border: canClaim
          ? '1px solid rgba(245,158,11,0.25)'
          : '1px solid rgba(255,255,255,0.07)',
        boxShadow: canClaim ? '0 4px 24px rgba(245,158,11,0.1)' : 'none',
      }}>

      {/* Ambient glow */}
      {canClaim && (
        <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at top right, rgba(245,158,11,0.15), transparent)',
          }} />
      )}

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          {/* Flames */}
          <div className="flex items-center gap-1">
            <Flame
              size={28}
              style={{
                color: canClaim ? '#F59E0B' : 'rgba(255,255,255,0.3)',
                filter: canClaim ? 'drop-shadow(0 0 8px rgba(245,158,11,0.6))' : 'none',
              }}
              fill={canClaim ? '#F59E0B' : 'none'}
              className={canClaim ? 'flame' : ''}
            />
            {streakCurrent >= 7 && <Flame size={20} style={{ color: '#F97316' }} fill="#F97316" />}
            {streakCurrent >= 14 && <Flame size={16} style={{ color: '#EF4444' }} fill="#EF4444" />}
          </div>

          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-black"
                style={{
                  color: canClaim ? '#F59E0B' : 'rgba(255,255,255,0.6)',
                  textShadow: canClaim ? '0 0 20px rgba(245,158,11,0.5)' : 'none',
                  fontFamily: 'var(--font-display)',
                }}>
                {streakCurrent}
              </span>
              <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                DAYS
              </span>
            </div>
            <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Best: {streakLongest} days
            </p>
          </div>
        </div>

        {/* CTA */}
        {!canClaim ? (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
            <Check size={12} style={{ color: "rgba(255,255,255,0.4)" }} />
            <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Claimed today
            </span>
          </div>
        ) : (
          <button
            onClick={() => claimStreak()}
            disabled={isClaiming}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold
                       text-sm text-white active:scale-95 disabled:opacity-50 transition-all"
            style={{
              background: 'linear-gradient(135deg, #D97706, #F59E0B)',
              boxShadow: '0 4px 16px rgba(245,158,11,0.35)',
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
