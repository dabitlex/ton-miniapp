// src/components/game/StreakCard.tsx
'use client'
import { useUserStore } from '@/stores/useUserStore'
import { useStreakClaim } from '@/features/hooks'

export function StreakCard() {
  const profile = useUserStore(s => s.profile)
  const { claim, claiming, canClaim } = useStreakClaim()

  if (!profile) return null

  const streak   = profile.streakCurrent
  const best     = profile.streakLongest
  const claimed  = !canClaim

  return (
    <div className="rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: claimed
          ? 'rgba(255,255,255,0.03)'
          : 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(251,191,36,0.05) 100%)',
        border: claimed
          ? '1px solid rgba(255,255,255,0.07)'
          : '1px solid rgba(245,158,11,0.25)',
        boxShadow: claimed ? 'none' : '0 4px 24px rgba(245,158,11,0.1)',
      }}>

      {/* Ambient glow */}
      {!claimed && (
        <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at top right, rgba(245,158,11,0.15), transparent)',
          }} />
      )}

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          {/* Flame(s) */}
          <div className="flex">
            {Array.from({ length: Math.min(streak, 3) }).map((_, i) => (
              <span key={i} className={claimed ? '' : 'flame'}
                style={{ fontSize: 20 + i * 2, marginLeft: i > 0 ? -4 : 0 }}>
                🔥
              </span>
            ))}
          </div>

          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-black"
                style={{
                  color: claimed ? 'rgba(255,255,255,0.6)' : '#F59E0B',
                  textShadow: claimed ? 'none' : '0 0 20px rgba(245,158,11,0.5)',
                }}>
                {streak}
              </span>
              <span className="text-xs font-bold"
                style={{ color: 'rgba(255,255,255,0.4)' }}>
                TAGE
              </span>
            </div>
            <p className="text-[10px] font-medium"
              style={{ color: 'rgba(255,255,255,0.3)' }}>
              Bester: {best} Tage
            </p>
          </div>
        </div>

        {/* Claim button or claimed state */}
        {claimed ? (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
            <span className="text-[11px]">✓</span>
            <span className="text-[11px] font-semibold"
              style={{ color: 'rgba(255,255,255,0.4)' }}>
              Heute claimed
            </span>
          </div>
        ) : (
          <button
            onClick={claim}
            disabled={claiming}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold
                       text-sm text-white active:scale-95 disabled:opacity-50 transition-all"
            style={{
              background: 'linear-gradient(135deg, #D97706, #F59E0B)',
              boxShadow: '0 4px 16px rgba(245,158,11,0.35)',
            }}>
            {claiming
              ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : <>🎁 Claimen</>
            }
          </button>
        )}
      </div>
    </div>
  )
}
