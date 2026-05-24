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
    body:  'Earn XP to level up through 30 levels across 6 leagues — from Bronze to Legendary.',
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
    <div className="h-dvh flex flex-col bg-[#0c0c0f]">
      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 pt-8 pb-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i === step ? 'w-6 h-1.5 bg-violet-400' : 'w-1.5 h-1.5 bg-white/20'
            }`}
          />
        ))}
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6">
        <div className="text-8xl animate-bounce-slow">{current.icon}</div>
        <div className="space-y-3 max-w-xs">
          <h2 className="text-2xl font-black text-white">{current.title}</h2>
          <p className="text-sm text-white/50 leading-relaxed">{current.body}</p>
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
            className="w-full text-center text-sm text-white/25 py-2"
          >
            Skip intro
          </button>
        )}
      </div>
    </div>
  )
}