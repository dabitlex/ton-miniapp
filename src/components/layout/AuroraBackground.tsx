// src/components/layout/AuroraBackground.tsx
'use client'
import { useEffect, useRef } from 'react'

/**
 * Lebendiger Aurora-Hintergrund: driftende Farb-Blobs (CSS) + langsam
 * aufsteigende Partikel (Canvas). Liegt fix hinter dem gesamten App-Inhalt.
 */
export function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let W = 0, H = 0
    let particles: { x: number; y: number; r: number; s: number; a: number; c: string }[] = []
    const colors = ['#A78BFA', '#5B8DEF', '#5EEAD4']

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = canvas.clientWidth
      H = canvas.clientHeight
      canvas.width  = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const seed = () => {
      const count = Math.min(26, Math.round((W * H) / 16000))
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.6 + 0.4,
        s: Math.random() * 0.28 + 0.06,
        a: Math.random() * 0.5 + 0.1,
        c: colors[Math.floor(Math.random() * colors.length)],
      }))
    }
    const loop = () => {
      ctx.clearRect(0, 0, W, H)
      for (const p of particles) {
        p.y -= p.s
        if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W }
        ctx.globalAlpha = p.a
        ctx.fillStyle = p.c
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(loop)
    }

    resize(); seed(); loop()
    const onResize = () => { resize(); seed() }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])

  return (
    <div aria-hidden className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* driftende Blobs */}
      <div className="aurora-blobs">
        <span className="aurora-blob ab1" />
        <span className="aurora-blob ab2" />
        <span className="aurora-blob ab3" />
        <span className="aurora-blob ab4" />
      </div>
      {/* Partikel */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {/* Vignette + unterer Fade für Lesbarkeit */}
      <div className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 80% at 50% 0%, transparent 34%, rgba(7,7,12,0.5) 100%), linear-gradient(180deg, transparent 60%, var(--bg-void) 100%)' }} />
    </div>
  )
}
