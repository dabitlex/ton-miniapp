// src/components/game/MysteryBoxSideButton.tsx
// Fixer Button am rechten Bildschirmrand, der NUR erscheint, wenn heute eine
// Mystery Box verfügbar ist (alle Dailies fertig + noch nicht geöffnet).
// Bleibt beim Scrollen an Ort und Stelle (position: fixed, via Portal an <body>).
// Verschwindet automatisch, sobald die Box eingelöst wurde.
// Global gemountet in src/app/(game)/layout.tsx -> auf allen Tabs erreichbar.
'use client'
import { useEffect, useState, useCallback } from 'react'
import { createPortal }       from 'react-dom'
import { authedFetch }        from '@/lib/authedFetch'
import { useUserStore }       from '@/stores/useUserStore'
import { useMysteryBoxStore } from '@/stores/useMysteryBoxStore'
import { Gift } from 'lucide-react'

export function MysteryBoxSideButton() {
  const profileId = useUserStore(s => s.profile?.id)
  const boxOpen   = useMysteryBoxStore(s => s.isOpen)
  const trigger   = useMysteryBoxStore(s => s.trigger)
  const [available, setAvailable] = useState(false)

  const check = useCallback(async () => {
    try {
      const res  = await authedFetch('/api/v1/quests/mystery-box')
      const json = await res.json()
      setAvailable(!!(json.success && json.data.available))
    } catch { /* still: Button bleibt versteckt */ }
  }, [])

  // Beim Laden prüfen ...
  useEffect(() => { if (profileId) check() }, [profileId, check])
  // ... und nach Schließen des Box-Modals erneut (Button verschwindet, sobald beansprucht)
  useEffect(() => { if (!boxOpen && profileId) check() }, [boxOpen, profileId, check])

  if (!available || typeof document === 'undefined') return null

  return createPortal(
    <>
      <style>{`
        @keyframes mbxFabIn{0%{transform:translate(60px,-50%);opacity:0}100%{transform:translateY(-50%);opacity:1}}
        @keyframes mbxFabBob{0%,100%{transform:translateY(-50%)}50%{transform:translate(-3px,-50%)}}
        @keyframes mbxFabPulse{0%{box-shadow:0 0 0 0 rgba(251,191,36,.45)}70%{box-shadow:0 0 0 14px rgba(251,191,36,0)}100%{box-shadow:0 0 0 0 rgba(251,191,36,0)}}
      `}</style>
      <button
        onClick={trigger}
        aria-label="Open Mystery Box"
        style={{
          position: 'fixed', right: 0, top: '58%', transform: 'translateY(-50%)', zIndex: 40,
          width: 50, height: 58, border: 0, cursor: 'pointer',
          borderRadius: '18px 0 0 18px',
          background: 'linear-gradient(180deg,#FCD34D,#F59E0B)',
          boxShadow: '-6px 6px 22px rgba(245,158,11,.45), inset 0 1px 0 rgba(255,255,255,.5), inset -1px 0 0 rgba(0,0,0,.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'mbxFabIn .5s cubic-bezier(.2,1.3,.4,1) both, mbxFabBob 3.2s ease-in-out 1s infinite',
        }}
      >
        <span aria-hidden style={{
          position: 'absolute', inset: -4, borderRadius: '18px 0 0 18px', pointerEvents: 'none',
          animation: 'mbxFabPulse 2.2s ease-out infinite',
        }} />
        <Gift size={24} strokeWidth={2} style={{ color: '#2a1c06' }} />
      </button>
    </>,
    document.body
  )
}
