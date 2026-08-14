// src/app/(game)/achievements/page.tsx
// VEXALGO — Achievement-Seite (Aurora OS)
// Grid aller Achievements · 3 pro Reihe · gemischt · freigeschaltet=farbig,
// in Arbeit=ausgegraut · Tap → Detail-Modal mit Fortschritt + Belohnung.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { AchievementIcon } from '@/components/game/AchievementIcon'
import { formatNumber } from '@/lib/utils'
import { ChevronLeft } from 'lucide-react'

interface Achievement {
  code: string
  title: string
  description: string
  category: string
  iconCode: string
  threshold: number | null
  xpReward: number
  unlocked: boolean
  unlockedAt: string | null
  progress: number
}

export default function AchievementsPage() {
  const router = useRouter()
  const token  = useAuthStore(s => s.accessToken)
  const [selected, setSelected] = useState<Achievement | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['achievements'],
    enabled:  !!token,
    staleTime: 30_000,
    queryFn:  async () => {
      const res  = await fetch('/api/v1/achievements', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      return json.success ? json.data : null
    },
  })

  const achievements: Achievement[] = data?.achievements ?? []
  const unlockedCount = data?.unlockedCount ?? 0
  const totalCount    = data?.totalCount ?? 0

  // pct für den Fortschrittsbalken (geclamped 0..100)
  const pctOf = (a: Achievement) => {
    if (a.unlocked) return 100
    if (!a.threshold || a.threshold <= 0) return 0
    return Math.min(100, Math.round((a.progress / a.threshold) * 100))
  }

  // Fortschritts-Text (z.B. "64 / 100")
  const progressText = (a: Achievement) => {
    if (a.unlocked) return 'Freigeschaltet'
    if (!a.threshold || a.threshold <= 1) return 'In progress'
    return `${formatNumber(a.progress)} / ${formatNumber(a.threshold)}`
  }

  return (
    <div className="min-h-screen px-[18px] pb-24 pt-2">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 pt-2">
        <button
          onClick={() => router.back()}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[13px]
                     bg-white/[0.038] text-white/60 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]
                     transition-transform active:scale-95"
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 600,
            letterSpacing: '-0.02em', color: '#fff' }}>Achievements</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {unlockedCount} von {totalCount} freigeschaltet
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-[9px] pt-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-[148px] shimmer" style={{ borderRadius: 20 }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-[9px] pt-2">
          {achievements.map(a => {
            const pct = pctOf(a)
            return (
              <button
                key={a.code}
                onClick={() => setSelected(a)}
                className="relative flex flex-col items-center overflow-hidden px-[7px] pb-[11px] pt-3
                           text-center transition-transform active:scale-[0.96]"
                style={{
                  borderRadius: 20,
                  background: a.unlocked
                    ? 'linear-gradient(150deg,rgba(255,255,255,.16) 0%,rgba(255,255,255,.06) 42%,rgba(255,255,255,.035) 100%)'
                    : 'linear-gradient(150deg,rgba(255,255,255,.08),rgba(255,255,255,.025))',
                  boxShadow: a.unlocked
                    ? 'inset 0 1px 0 rgba(255,255,255,.26), inset 0 0 0 .5px rgba(255,255,255,.09)'
                    : 'inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 .5px rgba(255,255,255,.05)',
                  opacity: a.unlocked ? 1 : 0.62,
                }}
              >
                {/* Häkchen bei freigeschaltet */}
                {a.unlocked && (
                  <div className="absolute right-[7px] top-[7px] z-[2] flex h-[18px] w-[18px]
                                  items-center justify-center rounded-full"
                    style={{ background: 'linear-gradient(140deg,#7BA5FF,#1D4ED8)',
                      boxShadow: '0 4px 12px rgba(37,99,255,.45)' }}>
                    <svg viewBox="0 0 24 24" className="h-[10px] w-[10px]"
                         style={{ stroke: '#fff', strokeWidth: 3, fill: 'none',
                                  strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                      <path d="M5 12l4 4 10-10" />
                    </svg>
                  </div>
                )}

                <div className="mb-[6px] mt-1">
                  <AchievementIcon code={a.code} unlocked={a.unlocked} size={54} />
                </div>

                <div className="flex min-h-[26px] items-center leading-tight"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 500,
                    color: 'var(--text-primary)' }}>
                  {a.title}
                </div>

                <div style={{ marginTop: 3, fontFamily: 'var(--font-display)', fontSize: 10,
                  fontWeight: 500, color: a.unlocked ? 'var(--blue-2)' : 'var(--text-muted)' }}>
                  {progressText(a)}
                </div>

                {/* Fortschrittsbalken */}
                <div className="mt-[7px] h-[5px] w-full overflow-hidden rounded-[4px] bg-white/[0.06]">
                  <div
                    className="h-full rounded-[4px] transition-all"
                    style={{
                      width: `${pct}%`,
                      background: a.unlocked
                        ? 'linear-gradient(90deg,#7BA5FF,#2563FF)'
                        : 'rgba(255,255,255,0.18)',
                    }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Detail-Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-7
                     bg-[rgba(5,5,12,0.78)] backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative w-[320px] rounded-[26px] p-[26px] text-center animate-pop
                       bg-[linear-gradient(180deg,rgba(20,20,31,0.96),rgba(10,10,18,0.98))]
                       shadow-[0_24px_60px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.06)]"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute right-[14px] top-[14px] flex h-[30px] w-[30px] items-center
                         justify-center rounded-[10px] bg-white/[0.06] text-white/50"
              aria-label="Schließen"
            >
              ✕
            </button>

            <div className="mx-auto mb-4 mt-1 flex justify-center">
              <AchievementIcon code={selected.code} unlocked={selected.unlocked} size={84} />
            </div>

            <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600,
              letterSpacing: '-0.02em', color: '#fff' }}>
              {selected.title}
            </div>
            <p className="mt-2" style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              {selected.description}
            </p>

            {/* Fortschritt */}
            <div className="mt-4">
              <div className="h-[8px] overflow-hidden rounded-[5px] bg-white/[0.06]">
                <div
                  className="h-full rounded-[5px]"
                  style={{
                    width: `${pctOf(selected)}%`,
                    background: 'linear-gradient(90deg,#7BA5FF,#2563FF)',
                  }}
                />
              </div>
              <div className="mt-2 flex justify-between" style={{ fontFamily: 'var(--font-display)',
                fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
                <span>{progressText(selected)}</span>
                <span>{pctOf(selected)}%</span>
              </div>
            </div>

            {/* XP-Belohnung */}
            <div className="mt-4 inline-flex items-center gap-[6px] px-4 py-2"
              style={{ borderRadius: 12, fontFamily: 'var(--font-display)', fontSize: 13,
                fontWeight: 500, color: 'var(--gold)',
                background: 'rgba(255,210,122,0.10)',
                boxShadow: 'inset 0 0 0 .5px rgba(255,210,122,0.25)' }}>
              Belohnung: +{formatNumber(selected.xpReward)} XP
            </div>

            {selected.unlocked && selected.unlockedAt && (
              <p className="mt-3 text-[11px] text-white/30">
                Freigeschaltet am {new Date(selected.unlockedAt).toLocaleDateString('de-DE')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
