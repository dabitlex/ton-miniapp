// src/app/page.tsx — VEXALGO Splash Screen
'use client'
import { useEffect, useState }   from 'react'
import { useRouter }             from 'next/navigation'
import { AuthProvider }          from '@/components/providers/AuthProvider'
import { AuroraBackground }      from '@/components/layout/AuroraBackground'
import { useAuthStore }          from '@/stores/useAuthStore'

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
        if (window.location.pathname === '/') window.location.href = '/home'
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
          <p className="text-sm font-bold text-white mb-1">Open this app inside Telegram</p>
          <p className="text-xs max-w-xs break-words" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {authError}
          </p>
        </div>
      </div>
    )
  }

  const statusText = isInitializing ? 'INITIALIZING...' : 'CONNECTING...'

  return (
    <div className="h-dvh relative overflow-hidden flex flex-col items-center justify-center"
      style={{ background: 'var(--bg-void)' }}>

      {/* Indeterminierter Ladebalken-Keyframe (selbst-enthalten) */}
      <style>{`@keyframes splashLoad{0%{left:-42%}100%{left:100%}}`}</style>

      {/* Gleicher lebendiger Aurora-Hintergrund wie die App */}
      <AuroraBackground />

      {/* Logo — pur (kein Ring, kein Halo) */}
      <div className="relative z-10 flex flex-col items-center"
        style={{
          opacity:    visible ? 1 : 0,
          transform:  visible ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(16px)',
          transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-mark.png" alt="VEXALGO" width={104} height={104}
          className="mb-5 float"
          style={{
            objectFit: 'contain',
            // drop-shadow folgt der Logo-Form (kein rechteckiger Schatten wie bei box-shadow)
            filter: 'drop-shadow(0 0 38px rgba(139,92,246,0.45)) drop-shadow(0 0 72px rgba(91,141,239,0.18))',
          }} />

        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 800,
          letterSpacing: '0.06em', color: 'white', marginBottom: 7,
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

      {/* Energie-artiger Ladebalken */}
      <div className="absolute z-10 left-1/2 -translate-x-1/2 flex flex-col items-center"
        style={{
          bottom:     'calc(64px + var(--tg-safe-bottom, 0px))',
          width:      150,
          opacity:    visible ? 1 : 0,
          transition: 'opacity 0.4s ease 0.4s',
        }}>
        <div className="relative w-full overflow-hidden"
          style={{ height: 5, borderRadius: 4, background: 'rgba(255,255,255,0.07)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)' }}>
          <span className="absolute top-0"
            style={{
              height: '100%', width: '42%', borderRadius: 4, left: 0,
              background: 'linear-gradient(90deg, #8B5CF6, #5EEAD4)',
              boxShadow: '0 0 12px rgba(94,234,212,0.6)',
              animation: isInitializing ? 'splashLoad 1.5s ease-in-out infinite' : 'none',
              opacity:   isInitializing ? 1 : 0.5,
            }} />
        </div>
        <p className="text-center" style={{
          marginTop: 11, fontFamily: 'var(--font-display)', fontSize: 9,
          letterSpacing: '0.25em', color: 'rgba(255,255,255,0.22)',
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
