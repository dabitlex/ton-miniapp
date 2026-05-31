// src/app/page.tsx — VEXALGO Splash Screen
'use client'
import { useEffect, useState } from 'react'
import { useRouter }           from 'next/navigation'
import { AuthProvider }        from '@/components/providers/AuthProvider'
import { useAuthStore }        from '@/stores/useAuthStore'

// SplashContent: wartet auf Auth-Status und leitet weiter
function SplashContent() {
  const { isAuthenticated, isInitializing, authError } = useAuthStore()
  const router = useRouter()
  const [phase, setPhase] = useState<'logo' | 'loading'>('logo')

  useEffect(() => {
    const t = setTimeout(() => setPhase('loading'), 600)
    return () => clearTimeout(t)
  }, [])

  // Weiterleitung sobald authentifiziert
  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      // router.replace als primäre Methode
      router.replace('/home')

      // Fallback: window.location für Telegram WebView
      const t = setTimeout(() => {
        if (window.location.pathname !== '/home') {
          window.location.href = '/home'
        }
      }, 500)
      return () => clearTimeout(t)
    }
  }, [isAuthenticated, isInitializing, router])

  // Fehler anzeigen
  if (!isInitializing && authError) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: 'var(--bg-void)' }}>
        <span className="text-4xl">⚠️</span>
        <div>
          <p className="text-sm font-bold text-white mb-1">
            Open this app inside Telegram
          </p>
          <p className="text-xs max-w-xs break-words" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {authError}
          </p>
        </div>
      </div>
    )
  }

  // Splash UI
  return (
    <div className="h-dvh flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'var(--bg-void)' }}>

      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }} />
      </div>

      {/* Logo + Brand */}
      <div className="relative flex flex-col items-center z-10"
        style={{
          opacity:    phase === 'logo' ? 0 : 1,
          transform:  phase === 'logo' ? 'scale(0.85) translateY(16px)' : 'scale(1) translateY(0)',
          transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="VEXALGO" width={80} height={80}
          className="rounded-2xl mb-5"
          style={{ boxShadow: '0 0 40px rgba(124,58,237,0.5), 0 0 80px rgba(124,58,237,0.15)' }} />

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 36,
          fontWeight: 900,
          letterSpacing: '0.15em',
          color: 'white',
          marginBottom: 4,
        }}>
          VEX<span style={{
            background: 'linear-gradient(135deg, #A855F7, #3B82F6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>ALGO</span>
        </h1>

        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.3em',
          color: 'rgba(255,255,255,0.3)',
        }}>
          EARN · LEVEL · DOMINATE
        </p>
      </div>

      {/* Loading indicator */}
      {phase === 'loading' && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-32 z-10">
          <div className="h-[2px] rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #7C3AED, #A855F7, #06B6D4)',
                animation: 'shimmer 1.4s ease-in-out infinite',
                width: '100%',
              }} />
          </div>
          <p className="text-center mt-2"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 9,
              letterSpacing: '0.25em',
              color: 'rgba(255,255,255,0.2)',
            }}>
            {isInitializing ? 'INITIALISIERUNG...' : 'BEREIT'}
          </p>
        </div>
      )}
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
