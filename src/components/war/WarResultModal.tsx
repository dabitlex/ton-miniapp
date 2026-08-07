// src/components/war/WarResultModal.tsx
// Vollbild-Ergebnis nach der Kriegs-Auswertung (Sonntag 23:45).
// Erscheint automatisch, sobald /clans/war state='result' liefert (also beim
// nächsten App-Öffnen), und wird per POST { warId } bestätigt.
// Sieg: Gold-Bühne mit Strahlenkranz + Konfetti + Lorbeer-Wappen.
// Niederlage/Remis: gleiche Struktur in ruhigem Violett — kein XP-Verlust.
// Global gemountet in src/app/(game)/layout.tsx.
'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useClanWar } from '@/features/war/hooks'
import { useUserStore } from '@/stores/useUserStore'
import { useUIStore } from '@/stores/useUIStore'
import { WarStyles, Rivets, Crest, BeamClash, GameButton } from './WarPrimitives'
import { formatNumber } from '@/lib/utils'

const fd: React.CSSProperties = { fontFamily: 'var(--font-display)', fontWeight: 800 }
const CONFETTI = ['#FBBF24', '#A78BFA', '#5EEAD4', '#FB7185', '#FDE68A']

export function WarResultModal() {
  const { war, acknowledgeWar, acking } = useClanWar()
  const { haptic } = useUIStore()
  const [visible, setVisible] = useState(false)
  const shownFor = useRef<string | null>(null)

  const isResult = war?.state === 'result'

  useEffect(() => {
    if (isResult && war.state === 'result' && shownFor.current !== war.warId) {
      shownFor.current = war.warId
      setVisible(true)
      haptic(war.result === 'win' ? 'heavy' : 'medium')
    }
  }, [isResult, war, haptic])

  if (!visible || !war || war.state !== 'result' || typeof document === 'undefined') return null

  const win  = war.result === 'win'
  const draw = war.result === 'draw'

  const title    = win ? 'SIEG!' : draw ? 'REMIS!' : 'EHRENVOLLE NIEDERLAGE'
  const subtitle = win
    ? `${war.myClan.name} bezwingt ${war.rival.name}`
    : draw
    ? `${war.myClan.name} und ${war.rival.name} halten die Linie`
    : `${war.rival.name} nimmt diese Woche — nächste Woche schlagt ihr zurück`

  const pcSum     = war.myClan.perCapita + war.rival.perCapita
  const frontline = pcSum > 0 ? war.myClan.perCapita / pcSum : 0.5

  const close = () => {
    haptic('light')
    acknowledgeWar(war.warId)
    setVisible(false)
    // Profil nachziehen — Reward-XP sind bereits serverseitig gutgeschrieben
    setTimeout(() => useUserStore.getState().refreshProfile(), 400)
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, overflow: 'hidden',
      background: 'rgba(3,3,8,.88)', backdropFilter: 'blur(8px)' }}>
      <WarStyles />

      {/* Strahlenkranz (nur Sieg) */}
      {win && (
        <div aria-hidden style={{ position: 'absolute', left: '50%', top: 90, width: 560, height: 560,
          transform: 'translateX(-50%)', pointerEvents: 'none', borderRadius: '50%',
          animation: 'warSpin 40s linear infinite',
          maskImage: 'radial-gradient(circle,#000 0%,transparent 62%)',
          WebkitMaskImage: 'radial-gradient(circle,#000 0%,transparent 62%)',
          background: `repeating-conic-gradient(rgba(251,191,36,.13) 0deg 9deg, transparent 9deg 18deg)` }} />
      )}

      {/* Konfetti (nur Sieg) */}
      {win && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {CONFETTI.map((c, i) => (
            <span key={i} style={{ position: 'absolute', left: `${12 + i * 18}%`, top: 0,
              width: 5 + (i % 2), height: 7 + (i % 3) * 2, borderRadius: 2, background: c,
              opacity: .9, animation: `warConf ${3 + (i % 3) * 0.6}s ease-in ${i * 0.45}s infinite` }} />
          ))}
        </div>
      )}

      <div className="war-rise" style={{ position: 'absolute', left: 20, right: 20, top: '7%',
        maxHeight: '86%', overflowY: 'auto', textAlign: 'center' }}>

        {/* Wappen (+ Lorbeer bei Sieg) */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {win && (
            <svg width="150" height="86" viewBox="0 0 150 86" aria-hidden
              style={{ position: 'absolute', left: '50%', top: 52, transform: 'translateX(-50%)' }}>
              <g fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" opacity=".9">
                <path d="M28 78 C10 62 6 40 14 20" /><path d="M122 78 C140 62 144 40 136 20" />
              </g>
              <g fill="#FBBF24" opacity=".95">
                <ellipse cx="17" cy="24" rx="4" ry="9" transform="rotate(-32 17 24)" />
                <ellipse cx="12" cy="40" rx="4" ry="9" transform="rotate(-16 12 40)" />
                <ellipse cx="14" cy="57" rx="4" ry="9" transform="rotate(-4 14 57)" />
                <ellipse cx="22" cy="71" rx="4" ry="9" transform="rotate(16 22 71)" />
                <ellipse cx="133" cy="24" rx="4" ry="9" transform="rotate(32 133 24)" />
                <ellipse cx="138" cy="40" rx="4" ry="9" transform="rotate(16 138 40)" />
                <ellipse cx="136" cy="57" rx="4" ry="9" transform="rotate(4 136 57)" />
                <ellipse cx="128" cy="71" rx="4" ry="9" transform="rotate(-16 128 71)" />
              </g>
            </svg>
          )}
          <Crest name={war.myClan.name} avatarUrl={win ? null : war.myClan.avatarUrl}
            palette={win ? 'gold' : 'violet'} size={92} />
        </div>

        <h2 style={{ ...fd, fontSize: win ? 40 : 26, marginTop: 14, letterSpacing: '-0.02em',
          ...(win
            ? { background: 'linear-gradient(175deg,#FEF3C7 5%,#FBBF24 45%,#B45309 95%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
            : { color: draw ? '#C4B5FD' : 'var(--text-primary)' }) }}>
          {title}
        </h2>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
          color: 'var(--text-secondary)', marginTop: 2, padding: '0 10px' }}>
          {subtitle}
        </p>

        {/* Finale Front */}
        <div style={{ margin: '18px 14px 4px' }}>
          <BeamClash frontline={frontline} height={18} clashSize={34} />
        </div>
        <div className="flex justify-between" style={{ ...fd, fontSize: 12, padding: '4px 26px 0' }}>
          <span style={{ color: '#C4B5FD' }}>{formatNumber(war.myClan.perCapita)}</span>
          <span style={{ fontSize: 8.5, color: 'var(--text-faint)', alignSelf: 'center',
            letterSpacing: '.14em' }}>XP / KRIEGER</span>
          <span style={{ color: '#FDA4AF' }}>{formatNumber(war.rival.perCapita)}</span>
        </div>

        {/* Beute */}
        <div className="war-plate" style={{ margin: '18px 0 0', padding: 16,
          ...(win ? { background: 'linear-gradient(180deg,rgba(251,191,36,.13),rgba(255,255,255,.02))' } : {}) }}>
          <Rivets gold={win} />
          <p className="eyebrow" style={{ color: win ? '#FDE68A' : 'var(--violet-bright)' }}>
            {win ? '💰 Kriegsbeute' : draw ? '🤝 Beide Seiten belohnt' : '🛡 Trost der Tapferen'}
          </p>
          <p style={{ ...fd, fontSize: 36, margin: '4px 0 2px',
            ...(win
              ? { background: 'linear-gradient(175deg,#FEF3C7 5%,#FBBF24 45%,#B45309 95%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
              : { color: '#C4B5FD' }) }}>
            +{formatNumber(war.rewardXp)} XP
          </p>
          <p style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
            {war.rewardXp > 0
              ? 'bereits gutgeschrieben · zählt auf Season-XP'
              : 'Ohne Beitrag keine Beute — nächste Woche zählt jede XP!'}
          </p>
          <div className="flex gap-2 justify-center flex-wrap" style={{ marginTop: 12 }}>
            {win && <span className="war-gem gold">🛡 Clan +1 Sieg</span>}
            {!win && !draw && <span className="war-gem">Kein XP-Verlust</span>}
            {war.myRankInClan != null && war.myContribution > 0 && (
              <span className="war-gem">
                {war.myRankInClan === 1 ? '👑' : '⚔'} Dein Beitrag: #{war.myRankInClan} · {formatNumber(war.myContribution)} XP
              </span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16, paddingBottom: 24 }}>
          <GameButton variant={win ? 'gold' : 'violet'} onClick={close} disabled={acking}>
            {win ? '🏆 BEUTE EINSAMMELN' : draw ? '🤝 WEITER' : '🛡 WEITER KÄMPFEN'}
          </GameButton>
        </div>
      </div>
    </div>,
    document.body
  )
}
