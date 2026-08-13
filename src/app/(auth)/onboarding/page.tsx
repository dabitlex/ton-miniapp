// src/app/(auth)/onboarding/page.tsx
'use client'
import { useState }      from 'react'
import { useRouter }     from 'next/navigation'
import { useUserStore }  from '@/stores/useUserStore'
import { useAuthStore }  from '@/stores/useAuthStore'
import { getAdminClient }from '@/lib/supabase/admin'
import { Button }        from '@/components/ui/Button'
import { IconTile, type IconName } from '@/components/ui/Icon'

const STEPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'bolt',
    title: 'Energie-System',
    body:  'Du startest mit 100 Energie. Jede Quest kostet Energie — sie lädt sich alle 15 Minuten um 1 Punkt wieder auf, bis 100.',
  },
  {
    icon: 'quest',
    title: 'Daily Quests',
    body:  '6 frische Quests jeden Tag um Mitternacht UTC. Schließe sie ab, um XP zu sammeln und aufzusteigen.',
  },
  {
    icon: 'trophy',
    title: 'Level aufsteigen',
    body:  'Sammle XP und steige durch 30 Level. Je höher dein Level, desto stärker stehst du in der Rangliste.',
  },
  {
    icon: 'flame',
    title: 'Täglicher Streak',
    body:  'Hole dir jeden Tag deinen Streak für Bonus-XP. Einen Tag verpasst? Alle 14 Tage bekommst du einen Schutz.',
  },
  {
    icon: 'rank',
    title: 'Rangliste',
    body:  'Miss dich in 42-Tage-Seasons. Die besten Spieler erhalten am Season-Ende Token-Belohnungen.',
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
      {/* Fortschrittspunkte */}
      <div className="flex justify-center gap-1.5 pt-8 pb-2 order-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === step ? 24 : 6, height: 6,
              background: i === step ? 'var(--blue)' : 'rgba(255,255,255,0.18)',
            }}
          />
        ))}
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6 order-1">
        <IconTile name={current.icon} size={76} active iconSize={34} />
        <div className="space-y-3 max-w-xs">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 23, fontWeight: 600,
            letterSpacing: '-0.02em', color: '#fff' }}>{current.title}</h2>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{current.body}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 pb-12 space-y-3 order-3">
        <Button
          fullWidth
          size="lg"
          loading={finishing}
          onClick={isLast ? finish : () => setStep(s => s + 1)}
        >
          {isLast ? 'Los geht\'s' : 'Weiter'}
        </Button>
        {!isLast && (
          <button
            onClick={finish}
            className="w-full text-center text-sm py-2"
            style={{ color: 'var(--text-muted)', fontSize: 13 }}
          >
            Überspringen
          </button>
        )}
      </div>
    </div> 
  )
}
