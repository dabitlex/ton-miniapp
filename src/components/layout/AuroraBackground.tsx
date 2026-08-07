// src/components/layout/AuroraBackground.tsx
'use client'
import { useEffect, useRef } from 'react'

/**
 * Lebendiger Aurora-Hintergrund: driftende Farb-Blobs (CSS) + langsam
 * aufsteigende Partikel (Canvas). Liegt fix hinter dem gesamten App-Inhalt.
 *
 * UPDATE (Aug 2026, Clan-Wars-Angleichung): + Schlachtfeld-Atmosphäre der
 * War-Seiten für die ganze App — dezentes Hex-Grid (oben, ausblendend) und
 * funkelnde Sterne. Bewusst nur die violette Achse (Crimson bleibt exklusiv
 * den Kriegs-Gegnern auf den War-Screens).
 */

// Fixe Sternpositionen (kein Re-Render-Flackern, gleichmäßig verteilt)
const STARS: { left: string; top: string; size: number; delay: number }[] = [
  { left: '12%', top: '8%',  size: 2, delay: 0   },
  { left: '86%', top: '12%', size: 3, delay: 1.0 },
  { left: '68%', top: '5%',  size: 2, delay: 2.0 },
  { left: '30%', top: '16%', size: 2, delay: 0.5 },
  { left: '92%', top: '30%', size: 2, delay: 1.6 },
  { left: '8%',  top: '34%', size: 3, delay: 2.4 },
  { left: '48%', top: '24%', size: 2, delay: 0.9 },
  { left: '76%', top: '44%', size: 2, delay: 1.3 },
]

const HEX_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='97'%3E%3Cpath d='M28 0l28 16v32L28 64 0 48V16z M28 64l28 16v17M28 64L0 80v17' fill='none' stroke='%23A78BFA' stroke-width='1'/%3E%3C/svg%3E\")"

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
      <style>{`
        @keyframes bgTwinkle {
          0%, 100% { opacity: 0.10; }
          50%      { opacity: 0.65; }
        }
      `}</style>

      {/* Hex-Grid — Schlachtfeld-Raster der War-Seiten, sehr dezent,
          nach unten hin ausblendend */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.04,
          backgroundImage: HEX_SVG,
          maskImage: 'linear-gradient(180deg, #000 0%, transparent 55%)',
          WebkitMaskImage: 'linear-gradient(180deg, #000 0%, transparent 55%)',
        }}
      />

      {/* driftende Blobs */}
      <div className="aurora-blobs">
        <span className="aurora-blob ab1" />
        <span className="aurora-blob ab2" />
        <span className="aurora-blob ab3" />
        <span className="aurora-blob ab4" />
      </div>

      {/* funkelnde Sterne — wie auf den War-Screens */}
      {STARS.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: s.left, top: s.top,
            width: s.size, height: s.size,
            background: '#E9D5FF',
            animation: `bgTwinkle 3.5s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}

      {/* Partikel */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Vignette + unterer Fade für Lesbarkeit */}
      <div className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 80% at 50% 0%, transparent 34%, rgba(7,7,12,0.5) 100%), linear-gradient(180deg, transparent 60%, var(--bg-void) 100%)' }} />
    </div>
  )
}
