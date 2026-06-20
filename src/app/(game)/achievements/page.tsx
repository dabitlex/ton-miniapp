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
    if (a.unlocked) return 'Unlocked'
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
          <h1 className="font-display text-[20px] font-extrabold text-white">Achievements</h1>
          <p className="text-[12px] text-white/35">
            {unlockedCount} of {totalCount} unlocked
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-[9px] pt-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-[148px] rounded-[18px] bg-white/[0.035] animate-pulse" />
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
                className="relative flex flex-col items-center overflow-hidden rounded-[18px]
                           bg-white/[0.035] px-[7px] pb-[11px] pt-3 text-center
                           shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]
                           transition-transform active:scale-[0.96]"
              >
                {/* Häkchen bei freigeschaltet */}
                {a.unlocked && (
                  <div className="absolute right-[7px] top-[7px] z-[2] flex h-[18px] w-[18px]
                                  items-center justify-center rounded-full bg-emerald-400">
                    <svg viewBox="0 0 24 24" className="h-[10px] w-[10px]"
                         style={{ stroke: '#04231a', strokeWidth: 3.2, fill: 'none',
                                  strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                      <path d="M5 12l4 4 10-10" />
                    </svg>
                  </div>
                )}

                <div className="mb-[6px] mt-1">
                  <AchievementIcon code={a.code} unlocked={a.unlocked} size={54} />
                </div>

                <div className="flex min-h-[26px] items-center font-display text-[11px]
                                font-bold leading-tight text-white">
                  {a.title}
                </div>

                <div className={`mt-[3px] font-display text-[10px] font-bold
                                 ${a.unlocked ? 'text-emerald-400' : 'text-white/30'}`}>
                  {progressText(a)}
                </div>

                {/* Fortschrittsbalken */}
                <div className="mt-[7px] h-[5px] w-full overflow-hidden rounded-[4px] bg-white/[0.06]">
                  <div
                    className="h-full rounded-[4px] transition-all"
                    style={{
                      width: `${pct}%`,
                      background: a.unlocked
                        ? 'linear-gradient(90deg,#059669,#34D399)'
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
              aria-label="Close"
            >
              ✕
            </button>

            <div className="mx-auto mb-4 mt-1 flex justify-center">
              <AchievementIcon code={selected.code} unlocked={selected.unlocked} size={84} />
            </div>

            <div className="font-display text-[19px] font-extrabold text-white">
              {selected.title}
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">
              {selected.description}
            </p>

            {/* Fortschritt */}
            <div className="mt-4">
              <div className="h-[8px] overflow-hidden rounded-[5px] bg-white/[0.06]">
                <div
                  className="h-full rounded-[5px]"
                  style={{
                    width: `${pctOf(selected)}%`,
                    background: selected.unlocked
                      ? 'linear-gradient(90deg,#059669,#34D399)'
                      : 'linear-gradient(90deg,#7C3AED,#A78BFA)',
                  }}
                />
              </div>
              <div className="mt-2 flex justify-between font-display text-[12px] font-bold text-white/70">
                <span>{progressText(selected)}</span>
                <span>{pctOf(selected)}%</span>
              </div>
            </div>

            {/* XP-Belohnung */}
            <div className="mt-4 inline-flex items-center gap-[6px] rounded-[12px] px-4 py-2
                            font-display text-[13px] font-bold text-[#FBBF24]
                            bg-[rgba(251,191,36,0.10)]
                            shadow-[inset_0_0_0_1px_rgba(251,191,36,0.25)]">
              Reward: +{formatNumber(selected.xpReward)} XP
            </div>

            {selected.unlocked && selected.unlockedAt && (
              <p className="mt-3 text-[11px] text-white/30">
                Unlocked {new Date(selected.unlockedAt).toLocaleDateString('en-US')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
