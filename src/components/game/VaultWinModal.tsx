// src/components/game/VaultWinModal.tsx — VEXALGO 2.0
// Zeigt einen ungelesenen Vault-Gewinn. Global in (game)/layout.tsx gemountet.
// Die XP sind zum Zeitpunkt der Anzeige bereits gutgeschrieben (draw_vault_round);
// "Einsammeln" bestaetigt nur den Screen (acknowledged = true).
'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useVault }     from '@/features/vault/hooks'
import { useUserStore } from '@/stores/useUserStore'
import { useUIStore }   from '@/stores/useUIStore'
import { formatNumber } from '@/lib/utils'
import { Icon, IconTile } from '@/components/ui/Icon'

const fd: React.CSSProperties = { fontFamily: 'var(--font-display)' }

const RANK_LABEL = (rank: number) =>
  rank === 1 ? 'Hauptgewinn' : rank <= 3 ? `${rank}. Platz` : `${rank}. Platz`

export function VaultWinModal() {
  const { vault, acknowledgeWin, acking } = useVault()
  const { haptic } = useUIStore()
  const cardRef = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  const isWin = !!vault && vault.state === 'result'

  useEffect(() => {
    if (isWin && !shown) {
      setShown(true)
      haptic('heavy')
      burst()
    }
    if (!isWin && shown) setShown(false)
  }, [isWin, shown, haptic])

  function burst() {
    const card = cardRef.current
    if (!card) return
    const cols = ['#FFD27A', '#8FF0C0', '#9CC0FF', '#7BA5FF']
    for (let i = 0; i < 22; i++) {
      const s = document.createElement('div')
      const c = cols[i % 4]
      s.style.cssText = `position:absolute;left:50%;top:32%;width:6px;height:6px;border-radius:50%;pointer-events:none;z-index:3;background:${c};box-shadow:0 0 8px ${c}`
      card.appendChild(s)
      const ang = Math.random() * Math.PI * 2
      const dist = 60 + Math.random() * 95
      s.animate(
        [{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
         { transform: `translate(${Math.cos(ang) * dist - 50}%,${Math.sin(ang) * dist - 50}%) scale(0)`, opacity: 0 }],
        { duration: 750 + Math.random() * 350, easing: 'cubic-bezier(.2,.7,.2,1)' }
      ).onfinish = () => s.remove()
    }
  }

  if (!isWin || typeof document === 'undefined') return null
  const v = vault as Extract<typeof vault, { state: 'result' }>

  function close() {
    acknowledgeWin(v.roundId)
    useUserStore.getState().refreshProfile()
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center"
      style={{ padding: 24 }} role="dialog" aria-modal="true">
      <div onClick={close} style={{ position: 'absolute', inset: 0,
        background: 'rgba(4,7,16,.80)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />

      <div ref={cardRef} className="surface animate-pop"
        style={{ position: 'relative', width: '100%', maxWidth: 320,
          padding: '26px 22px 22px', textAlign: 'center', borderRadius: 28, overflow: 'hidden' }}>

        <div aria-hidden style={{ position: 'absolute', left: '50%', top: -40,
          transform: 'translateX(-50%)', width: 230, height: 170, pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(255,210,122,.32), transparent 66%)' }} />

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: 15 }}>
          <div style={{ width: 70, height: 70, borderRadius: 24, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#3B2405',
            background: 'linear-gradient(140deg,#FCD34D,#B45309)',
            boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,.5), 0 12px 30px rgba(245,158,11,.40)' }}>
            <Icon name="lock" size={30} strokeWidth={1.8} />
          </div>
        </div>

        <p className="eyebrow" style={{ position: 'relative', color: 'var(--gold)' }}>
          Weekly Vault{v.roundNumber ? ` · Runde ${v.roundNumber}` : ''}
        </p>

        <h2 style={{ ...fd, fontSize: 19, fontWeight: 600, marginTop: 8, position: 'relative' }}>
          {RANK_LABEL(v.rank)}
        </h2>

        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5, position: 'relative' }}>
          Du hattest {v.myTickets} von {formatNumber(v.totalTickets)} Losen
        </p>

        <p style={{ ...fd, fontSize: 36, fontWeight: 500, marginTop: 16,
          color: 'var(--gold)', position: 'relative' }}>
          +{formatNumber(v.prizeXp)} XP
        </p>
        <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, position: 'relative' }}>
          bereits gutgeschrieben · zählt auf Season-XP
        </p>

        {v.seed && (
          <div className="flex items-center justify-center" style={{ gap: 6, marginTop: 12, position: 'relative' }}>
            <Icon name="lock" size={11} style={{ color: 'var(--text-faint)' }} />
            <p style={{ fontSize: 9.5, color: 'var(--text-faint)' }}>
              Seed {v.seed.slice(0, 6)}…{v.seed.slice(-4)}
            </p>
          </div>
        )}

        <div style={{ marginTop: 20, position: 'relative' }}>
          <button className="btn-primary press" onClick={close} disabled={acking}>
            {acking ? '…' : 'Einsammeln'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
