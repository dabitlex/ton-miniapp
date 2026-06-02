// src/app/(auth)/onboarding/page.tsx
'use client'
import { useState }      from 'react'
import { useRouter }     from 'next/navigation'
import { useUserStore }  from '@/stores/useUserStore'
import { useAuthStore }  from '@/stores/useAuthStore'
import { getAdminClient }from '@/lib/supabase/admin'
import { Button }        from '@/components/ui/Button'

const STEPS = [
  {
    icon: '⚡',
    title: 'Energy System',
    body:  'You start with 100 energy. Each quest costs energy. It regenerates 1 point every 15 minutes — up to 100.',
  },
  {
    icon: '📋',
    title: 'Daily Quests',
    body:  '6 fresh quests every day at midnight UTC. Complete them to earn XP and level up.',
  },
  {
    icon: '⭐',
    title: 'Level Up',
    body:  'Earn XP to level up through 30 levels. The higher your level, the more powerful you become on the leaderboard.',
  },
  {
    icon: '🔥',
    title: 'Daily Streak',
    body:  'Claim your streak every day for bonus XP. Miss a day? You get 1 protection every 14 days.',
  },
  {
    icon: '🏆',
    title: 'Leaderboard',
    body:  'Compete in 42-day seasons. Top players earn token rewards distributed at season end.',
  },
]

export default function OnboardingPage() {
  const [step, setStep]     = useState(0)
  const [finishing, setFin] = useState(false)
  const router              = useRouter()
  const { patchProfile }    = useUserStore()
  const { accessToken }     = useAuthStore()

  const current = STEPS[step]!
  const isLast  = step === STEPS.length - 1

  async function finish() {
    setFin(true)
    // Mark onboarding done
    await fetch('/api/v1/users/me/onboarding', {
      method:  'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {})
    patchProfile({ onboardingCompleted: true })
    router.replace('/home')
  }

  return (
    <div className="h-dvh flex flex-col relative z-10" style={{ background: 'var(--bg-void)' }}>
      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 pt-8 pb-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === step ? 24 : 6, height: 6,
              background: i === step ? 'var(--violet-bright)' : 'rgba(255,255,255,0.18)',
              boxShadow: i === step ? '0 0 10px rgba(167,139,250,0.6)' : 'none',
            }}
          />
        ))}
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full pulse-glow"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.3), transparent 70%)', filter: 'blur(20px)' }} />
          <div className="relative text-8xl float">{current.icon}</div>
        </div>
        <div className="space-y-3 max-w-xs">
          <h2 className="display text-2xl text-white">{current.title}</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{current.body}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 pb-12 space-y-3">
        <Button
          fullWidth
          size="lg"
          loading={finishing}
          onClick={isLast ? finish : () => setStep(s => s + 1)}
        >
          {isLast ? 'Start Playing! 🚀' : 'Next'}
        </Button>
        {!isLast && (
          <button
            onClick={finish}
            className="w-full text-center text-sm py-2"
            style={{ color: 'var(--text-faint)' }}
          >
            Skip intro
          </button>
        )}
      </div>
    </div> 
  )
}
