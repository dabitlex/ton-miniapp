// src/components/layout/MaintenanceGate.tsx
// VEXALGO — Maintenance Gate
// Prüft beim App-Start den Wartungsstatus. Bei aktiver Wartung (und kein
// Admin) wird ein schlichter Wartungs-Screen gezeigt statt der App.
// Der Admin-Bypass passiert serverseitig in /api/v1/status.
'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
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
      <div className="flex h-dvh items-center justify-center bg-[#07070C]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-violet-400" />
      </div>
    )
  }

  // Wartungs-Screen
  if (state === 'maintenance') {
    return (
      <div className="relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-[#07070C] px-8 text-center">
        {/* Ambient Aurora-Glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/3 h-[340px] w-[420px] -translate-x-1/2 -translate-y-1/2"
          style={{ background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.16), transparent 62%)' }}
        />

        <div className="relative z-10 flex flex-col items-center">
          {/* Logo / Wortmarke */}
          <div className="mb-7 font-display text-[26px] font-extrabold tracking-tight text-transparent
                          bg-clip-text bg-[linear-gradient(120deg,#C4B5FD_0%,#93C5FD_55%,#99F6E4_110%)]">
            VEXALGO
          </div>

          {/* Aurora-Ring mit Zahnrad */}
          <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                padding: '3px',
                background: 'conic-gradient(from 140deg,#8B5CF6,#5B8DEF,#5EEAD4,#8B5CF6)',
                WebkitMask: 'linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                animation: 'ring-spin 4s linear infinite',
              }}
            />
            <svg width="40" height="40" viewBox="0 0 24 24" className="text-violet-300"
                 style={{ fill: 'currentColor' }}>
              <path d="M12 8a4 4 0 100 8 4 4 0 000-8zm0 6a2 2 0 110-4 2 2 0 010 4z" />
              <path d="M19.4 13a7.6 7.6 0 000-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 00-1.7-1l-.3-2.5h-4l-.3 2.5a7.6 7.6 0 00-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 000 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 001.7 1l.3 2.5h4l.3-2.5a7.6 7.6 0 001.7-1l2.4 1 2-3.4-2-1.6z" opacity="0.35" />
            </svg>
          </div>

          {/* Text */}
          <h1 className="mb-3 font-display text-[22px] font-extrabold text-white">
            We&apos;ll be right back
          </h1>
          <p className="max-w-[280px] text-[14px] leading-relaxed text-white/55">
            {message || "VEXALGO is currently undergoing a short update to bring you new features. Please check back in a few minutes."}
          </p>
        </div>
      </div>
    )
  }

  // Normalbetrieb → App anzeigen
  return <>{children}</>
}
