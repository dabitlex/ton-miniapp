// src/components/game/AchievementPopup.tsx
// VEXALGO — "🏆 Achievement Unlocked" Popup (Queue-basiert)
//
// Liest die achievementQueue aus useUIStore und zeigt das vorderste
// Achievement als zentrales Overlay. Wegklicken ("Einsammeln"/"Next") →
// dismissAchievement() → das nächste rückt nach.
//
// Global eingehängt in src/app/(game)/layout.tsx (wie MysteryBoxModal).
// Solange die Queue leer ist (Feature-Flag aus → kein Backend liefert
// Achievements), rendert die Komponente NICHTS.
'use client'

import { useUIStore } from '@/stores/useUIStore'
import { AchievementIcon } from '@/components/game/AchievementIcon'

export function AchievementPopup() {
  const queue   = useUIStore(s => s.achievementQueue)
  const dismiss = useUIStore(s => s.dismissAchievement)

  // Nichts in der Queue → nichts rendern (Normalfall).
  if (queue.length === 0) return null

  const current   = queue[0]
  const remaining = queue.length
  const isLast    = remaining === 1

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-7
                 bg-[rgba(5,5,12,0.78)] backdrop-blur-md
                 animate-in fade-in duration-300"
      onClick={dismiss}
    >
      {/* Karte — Klick darauf NICHT durchreichen (sonst schließt es sofort) */}
      <div
        className="relative w-[308px] rounded-[30px] overflow-hidden animate-pop
                   bg-[linear-gradient(180deg,rgba(20,20,31,0.96),rgba(10,10,18,0.98))]
                   shadow-[0_30px_80px_rgba(0,0,0,0.65),0_0_60px_rgba(139,92,246,0.15),inset_0_0_0_1px_rgba(255,255,255,0.08)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Aurora-Lichtband oben */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40
                        bg-[radial-gradient(ellipse_at_50%_-20%,rgba(139,92,246,0.35),transparent_65%)]" />

        {/* Queue-Zähler (nur bei mehreren) */}
        {remaining > 1 && (
          <div className="absolute top-4 right-[18px] z-[3] font-display text-[11px]
                          font-bold tracking-wide text-white/35">
            {/* zeigt z.B. "3 left" */}
            {remaining} left
          </div>
        )}

        <div className="relative px-[26px] pt-[30px] pb-6 text-center">
          {/* Gradient-Eyebrow */}
          <div className="mb-[22px] font-display text-[10px] font-bold uppercase
                          tracking-[2.5px] text-transparent bg-clip-text
                          bg-[linear-gradient(120deg,#FFFFFF_0%,#BFD4FF_60%,#8FB4FF_110%)]">
            Achievement Unlocked
          </div>

          {/* Aurora-Ring + Icon */}
          <div className="relative mx-auto mb-5 flex h-32 w-32 items-center justify-center">
            {/* rotierender conic Ring */}
            <div
              className="ring-spin absolute inset-0 rounded-full"
              style={{
                padding: '3px',
                background: 'conic-gradient(from 140deg,#7BA5FF,#2563FF,#9CC0FF,#7BA5FF)',
                WebkitMask: 'linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                animationDuration: '4s',
              }}
            />
            {/* Icon schwebt sanft */}
            <div className="float relative z-[2]">
              <AchievementIcon code={current.code} unlocked size={96} />
            </div>
          </div>

          {/* Titel */}
          <div className="mb-[7px] font-display text-[23px] font-extrabold tracking-[-0.3px] text-white">
            {current.title}
          </div>

          {/* XP */}
          <div className="mb-[22px] inline-flex items-center gap-[7px] rounded-[14px]
                          px-[22px] py-[11px] font-display text-[17px] font-extrabold text-[#FBBF24]
                          bg-[rgba(251,191,36,0.10)]
                          shadow-[inset_0_0_0_1px_rgba(251,191,36,0.28),0_4px_16px_rgba(251,191,36,0.12)]">
            <span className="text-[15px]">⚡</span>
            +{current.xp.toLocaleString('de-DE')} XP
          </div>

          {/* Button */}
          <button
            onClick={dismiss}
            className="w-full rounded-2xl py-[15px] font-display text-[14.5px] font-bold
                       tracking-[0.2px] text-white transition-transform active:scale-[0.96]
                       bg-[linear-gradient(135deg,#5B8DFF_0%,#2563FF_55%,#1D4ED8_120%)]
                       shadow-[0_8px_24px_rgba(139,92,246,0.32)]"
          >
            {isLast ? 'Einsammeln' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AchievementPopup
