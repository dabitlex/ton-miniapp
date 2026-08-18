// src/app/page.tsx — VEXALGO Splash Screen
'use client'
import { useEffect, useState }   from 'react'
import { useRouter }             from 'next/navigation'
import { AuthProvider }          from '@/components/providers/AuthProvider'
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
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500,
            color: '#fff', marginBottom: 6 }}>Please open in Telegram</p>
          <p className="text-xs max-w-xs break-words" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {authError}
          </p>
        </div>
      </div>
    )
  }

  const statusText = isInitializing ? 'INITIALIZING' : 'CONNECTING'

  return (
    <div className="h-dvh relative overflow-hidden flex flex-col items-center justify-center"
      style={{ background: 'var(--bg-void)' }}>

      {/* Indeterminierter Ladebalken-Keyframe (selbst-enthalten) */}
      <style>{`@keyframes splashLoad{0%{left:-42%}100%{left:100%}}`}</style>

      {/* Logo — pur (kein Ring, kein Halo) */}
      <div className="relative z-10 flex flex-col items-center"
        style={{
          opacity:    visible ? 1 : 0,
          transform:  visible ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(16px)',
          transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-mark-v2.png" alt="VEXALGO" width={150} height={120}
          className="mb-7"
          style={{
            width: 150, height: 'auto', objectFit: 'contain',
            filter: 'drop-shadow(0 16px 46px rgba(37,99,255,0.45))',
          }} />

        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600,
          letterSpacing: '0.26em', textIndent: '0.26em', color: '#fff', marginBottom: 14,
        }}>
          VEX<span style={{ fontWeight: 300, color: 'var(--text-secondary)' }}>ALGO</span>
        </h1>

        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 8.5, fontWeight: 500,
          letterSpacing: '0.42em', textIndent: '0.42em', color: 'var(--text-muted)',
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
          style={{ height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
          <span className="absolute top-0"
            style={{
              height: '100%', width: '42%', borderRadius: 2, left: 0,
              background: 'linear-gradient(90deg, transparent, #7BA5FF 45%, #2563FF 80%, transparent)',
              animation: isInitializing ? 'splashLoad 1.6s cubic-bezier(.4,0,.2,1) infinite' : 'none',
              opacity:   isInitializing ? 1 : 0.5,
            }} />
        </div>
        <p className="text-center" style={{
          marginTop: 16, fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 500,
          letterSpacing: '0.28em', color: 'var(--text-muted)',
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
