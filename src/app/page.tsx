// src/app/page.tsx — VEXALGO Splash Screen
'use client'
import { useEffect, useState } from 'react'
import { AuthProvider }        from '@/components/providers/AuthProvider'

export default function SplashPage() {
  const [phase, setPhase] = useState<'logo' | 'loading' | 'done'>('logo')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('loading'), 800)
    return () => clearTimeout(t1)
  }, [])

  return (
    <AuthProvider>
      <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
        style={{ background: 'var(--bg-void)' }}>

        {/* Ambient */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2
                          w-80 h-80 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)',
              filter: 'blur(40px)',
              animation: 'pulse-glow 3s ease-in-out infinite',
            }} />
        </div>

        {/* Logo */}
        <div className="relative flex flex-col items-center"
          style={{
            animation: 'float 3s ease-in-out infinite',
            opacity: phase === 'logo' ? 0 : 1,
            transform: phase === 'logo' ? 'scale(0.8) translateY(20px)' : 'scale(1) translateY(0)',
            transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>

          {/* Logo image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="VEXALGO" width={80} height={80}
            className="rounded-2xl mb-5"
            style={{ boxShadow: '0 0 40px rgba(124,58,237,0.5), 0 0 80px rgba(124,58,237,0.2)' }} />

          {/* Brand name */}
          <h1 className="font-display text-4xl font-black tracking-[0.15em] mb-1">
            VEX<span style={{
              background: 'linear-gradient(135deg, #A855F7, #3B82F6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>ALGO</span>
          </h1>
          <p className="text-[11px] font-semibold tracking-[0.3em]"
            style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-display)' }}>
            EARN · LEVEL · DOMINATE
          </p>
        </div>

        {/* Loading bar */}
        {phase === 'loading' && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-32">
            <div className="h-[2px] rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #7C3AED, #A855F7)',
                  animation: 'shimmer 1.2s ease-in-out infinite',
                  width: '60%',
                }} />
            </div>
            <p className="text-center text-[10px] mt-2 font-medium"
              style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-display)',
                letterSpacing: '0.2em' }}>
              INITIALISIERUNG...
            </p>
          </div>
        )}
      </div>
    </AuthProvider>
  )
}
