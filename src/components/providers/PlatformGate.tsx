// src/components/providers/PlatformGate.tsx
// Placeholder für nicht-unterstützte Plattformen (Telegram Apps Center 6.1).
// VEXALGO ist eine mobile-first Mini App. Wir lassen NUR mobile Telegram-Clients
// durch (android / ios); jedes Desktop- oder Web-Client (tdesktop, macos, weba,
// webk, web, unknown, …) bekommt einen scannbaren QR-Code + Hinweis.
'use client'

import { useEffect, useState } from 'react'

// Allowlist statt Blockliste → fängt ALLE Nicht-Mobile-Varianten ab.
const MOBILE_PLATFORMS = new Set(['android', 'android_x', 'ios'])

export function PlatformGate({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const platform: string | undefined = (window as any).Telegram?.WebApp?.platform
    // Nur blockieren, wenn wir eine eindeutige Nicht-Mobile-Plattform erkennen.
    // (platform === undefined → kein Telegram-Kontext: nicht blocken.)
    if (platform && !MOBILE_PLATFORMS.has(platform)) {
      setBlocked(true)
    }
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
      {/* QR-Code auf weißer Karte — nötig, damit er auf dunklem Grund scannbar ist */}
      <div
        style={{
          background: '#fff',
          padding: 14,
          borderRadius: 18,
          boxShadow: '0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.6)',
          marginBottom: 24,
          lineHeight: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/scan-qr.png"
          width={180}
          height={180}
          alt="Scan to open VEXALGO on your phone"
          style={{ display: 'block', width: 180, height: 180, imageRendering: 'pixelated' }}
          draggable={false}
        />
      </div>

      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>
        Open VEXALGO on your phone
      </h1>
      <p style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.65)', maxWidth: 320, margin: 0 }}>
        VEXALGO is designed for mobile. Scan the QR code with your phone to open it in
        Telegram and start playing.
      </p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 20 }}>
        @Vexalgo_bot
      </p>
    </div>
  )
}
