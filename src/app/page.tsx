// src/app/page.tsx — VEXALGO Splash Screen
'use client'
import { useEffect, useState } from 'react'
import { useRouter }           from 'next/navigation'
import { AuthProvider }        from '@/components/providers/AuthProvider'
import { useAuthStore }        from '@/stores/useAuthStore'

function SplashContent() {
  const { isAuthenticated, isInitializing, authError } = useAuthStore()
  const router = useRouter()
  const [visible, setVisible] = useState(false)

  // Logo einblenden
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  // Weiterleitung wenn Auth fertig
  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      router.replace('/home')
      // Fallback für Telegram WebView
      const t = setTimeout(() => {
        if (window.location.pathname === '/') {
          window.location.href = '/home'
        }
      }, 800)
      return () => clearTimeout(t)
    }
  }, [isAuthenticated, isInitializing, router])

  // Fehler
  if (!isInitializing && authError) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: 'var(--bg-void)' }}>
        <span className="text-4xl">⚠️</span>
        <div>
          <p className="text-sm font-bold text-white mb-1">
            Open this app inside Telegram
          </p>
          <p className="text-xs max-w-xs break-words"
            style={{ color: 'rgba(255,255,255,0.35)' }}>
            {authError}
          </p>
        </div>
      </div>
    )
  }

  const statusText = isInitializing ? 'INITIALIZING...' : 'CONNECTING...'

  return (
    <div className="h-dvh flex flex-col items-center justify-center overflow-hidden relative"
      style={{ background: 'var(--bg-void)' }}>

      {/* Ambient aurora glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-80 h-80 rounded-full pointer-events-none pulse-glow"
        style={{
          background: 'radial-gradient(circle, rgba(139,92,246,0.22) 0%, rgba(91,141,239,0.06) 45%, transparent 72%)',
          filter: 'blur(36px)',
        }} />

      {/* Logo */}
      <div className="relative flex flex-col items-center z-10"
        style={{
          opacity:    visible ? 1 : 0,
          transform:  visible ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(20px)',
          transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="VEXALGO" width={80} height={80}
          className="rounded-[22px] mb-5 float"
          style={{
            boxShadow: '0 0 44px rgba(139,92,246,0.5), 0 0 90px rgba(91,141,239,0.16)',
          }} />

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 38, fontWeight: 800,
          letterSpacing: '0.06em', color: 'white', marginBottom: 6,
        }}>
          VEX<span style={{
            background: 'linear-gradient(120deg, #C4B5FD, #93C5FD 55%, #99F6E4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>ALGO</span>
        </h1>

        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.32em', color: 'var(--text-faint)',
        }}>
          EARN · LEVEL · DOMINATE
        </p>
      </div>

      {/* Loading bar — immer sichtbar */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-32 z-10"
        style={{
          opacity:    visible ? 1 : 0,
          transition: 'opacity 0.4s ease 0.4s',
        }}>
        <div className="h-[2px] rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full"
            style={{
              background: 'var(--aurora)',
              width: '100%',
              animation: isInitializing
                ? 'shimmer 1.4s ease-in-out infinite'
                : 'none',
              opacity: isInitializing ? 1 : 0.4,
            }} />
        </div>
        <p className="text-center mt-2" style={{
          fontFamily: 'var(--font-display)', fontSize: 9,
          letterSpacing: '0.25em', color: 'rgba(255,255,255,0.2)',
        }}>
          {statusText}
        </p>
      </div>
    </div>
  )
}

export default function EntryPage() {
  return (
    <AuthProvider>
      <SplashContent />
    </AuthProvider>
  )
}
