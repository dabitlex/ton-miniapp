// src/components/game/SeasonRewardModal.tsx
'use client'
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'

interface PendingReward {
  id:            string
  seasonNumber:  number
  finalRank:     number
  finalSeasonXp: number
  xpReward:      number
}

const CONFETTI_COLORS = ['#7BA5FF', '#2563FF', '#9CC0FF', '#FFD27A', '#8FF0C0', '#FFFFFF']

function rankIcon(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  if (rank <= 25) return '⭐'
  return '✨'
}

export function SeasonRewardModal() {
  const token = useAuthStore(s => s.accessToken)
  const qc    = useQueryClient()
  const [visible, setVisible] = useState(false)
  const [confetti, setConfetti] = useState<{ left: string; bg: string; delay: string; size: string; round: boolean }[]>([])

  const { data } = useQuery({
    queryKey: ['season-rewards'],
    enabled:  !!token,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res  = await fetch('/api/v1/season-rewards', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      return json.success ? json.data : null
    },
  })

  const reward: PendingReward | null = data?.pendingRewards?.[0] ?? null
  const currentXpTotal: number = data?.currentXpTotal ?? 0

  const { mutate: acknowledge } = useMutation({
    mutationFn: async (rewardId: string) => {
      await fetch('/api/v1/season-rewards', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rewardId }),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['season-rewards'] }),
  })

  // Build confetti + show
  useEffect(() => {
    if (reward && !visible) {
      const pieces = Array.from({ length: 40 }).map(() => ({
        left:  `${Math.random() * 100}%`,
        bg:    CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        delay: `${Math.random() * 0.8}s`,
        size:  `${5 + Math.random() * 6}px`,
        round: Math.random() > 0.5,
      }))
      setConfetti(pieces)
      setTimeout(() => setVisible(true), 300)
      // Haptic
      try { (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success') } catch {}
    }
  }, [reward]) // eslint-disable-line

  function close() {
    setVisible(false)
    if (reward) setTimeout(() => acknowledge(reward.id), 350)
  }

  if (!reward) return null

  const newTotal = currentXpTotal // already includes reward (granted at season end)

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(3,3,8,0.82)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.4s ease',
      }}>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', width: 340, maxWidth: '90vw',
          borderRadius: 28, padding: '36px 28px 28px', textAlign: 'center',
          background: 'linear-gradient(165deg, rgba(20,16,42,0.96) 0%, rgba(10,9,20,0.98) 100%)',
          boxShadow: '0 0 0 1px rgba(139,92,246,0.25), 0 20px 60px rgba(0,0,0,0.6), 0 0 80px rgba(139,92,246,0.25)',
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(20px)',
          opacity: visible ? 1 : 0,
          transition: 'all 0.5s cubic-bezier(0.34, 1.4, 0.5, 1)',
          overflow: 'hidden',
        }}>

        {/* Top glow */}
        <div style={{
          position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
          width: 240, height: 160,
          background: 'radial-gradient(50% 60% at 50% 50%, rgba(139,92,246,0.5), transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Confetti */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {confetti.map((c, i) => (
            <span key={i} style={{
              position: 'absolute', top: -10, left: c.left,
              width: c.size, height: c.size, background: c.bg,
              borderRadius: c.round ? '50%' : 1,
              animation: visible ? `vxfall 2.6s ease-in ${c.delay} forwards` : 'none',
            }} />
          ))}
        </div>

        {/* Rotating icon */}
        <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto 18px' }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'conic-gradient(from 0deg, #7BA5FF, #2563FF, #9CC0FF, #7BA5FF)',
            padding: 3, animation: 'vxspin 4s linear infinite',
          }} />
          <div style={{
            position: 'absolute', inset: 3, borderRadius: '50%', background: '#0c0a18',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44,
          }}>
            {rankIcon(reward.finalRank)}
          </div>
        </div>

        {/* Texts */}
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'var(--violet-bright)', marginBottom: 8,
        }}>
          Season {reward.seasonNumber} Complete
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800,
          color: 'white', lineHeight: 1.1, marginBottom: 4,
        }}>
          Reward Earned!
        </h1>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700,
          background: 'linear-gradient(120deg, #FFFFFF 0%, #BFD4FF 60%, #8FB4FF 110%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: 22,
        }}>
          You finished #{reward.finalRank} globally
        </p>

        {/* XP box */}
        <div style={{
          background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: 18, padding: 18, marginBottom: 24,
        }}>
          <p style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-faint)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
          }}>
            XP Reward
          </p>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 800,
            color: 'white', lineHeight: 1, display: 'flex',
            alignItems: 'baseline', justifyContent: 'center', gap: 6,
          }}>
            <span style={{ color: 'var(--blue-2)' }}>+</span>
            <span>{reward.xpReward.toLocaleString()}</span>
            <span style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 600 }}>XP</span>
          </div>
        </div>

        {/* Button */}
        <button onClick={close} style={{
          width: '100%', padding: 15, borderRadius: 16, border: 'none',
          fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700,
          color: 'white', cursor: 'pointer',
          background: 'linear-gradient(135deg, #5B8DFF, #1D4ED8)',
          boxShadow: '0 8px 24px rgba(139,92,246,0.4)', letterSpacing: '0.02em',
        }}>
          Awesome! 🚀
        </button>

        {newTotal > 0 && (
          <p style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
            Your total XP is now{' '}
            <b style={{ color: 'var(--violet-bright)', fontFamily: 'var(--font-display)' }}>
              {newTotal.toLocaleString()}
            </b>
          </p>
        )}
      </div>

      <style>{`
        @keyframes vxspin { to { transform: rotate(360deg); } }
        @keyframes vxfall {
          0%   { opacity: 0; transform: translateY(-10px) rotate(0deg); }
          10%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(440px) rotate(540deg); }
        }
      `}</style>
    </div>
  )
}
