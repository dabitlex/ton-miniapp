// src/components/providers/PlatformGate.tsx
// Placeholder für nicht-unterstützte Plattformen (Telegram Apps Center 6.1).
// VEXALGO ist eine mobile-first Mini App. Auf Desktop-Telegram (tdesktop/macos) 
// zeigen wir einen sauberen Hinweis statt der mobilen UI. Mobile + Web laufen
// normal durch.
'use client'

import { useEffect, useState } from 'react'

const UNSUPPORTED = new Set(['tdesktop', 'macos', 'unknown'])

export function PlatformGate({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const platform: string | undefined = (window as any).Telegram?.WebApp?.platform
    if (platform && UNSUPPORTED.has(platform)) setBlocked(true)
  }, [])

  if (!blocked) return <>{children}</>

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '32px',
        background: '#08080e',
        color: '#fff',
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(94,234,212,0.18))',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
          marginBottom: 24,
        }}
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
             stroke="#5EEAD4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <line x1="11" y1="18" x2="13" y2="18" />
        </svg>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>
        Open VEXALGO on your phone
      </h1>
      <p style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.65)', maxWidth: 320, margin: 0 }}>
        VEXALGO is designed for mobile. Please open it on the Telegram app on your
        smartphone to play.
      </p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 20 }}>
        @Vexalgo_bot
      </p>
    </div>
  )
}
