// src/components/layout/MaintenanceGate.tsx 
// VEXALGO — Maintenance Gate
// Prüft beim App-Start den Wartungsstatus. Bei aktiver Wartung (und kein
// Admin) wird ein schlichter Wartungs-Screen gezeigt statt der App.
// Der Admin-Bypass passiert serverseitig in /api/v1/status.
'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useT }         from '@/lib/i18n'

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const t = useT()
  const token = useAuthStore(s => s.accessToken)
  const [state, setState] = useState<'checking' | 'open' | 'maintenance'>('checking')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        // Token mitschicken (für Admin-Bypass), aber nicht zwingend nötig.
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`

        const res  = await fetch('/api/v1/status', { headers })
        const json = await res.json()
        if (cancelled) return

        if (json.maintenance === true) {
          setMessage(json.message ?? null)
          setState('maintenance')
        } else {
          setState('open')
        }
      } catch {
        // Status-Check fehlgeschlagen → App NICHT blockieren (fail-open).
        if (!cancelled) setState('open')
      }
    }

    check()
    return () => { cancelled = true }
  }, [token])

  // Während des Checks: nichts (kurzer Moment) — verhindert Aufblitzen der App.
  if (state === 'checking') {
    return (
      <div className="flex h-dvh items-center justify-center" style={{ background: 'var(--bg-void)' }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.12)', borderTopColor: 'var(--blue-2)',
          animation: 'ring-spin .8s linear infinite',
        }} />
      </div>
    )
  }

  // Wartungs-Screen
  if (state === 'maintenance') {
    return (
      <div className="relative flex h-dvh flex-col items-center justify-center overflow-hidden px-8 text-center"
        style={{ background: 'var(--bg-void)' }}>

        <style>{`@keyframes maintLoad{0%{left:-42%}100%{left:100%}}
          @keyframes maintBreathe{0%,100%{opacity:.5}50%{opacity:1}}`}</style>

        {/* Signature-Diagonale wie im Rest der App */}
        <div aria-hidden style={{
          position: 'absolute', top: '-8%', left: '-8%', width: '130%', height: '126%',
          pointerEvents: 'none', opacity: 0.6,
          background: 'linear-gradient(158deg,#2B5DD6 0%,#1C46A8 40%,#12307B 72%,#0C2154 100%)',
          clipPath: 'polygon(72% 0,100% 0,100% 100%,34% 100%)',
        }} />
        <div aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(180deg,rgba(8,13,24,.30) 0%,rgba(8,13,24,.10) 34%,rgba(8,13,24,.52) 74%,rgba(8,13,24,.94) 100%)',
        }} />

        <div className="relative z-10 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-mark-v2.png" alt="VEXALGO" width={104} height={84}
            style={{
              width: 104, height: 'auto', objectFit: 'contain', marginBottom: 30,
              filter: 'drop-shadow(0 14px 40px rgba(37,99,255,0.40))',
            }} />

          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 600,
            letterSpacing: '-0.02em', color: '#fff',
          }}>
            {t('maint.title')}
          </h1>

          <p style={{
            fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)',
            marginTop: 12, maxWidth: 270,
          }}>
            {message || t('maint.body')}
          </p>

          <span className="chip" style={{ marginTop: 22, height: 30 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: 'var(--blue-2)',
              animation: 'maintBreathe 2s ease-in-out infinite',
            }} />
            {t('maint.safe')}
          </span>
        </div>

        {/* Ladelinie */}
        <div className="absolute z-10 left-1/2 -translate-x-1/2 flex flex-col items-center"
          style={{ bottom: 'calc(64px + var(--tg-safe-bottom, 0px))', width: 130 }}>
          <div className="relative w-full overflow-hidden"
            style={{ height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
            <span className="absolute top-0" style={{
              height: '100%', width: '42%', borderRadius: 2, left: 0,
              background: 'linear-gradient(90deg, transparent, #7BA5FF 45%, #2563FF 80%, transparent)',
              animation: 'maintLoad 1.6s cubic-bezier(.4,0,.2,1) infinite',
            }} />
          </div>
          <p style={{
            marginTop: 16, fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 500,
            letterSpacing: '0.28em', color: 'var(--text-muted)',
          }}>
            {t('maint.updating')}
          </p>
        </div>
      </div>
    )
  }

  // Normalbetrieb → App anzeigen
  return <>{children}</>
}
