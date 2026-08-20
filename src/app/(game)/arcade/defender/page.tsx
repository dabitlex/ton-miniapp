// src/app/(game)/arcade/defender/page.tsx — Vex Defender
//
// Drei Stufen, Endgegner, Ton. Die Spiellogik entspricht der
// abgenommenen Vorschau; Sitzung, Werbung und Bestenliste laufen ueber
// dieselben Bausteine wie XP Rush.
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter }   from 'next/navigation'
import { useArcade }   from '@/features/arcade/hooks'
import { showArcadeAd } from '@/lib/adsgram'
import { useUIStore }  from '@/stores/useUIStore'
import { useI18n }     from '@/lib/i18n'
import { Icon }        from '@/components/ui/Icon'

type Phase = 'intro' | 'countdown' | 'running' | 'over'
const fd: React.CSSProperties = { fontFamily: 'var(--font-display)' }

const LEVELS = [
  { cols: 6, rows: 3, speed: 24, drop: 15, fire: 0.0016, hp: 1 },
  { cols: 7, rows: 4, speed: 36, drop: 19, fire: 0.0030, hp: 1 },
  { cols: 7, rows: 4, speed: 46, drop: 21, fire: 0.0042, hp: 2 },
]

/* ── Ton: synthetisch, standardmaessig aus ──────────────────── */
let AC: AudioContext | null = null
function ac() {
  if (typeof window === 'undefined') return null
  if (!AC) { try { AC = new (window.AudioContext || (window as any).webkitAudioContext)() } catch { return null } }
  if (AC.state === 'suspended') AC.resume()
  return AC
}
function ton(o: { f?: number; f2?: number; t?: OscillatorType; d?: number; v?: number; delay?: number }, an: boolean) {
  if (!an) return
  const a = ac(); if (!a) return
  const { f = 440, f2 = null, t = 'sine', d = .12, v = .18, delay = 0 } = o
  const osc = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + delay
  osc.type = t; osc.frequency.setValueAtTime(f, t0)
  if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), t0 + d)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(v, t0 + .008)
  g.gain.exponentialRampToValueAtTime(.0001, t0 + d)
  osc.connect(g); g.connect(a.destination); osc.start(t0); osc.stop(t0 + d + .02)
}
function rausch(d: number, v: number, an: boolean) {
  if (!an) return
  const a = ac(); if (!a) return
  const n = Math.floor(a.sampleRate * d), buf = a.createBuffer(1, n, a.sampleRate), ch = buf.getChannelData(0)
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n)
  const s = a.createBufferSource(); s.buffer = buf
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900
  const g = a.createGain(); g.gain.value = v
  s.connect(f); f.connect(g); g.connect(a.destination); s.start()
}

interface Enemy {
  art: 'drone' | 'scout' | 'shield'
  x: number; y: number; bx: number; zy: number; w: number; h: number
  hp: number; max: number; schild: number; row: number; ph: number
  flash: number; anflug: boolean; tauch: number; kuehl: number
}
interface Boss { x: number; y: number; w: number; h: number; hp: number; max: number
  vx: number; flash: number; phase: 'fahren' | 'laden' | 'feuern'; pt: number; laserX: number }

export default function DefenderPage() {
  const router = useRouter()
  const { t, lang } = useI18n()
  const { status, startRun, finishRun } = useArcade('defender')
  const toast  = useUIStore(s => s.toast)
  const haptic = useUIStore(s => s.haptic)
  const setNavVisible = useUIStore(s => s.setNavVisible)

  const [phase, setPhase] = useState<Phase>('intro')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [levelNr, setLevelNr] = useState(1)
  const [cd, setCd] = useState(3)
  const [combo, setCombo] = useState(0)
  const [wave, setWave] = useState(1)
  const [banner, setBanner] = useState<{ a: string; b: string } | null>(null)
  const [result, setResult] = useState<{ xp: number; why: string; combo: number; capped: boolean; level: number } | null>(null)
  const [snd, setSnd] = useState(false)

  const wrapRef = useRef<HTMLDivElement>(null)
  const cvRef   = useRef<HTMLCanvasElement>(null)
  const bgRef   = useRef<HTMLCanvasElement>(null)
  const runIdRef = useRef<string | null>(null)
  const endedRef = useRef(false)
  const rafRef  = useRef<number | null>(null)

  // Spielzustand ausserhalb von React — 60 Bilder pro Sekunde vertragen
  // keine State-Updates.
  const S = useRef({
    W: 390, H: 780, t: 0, last: 0, level: 0, score: 0, lives: 3,
    ship: { x: 195, y: 690 }, enemies: [] as Enemy[], bullets: [] as any[],
    bombs: [] as any[], drops: [] as any[], parts: [] as any[], rings: [] as any[],
    pops: [] as any[], boss: null as Boss | null, stars: [] as any[],
    dir: 1, shootT: 0, doubleT: 0, shake: 0, hitStop: 0, total: 1,
    combo: 0, comboT: 0, bestCombo: 0, boost: 0, snd: false,
  })

  useEffect(() => { S.current.snd = snd }, [snd])
  useEffect(() => {
    try { setSnd(localStorage.getItem('vexdef_snd') === '1') } catch { /* ignore */ }
  }, [])

  // Vollbild auf dem ganzen Screen
  useEffect(() => { setNavVisible(false); return () => setNavVisible(true) }, [setNavVisible])

  const SFX = useCallback((was: string) => {
    const an = S.current.snd
    switch (was) {
      case 'schuss':  ton({ f: 900, f2: 420, t: 'square', d: .05, v: .05 }, an); break
      case 'treffer': ton({ f: 260, f2: 80, t: 'square', d: .09, v: .10 }, an); rausch(.1, .08, an); break
      case 'kaputt':  rausch(.3, .22, an); ton({ f: 150, f2: 40, t: 'sawtooth', d: .28, v: .12 }, an); break
      case 'kapsel':  ton({ f: 660, d: .08, v: .14 }, an); ton({ f: 990, d: .10, v: .12, delay: .07 }, an); break
      case 'schaden': rausch(.35, .28, an); ton({ f: 180, f2: 50, t: 'sawtooth', d: .34, v: .18 }, an); break
      case 'stufe':   [523, 659, 784].forEach((f, i) => ton({ f, d: .16, v: .12, delay: i * .09 }, an)); break
      case 'laden':   ton({ f: 180, f2: 900, t: 'sawtooth', d: .9, v: .07 }, an); break
      case 'laser':   rausch(.5, .16, an); ton({ f: 120, f2: 60, t: 'sawtooth', d: .5, v: .14 }, an); break
      case 'sieg':    [523, 659, 784, 1047].forEach((f, i) => ton({ f, d: .22, v: .14, delay: i * .11 }, an)); break
    }
  }, [])

  /* ── Ende ────────────────────────────────────────────────── */
  const endRun = useCallback(async (why: string) => {
    if (endedRef.current) return
    endedRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setPhase('over')
    const s = S.current
    const punkte = Math.round(s.score / 10) * 10   // Vielfaches von 10 fuer die Pruefung
    if (!runIdRef.current) {
      setResult({ xp: 0, why, combo: s.bestCombo, capped: false, level: s.level + 1 }); return
    }
    const r = await finishRun({ runId: runIdRef.current, score: punkte, bestCombo: s.bestCombo })
    runIdRef.current = null
    setResult({ xp: r.xp, why, combo: s.bestCombo, capped: !!r.capped, level: s.level + 1 })
  }, [finishRun])

  /* ── Spielschleife ───────────────────────────────────────── */
  const loop = useCallback((ts: number) => {
    const s = S.current
    if (endedRef.current) return
    const cv = cvRef.current, bg = bgRef.current
    if (!cv || !bg) return
    const ctx = cv.getContext('2d')!, bx = bg.getContext('2d')!
    let dt = Math.min((ts - s.last) / 1000, .05); s.last = ts; s.t += dt
    const W = s.W, H = s.H

    // Sterne
    bx.clearRect(0, 0, W, H)
    const g1 = bx.createRadialGradient(W * .72, H * .22, 0, W * .72, H * .22, W * .85)
    g1.addColorStop(0, 'rgba(37,99,255,.20)'); g1.addColorStop(1, 'rgba(37,99,255,0)')
    bx.fillStyle = g1; bx.fillRect(0, 0, W, H)
    const g2 = bx.createRadialGradient(W * .2, H * .8, 0, W * .2, H * .8, W * .7)
    g2.addColorStop(0, 'rgba(109,40,217,.16)'); g2.addColorStop(1, 'rgba(109,40,217,0)')
    bx.fillStyle = g2; bx.fillRect(0, 0, W, H)
    for (const st of s.stars) {
      st.y += st.v * dt * (1 + s.boost)
      if (st.y > H + 4) { st.y = -4; st.x = Math.random() * W }
      bx.globalAlpha = st.a; bx.fillStyle = st.e === 2 ? '#BFD4FF' : '#fff'
      bx.beginPath(); bx.arc(st.x, st.y, st.r, 0, 6.283); bx.fill()
    }
    bx.globalAlpha = 1

    if (s.hitStop > 0) { s.hitStop -= dt; drawAll(ctx); rafRef.current = requestAnimationFrame(loop); return }

    const L = LEVELS[s.level]!
    if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 42)
    s.boost = Math.max(0, s.boost - dt * 1.6)
    if (s.combo > 0) { s.comboT -= dt; if (s.comboT <= 0) { s.combo = 0; setCombo(0) } }

    // Feuern
    s.shootT -= dt
    if (s.shootT <= 0) {
      s.shootT = s.doubleT > 0 ? .15 : .25
      if (s.doubleT > 0) { s.bullets.push({ x: s.ship.x - 9, y: s.ship.y - 14 }); s.bullets.push({ x: s.ship.x + 9, y: s.ship.y - 14 }) }
      else s.bullets.push({ x: s.ship.x, y: s.ship.y - 17 })
      SFX('schuss')
    }
    if (s.doubleT > 0) s.doubleT -= dt
    for (let i = s.bullets.length - 1; i >= 0; i--) { s.bullets[i].y -= 600 * dt; if (s.bullets[i].y < -26) s.bullets.splice(i, 1) }

    // Formation
    if (s.enemies.length) {
      const imAnflug = s.enemies.some(e => e.anflug)
      let minX = 1e9, maxX = -1e9
      for (const e of s.enemies) { minX = Math.min(minX, e.bx - e.w / 2); maxX = Math.max(maxX, e.bx + e.w / 2) }
      const v = L.speed * (1 + (1 - s.enemies.length / s.total) * 1.5)
      let runter = false
      if (!imAnflug) {
        if (s.dir > 0 && maxX + v * dt > W - 16) runter = true
        if (s.dir < 0 && minX - v * dt < 16) runter = true
      }
      for (const e of s.enemies) {
        if (e.flash > 0) e.flash -= dt * 5
        if (e.anflug) {
          e.x += (e.bx - e.x) * Math.min(1, dt * 4.2)
          e.y += (e.zy - e.y) * Math.min(1, dt * 4.2)
          if (Math.abs(e.y - e.zy) < 1.5 && Math.abs(e.x - e.bx) < 1.5) { e.anflug = false; e.y = e.zy }
          continue
        }
        if (e.art === 'scout') {
          if (e.tauch > 0) {
            e.tauch -= dt; e.y += 210 * dt; e.x += Math.sin(s.t * 7 + e.ph) * 70 * dt
            if (e.y > H - 104) { endRun(lang === 'de' ? 'Durchgebrochen' : 'They broke through'); return }
            if (e.tauch <= 0) e.zy = Math.max(120, e.y - 150)
            continue
          }
          e.kuehl -= dt
          if (e.kuehl <= 0) { e.tauch = 1.5; e.kuehl = 6 + Math.random() * 5; s.bombs.push({ x: e.x, y: e.y + 14 }); continue }
          if (Math.abs(e.y - e.zy) > 1) e.y += (e.zy - e.y) * Math.min(1, dt * 2.4)
        }
        if (runter) { e.y += L.drop; e.zy += L.drop } else e.bx += s.dir * v * dt
        e.x = e.bx + Math.sin(s.t * 1.9 + e.ph) * 4
        if (Math.random() < L.fire * dt * 60) s.bombs.push({ x: e.x, y: e.y + 15 })
        if (e.y > H - 118) { endRun(lang === 'de' ? 'Durchgebrochen' : 'They broke through'); return }
      }
      if (runter) s.dir *= -1
    }

    // Endgegner
    const b = s.boss
    if (b) {
      if (b.flash > 0) b.flash -= dt * 5
      b.pt -= dt
      const wut = 1 + (1 - b.hp / b.max) * .9
      if (b.phase === 'fahren') {
        b.x += b.vx * wut * dt
        if (b.x > W - b.w / 2 - 14) { b.x = W - b.w / 2 - 14; b.vx *= -1 }
        if (b.x < b.w / 2 + 14) { b.x = b.w / 2 + 14; b.vx *= -1 }
        if (Math.random() < .05 * wut) s.bombs.push({ x: b.x + (Math.random() - .5) * 56, y: b.y + 28 })
        if (b.pt <= 0) { b.phase = 'laden'; b.pt = 1.1; b.laserX = s.ship.x; SFX('laden') }
      } else if (b.phase === 'laden') {
        b.laserX += (s.ship.x - b.laserX) * Math.min(1, dt * 1.5)
        b.x += (b.laserX - b.x) * Math.min(1, dt * 1.1)
        if (b.pt <= 0) { b.phase = 'feuern'; b.pt = .75; SFX('laser'); s.shake = 12 }
      } else {
        if (Math.abs(s.ship.x - b.laserX) < 19 && s.ship.y > b.y) {
          treffer(); if (endedRef.current) return
          b.pt = Math.min(b.pt, .12)
        }
        if (b.pt <= 0) { b.phase = 'fahren'; b.pt = 2.6 / wut }
      }
    }

    for (let i = s.bombs.length - 1; i >= 0; i--) {
      const bo = s.bombs[i]; bo.y += 265 * dt
      if (bo.y > H + 24) { s.bombs.splice(i, 1); continue }
      if (Math.abs(bo.x - s.ship.x) < 15 && Math.abs(bo.y - s.ship.y) < 17) {
        s.bombs.splice(i, 1); treffer(); if (endedRef.current) return
      }
    }
    for (let i = s.drops.length - 1; i >= 0; i--) {
      const d = s.drops[i]; d.y += 125 * dt; d.rot += dt * 2.2
      if (d.y > H + 24) { s.drops.splice(i, 1); continue }
      if (Math.abs(d.x - s.ship.x) < 26 && Math.abs(d.y - s.ship.y) < 26) {
        s.drops.splice(i, 1); s.doubleT = 8
        burst(d.x, d.y, '#FFD27A', 18); ring(d.x, d.y, '#FFD27A', 44)
        pop(d.x, d.y, lang === 'de' ? 'DOPPELSCHUSS' : 'DOUBLE SHOT', '#FFD27A')
        SFX('kapsel'); haptic?.('light')
      }
    }

    // Treffer
    for (let i = s.bullets.length - 1; i >= 0; i--) {
      const bu = s.bullets[i]; let weg = false
      for (let j = s.enemies.length - 1; j >= 0; j--) {
        const e = s.enemies[j]!
        if (Math.abs(bu.x - e.x) < e.w / 2 + 3 && Math.abs(bu.y - e.y) < e.h / 2 + 6) {
          s.bullets.splice(i, 1); weg = true; e.flash = 1
          if (e.schild > 0) { e.schild--; burst(e.x, e.y - 2, '#8FB4FF', 8, .7); ring(e.x, e.y, '#8FB4FF', 30); SFX('treffer'); break }
          e.hp--
          if (e.hp <= 0) {
            const c = e.max > 1 ? '#C4B5FD' : e.art === 'scout' ? '#FFB27A' : '#FF8FA6'
            burst(e.x, e.y, c, 16); ring(e.x, e.y, c)
            s.enemies.splice(j, 1)
            s.combo++; s.bestCombo = Math.max(s.bestCombo, s.combo); s.comboT = 2.2
            const f = s.combo >= 12 ? 3 : s.combo >= 6 ? 2 : 1
            setCombo(f > 1 ? s.combo : 0)
            const pkt = (50 + (L.rows - e.row) * 10) * f
            s.score += pkt; setScore(s.score)
            pop(e.x, e.y, '+' + pkt, f > 1 ? '#FFD27A' : '#BFD4FF')
            s.hitStop = .028; s.shake = Math.min(s.shake + 3, 9); s.boost = Math.min(s.boost + .5, 1.6)
            SFX('kaputt')
            if (Math.random() < .10) s.drops.push({ x: e.x, y: e.y, rot: 0 })
            setWave(s.enemies.length / s.total)
          } else { burst(e.x, e.y, '#DDD6FE', 6, .6); SFX('treffer') }
          break
        }
      }
      if (weg) continue
      if (b && Math.abs(bu.x - b.x) < b.w / 2 && Math.abs(bu.y - b.y) < b.h / 2) {
        s.bullets.splice(i, 1); b.hp--; b.flash = 1
        burst(bu.x, bu.y, '#FFD27A', 6, .7); s.hitStop = .02; setWave(b.hp / b.max)
        if (b.hp <= 0) {
          const bxp = b.x, byp = b.y
          for (let k = 0; k < 5; k++) setTimeout(() => burst(bxp, byp, '#FFD27A', 22, 1.4), k * 90)
          ring(bxp, byp, '#FFD27A', 180); s.shake = 20
          s.score += 2000; setScore(s.score); s.boss = null
          SFX('sieg')
          setTimeout(() => endRun(lang === 'de' ? 'Geschafft!' : 'Cleared!'), 900)
          endedRef.current = false
          return
        }
      }
    }

    for (let i = s.parts.length - 1; i >= 0; i--) {
      const p = s.parts[i]; p.age += dt
      if (p.age >= p.life) { s.parts.splice(i, 1); continue }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.vx *= .985
    }
    for (let i = s.rings.length - 1; i >= 0; i--) {
      const r = s.rings[i]; r.age += dt
      if (r.age >= r.life) { s.rings.splice(i, 1); continue }
      r.r = 5 + (r.max - 5) * (r.age / r.life)
    }
    for (let i = s.pops.length - 1; i >= 0; i--) { s.pops[i].age += dt; if (s.pops[i].age >= s.pops[i].life) s.pops.splice(i, 1) }

    // Welle geschafft
    if (!s.enemies.length && !s.boss) {
      if (s.level === 2) {
        s.boss = { x: W / 2, y: 158, w: 104, h: 56, hp: 44, max: 44, vx: 76, flash: 0, phase: 'fahren', pt: 3.2, laserX: W / 2 }
        setWave(1); setBanner({ a: lang === 'de' ? 'Endgegner' : 'Boss', b: lang === 'de' ? 'Halte durch.' : 'Hold on.' })
        setTimeout(() => setBanner(null), 1600)
      } else {
        s.level++
        if (s.level >= LEVELS.length) { endRun(lang === 'de' ? 'Geschafft!' : 'Cleared!'); return }
        setLevelNr(s.level + 1); SFX('stufe')
        setBanner({ a: (lang === 'de' ? 'Stufe ' : 'Level ') + (s.level + 1),
          b: s.level === 1 ? (lang === 'de' ? 'Schneller. Mehr davon.' : 'Faster. More of them.')
                           : (lang === 'de' ? 'Der Endgegner wartet.' : 'The boss is waiting.') })
        setTimeout(() => setBanner(null), 1600)
        buildWave()
      }
    }

    drawAll(ctx)
    rafRef.current = requestAnimationFrame(loop)

    /* ── Hilfsfunktionen im Schleifen-Scope ── */
    function treffer() {
      s.lives--; setLives(s.lives); s.shake = 18; s.hitStop = .06
      s.combo = 0; setCombo(0)
      burst(s.ship.x, s.ship.y, '#FF8FA6', 26, 1.3); ring(s.ship.x, s.ship.y, '#FF8FA6', 70)
      SFX('schaden'); haptic?.('heavy')
      if (s.lives <= 0) { endRun(lang === 'de' ? 'Schiff zerstört' : 'Ship destroyed'); return }
      s.bombs = []
    }
  }, [SFX, endRun, haptic, lang])

  /* ── Zeichnen und Effekte (ausserhalb der Schleife definiert) ── */
  const burst = useCallback((x: number, y: number, c: string, n = 14, kraft = 1) => {
    const s = S.current
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = (50 + Math.random() * 190) * kraft
      s.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: .45 + Math.random() * .4, age: 0, c })
    }
  }, [])
  const ring = useCallback((x: number, y: number, c: string, max = 52) => {
    S.current.rings.push({ x, y, r: 5, max, age: 0, life: .42, c })
  }, [])
  const pop = useCallback((x: number, y: number, text: string, c: string) => {
    S.current.pops.push({ x, y, text, c, age: 0, life: .8 })
  }, [])

  const drawAll = useCallback((ctx: CanvasRenderingContext2D) => {
    const s = S.current, W = s.W, H = s.H
    ctx.clearRect(0, 0, W, H)
    ctx.save()
    if (s.shake > 0) ctx.translate((Math.random() - .5) * s.shake, (Math.random() - .5) * s.shake)

    for (const b of s.bullets) {
      const g = ctx.createLinearGradient(0, b.y - 22, 0, b.y + 4)
      g.addColorStop(0, 'rgba(143,180,255,0)'); g.addColorStop(1, 'rgba(223,235,255,1)')
      ctx.fillStyle = g; ctx.fillRect(b.x - 1.6, b.y - 22, 3.2, 26)
      ctx.shadowColor = 'rgba(143,180,255,.95)'; ctx.shadowBlur = 12
      ctx.fillStyle = '#EAF1FF'; ctx.beginPath(); ctx.roundRect(b.x - 2, b.y - 6, 4, 9, 2); ctx.fill(); ctx.shadowBlur = 0
    }
    for (const b of s.bombs) {
      const g = ctx.createLinearGradient(0, b.y - 4, 0, b.y + 18)
      g.addColorStop(0, 'rgba(255,143,166,1)'); g.addColorStop(1, 'rgba(255,143,166,0)')
      ctx.fillStyle = g; ctx.fillRect(b.x - 1.8, b.y - 4, 3.6, 22)
      ctx.shadowColor = 'rgba(255,90,120,.9)'; ctx.shadowBlur = 12
      ctx.fillStyle = '#FFD3DC'; ctx.beginPath(); ctx.roundRect(b.x - 2.4, b.y - 6, 4.8, 10, 3); ctx.fill(); ctx.shadowBlur = 0
    }
    for (const d of s.drops) {
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot)
      ctx.shadowColor = 'rgba(245,158,11,.95)'; ctx.shadowBlur = 20
      const g = ctx.createLinearGradient(0, -10, 0, 10)
      g.addColorStop(0, '#FFF0CC'); g.addColorStop(1, '#F59E0B')
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-10, -10, 20, 20, 7); ctx.fill(); ctx.shadowBlur = 0
      ctx.strokeStyle = '#3B2405'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.stroke()
      ctx.restore()
    }

    const b = s.boss
    if (b && b.phase !== 'fahren') {
      const laden = b.phase === 'laden', p = laden ? 1 - b.pt / 1.1 : 1
      const br = laden ? 3 + p * 7 : 34
      const gx = ctx.createLinearGradient(b.laserX - br, 0, b.laserX + br, 0)
      gx.addColorStop(0, 'rgba(255,143,166,0)')
      gx.addColorStop(.5, laden ? `rgba(255,143,166,${.25 + p * .5})` : 'rgba(255,235,240,.95)')
      gx.addColorStop(1, 'rgba(255,143,166,0)')
      ctx.fillStyle = gx; ctx.fillRect(b.laserX - br, b.y + 20, br * 2, H - b.y - 20)
      if (!laden) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(b.laserX - 4, b.y + 20, 8, H - b.y - 20) }
    }

    const hex = (r: number) => {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + i * Math.PI / 3
        const x = Math.cos(a) * r, y = Math.sin(a) * r
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
      }
      ctx.closePath()
    }
    for (const e of s.enemies) {
      const stark = e.art === 'shield' || e.max > 1, scout = e.art === 'scout'
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.sin(s.t * (scout ? 3.2 : 1.4) + e.ph) * (scout ? .30 : .12))
      const r = e.w / 2
      ctx.shadowColor = scout ? 'rgba(255,178,122,.75)' : stark ? 'rgba(167,139,250,.75)' : 'rgba(244,63,94,.7)'
      ctx.shadowBlur = scout ? 20 : 16
      const g = ctx.createLinearGradient(0, -r, 0, r)
      if (scout) { g.addColorStop(0, '#FFE0C2'); g.addColorStop(1, '#C2410C') }
      else if (stark) { g.addColorStop(0, '#DDD6FE'); g.addColorStop(1, '#5B21B6') }
      else { g.addColorStop(0, '#FFC9D4'); g.addColorStop(1, '#9F1239') }
      ctx.fillStyle = g; hex(r); ctx.fill(); ctx.shadowBlur = 0
      if (e.schild > 0) {
        const puls = .45 + Math.sin(s.t * 6 + e.ph) * .2
        ctx.strokeStyle = `rgba(143,180,255,${puls * (e.schild / 2) + .25})`
        ctx.lineWidth = 2.6; ctx.shadowColor = 'rgba(143,180,255,.8)'; ctx.shadowBlur = 12
        ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, 6.283); ctx.stroke(); ctx.shadowBlur = 0
      }
      const puls = .55 + Math.sin(s.t * 4 + e.ph) * .2
      ctx.fillStyle = `rgba(255,255,255,${puls})`
      ctx.beginPath(); ctx.arc(0, 0, r * .30, 0, 6.283); ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,.42)'; ctx.lineWidth = 1.4; hex(r * .62); ctx.stroke()
      if (e.flash > 0) { ctx.globalAlpha = e.flash; ctx.fillStyle = '#fff'; hex(r); ctx.fill(); ctx.globalAlpha = 1 }
      ctx.restore()
    }

    if (b) {
      ctx.save(); ctx.translate(b.x, b.y + Math.sin(s.t * 1.6) * 5)
      ctx.shadowColor = 'rgba(245,158,11,.7)'; ctx.shadowBlur = 26
      const g = ctx.createLinearGradient(0, -b.h / 2, 0, b.h / 2)
      g.addColorStop(0, '#FFD98F'); g.addColorStop(.45, '#F5A524'); g.addColorStop(1, '#7C2D12')
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, 20); ctx.fill(); ctx.shadowBlur = 0
      ctx.strokeStyle = 'rgba(124,45,18,.55)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.roundRect(-b.w / 2 + 7, -b.h / 2 + 6, b.w - 14, b.h - 12, 14); ctx.stroke()
      const p = .5 + Math.sin(s.t * 5) * .3
      ctx.fillStyle = `rgba(59,36,5,${.55 + p * .4})`
      ctx.beginPath(); ctx.roundRect(-30, -12, 20, 8, 4); ctx.fill()
      ctx.beginPath(); ctx.roundRect(10, -12, 20, 8, 4); ctx.fill()
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.roundRect(-b.w / 2 + 12, b.h / 2 - 12, b.w - 24, 5, 3); ctx.fill()
      const hg = ctx.createLinearGradient(-b.w / 2, 0, b.w / 2, 0)
      hg.addColorStop(0, '#fff'); hg.addColorStop(1, '#FFD27A')
      ctx.fillStyle = hg; ctx.beginPath(); ctx.roundRect(-b.w / 2 + 12, b.h / 2 - 12, (b.w - 24) * (b.hp / b.max), 5, 3); ctx.fill()
      if (b.flash > 0) {
        ctx.globalAlpha = Math.min(b.flash, .55); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3
        ctx.beginPath(); ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, 20); ctx.stroke(); ctx.globalAlpha = 1
      }
      ctx.restore()
    }

    // Schiff
    ctx.save(); ctx.translate(s.ship.x, s.ship.y)
    const glut = s.combo >= 6 ? 1 : s.combo >= 3 ? .6 : .25
    const f = 8 + Math.sin(s.t * 32) * 4 + (s.doubleT > 0 ? 4 : 0)
    const fg = ctx.createLinearGradient(0, 10, 0, 22 + f)
    fg.addColorStop(0, 'rgba(191,212,255,.95)'); fg.addColorStop(1, 'rgba(37,99,255,0)')
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-5, 10); ctx.lineTo(5, 10); ctx.lineTo(0, 22 + f); ctx.closePath(); ctx.fill()
    ctx.shadowColor = `rgba(37,99,255,${.55 + glut * .45})`; ctx.shadowBlur = 16 + glut * 20
    const sg = ctx.createLinearGradient(0, -18, 0, 14)
    sg.addColorStop(0, '#DCE8FF'); sg.addColorStop(.45, '#7BA5FF'); sg.addColorStop(1, '#1D4ED8')
    ctx.fillStyle = sg; ctx.beginPath()
    ctx.moveTo(0, -18); ctx.lineTo(15, 13); ctx.lineTo(0, 6); ctx.lineTo(-15, 13); ctx.closePath(); ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(0, -4, 2.6, 0, 6.283); ctx.fill()
    ctx.restore()

    for (const r of s.rings) {
      const a = 1 - r.age / r.life
      ctx.globalAlpha = Math.max(0, a * .8); ctx.strokeStyle = r.c; ctx.lineWidth = 2.4 * a + .5
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 6.283); ctx.stroke()
    }
    ctx.globalAlpha = 1
    for (const p of s.parts) {
      const a = 1 - p.age / p.life
      ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = p.c
      ctx.shadowColor = p.c; ctx.shadowBlur = 8 * a
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.8 * a + .5, 0, 6.283); ctx.fill()
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1
    ctx.textAlign = 'center'; ctx.font = '600 14px Poppins, sans-serif'
    for (const p of s.pops) {
      const a = 1 - p.age / p.life
      ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = p.c
      ctx.fillText(p.text, p.x, p.y - p.age * 44)
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }, [])

  const buildWave = useCallback(() => {
    const s = S.current, L = LEVELS[s.level]!, W = s.W
    const mx = 28, gapY = 46, cellW = (W - mx * 2) / L.cols
    s.enemies = []; s.bombs = []; s.drops = []
    for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) {
      const zx = mx + cellW * c + cellW / 2, zy = 128 + r * gapY
      let art: Enemy['art'] = 'drone'
      if (s.level >= 1 && r === 0 && c % 2 === 0) art = 'shield'
      if (s.level >= 1 && r === L.rows - 1 && c % 3 === 1) art = 'scout'
      if (s.level === 2 && r === 1 && c % 3 === 2) art = 'shield'
      const hp = art === 'shield' ? 1 : L.hp
      s.enemies.push({ art, bx: zx, zy, x: zx + (Math.random() - .5) * 70,
        y: -70 - r * 54 - Math.random() * 40, w: art === 'scout' ? 22 : 27, h: art === 'scout' ? 22 : 27,
        hp, max: hp, schild: art === 'shield' ? 2 : 0, row: r, ph: Math.random() * 6.283,
        flash: 0, anflug: true, tauch: 0, kuehl: 1.5 + Math.random() * 4 })
    }
    s.total = s.enemies.length; s.dir = 1; setWave(1)
  }, [])

  /* ── Start ───────────────────────────────────────────────── */
  const begin = useCallback(async (withAd: boolean) => {
    try {
      if (withAd) {
        const res = await showArcadeAd()
        if (res !== 'watched') {
          toast?.('warning', lang === 'de' ? 'Werbung nicht abgespielt — Runde nicht gestartet.'
                                           : 'Ad was not shown — round not started.')
          return
        }
      }
      const run = await startRun(withAd)
      runIdRef.current = run.runId
    } catch (e: any) {
      toast?.('error', e?.message ?? (lang === 'de' ? 'Start fehlgeschlagen' : 'Could not start'))
      return
    }

    const wrap = wrapRef.current, cv = cvRef.current, bg = bgRef.current
    if (!wrap || !cv || !bg) return
    const DPR = Math.min(window.devicePixelRatio || 1, 2.5)
    const W = wrap.clientWidth, H = wrap.clientHeight
    for (const c of [cv, bg]) { c.width = W * DPR; c.height = H * DPR }
    cv.getContext('2d')!.setTransform(DPR, 0, 0, DPR, 0, 0)
    bg.getContext('2d')!.setTransform(DPR, 0, 0, DPR, 0, 0)

    const s = S.current
    s.W = W; s.H = H; s.level = 0; s.score = 0; s.lives = 3; s.combo = 0; s.bestCombo = 0
    s.doubleT = 0; s.shake = 0; s.hitStop = 0; s.boost = 0; s.t = 0
    s.bullets = []; s.bombs = []; s.drops = []; s.parts = []; s.rings = []; s.pops = []; s.boss = null
    s.ship = { x: W / 2, y: H - 96 }
    s.stars = []
    const n = Math.round(W * H / 9000)
    for (let i = 0; i < n; i++) {
      const e = Math.random() < .55 ? 0 : (Math.random() < .7 ? 1 : 2)
      s.stars.push({ x: Math.random() * W, y: Math.random() * H,
        r: [0.7, 1.2, 1.9][e], v: [9, 20, 42][e], a: [.30, .55, .85][e], e })
    }
    endedRef.current = false
    setScore(0); setLives(3); setLevelNr(1); setCombo(0); setResult(null); setWave(1)
    buildWave()
    setBanner({ a: lang === 'de' ? 'Stufe 1' : 'Level 1', b: lang === 'de' ? 'Zum Warmwerden.' : 'A gentle start.' })
    setTimeout(() => setBanner(null), 1600)
    setPhase('countdown'); setCd(3)
  }, [startRun, toast, lang, buildWave])

  useEffect(() => {
    if (phase !== 'countdown') return
    if (cd < 0) {
      setPhase('running')
      S.current.last = performance.now()
      rafRef.current = requestAnimationFrame(loop)
      return
    }
    const to = setTimeout(() => setCd(c => c - 1), 850)
    return () => clearTimeout(to)
  }, [phase, cd, loop])

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  const move = useCallback((clientX: number) => {
    const wrap = wrapRef.current
    if (!wrap || phase !== 'running') return
    const r = wrap.getBoundingClientRect()
    S.current.ship.x = Math.max(20, Math.min(S.current.W - 20, clientX - r.left))
  }, [phase])

  const nf = (n: number) => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US').format(n)
  const runsLeft = status?.runsLeft ?? 0
  const board    = status?.board ?? null
  const oben     = 'calc(var(--tg-safe-area-top, 0px) + var(--tg-content-top, 48px))'

  if (status && !status.enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full relative z-10" style={{ padding: 32 }}>
        <p style={{ ...fd, fontSize: 15, fontWeight: 500 }}>Vex Defender</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
          {lang === 'de' ? 'Bald verfügbar.' : 'Coming soon.'}
        </p>
        <button className="btn-secondary press" style={{ marginTop: 20, width: 'auto', padding: '0 20px', height: 42 }}
          onClick={() => router.push('/arcade')}>{t('common.back')}</button>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative z-10" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
      onPointerDown={e => { if (!(e.target as HTMLElement).closest('button')) move(e.clientX) }}
      onPointerMove={e => { if (e.buttons || e.pointerType === 'touch') move(e.clientX) }}>

      <canvas ref={bgRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }} />
      <canvas ref={cvRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2 }} />

      {/* HUD */}
      {phase === 'running' && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6,
            paddingTop: oben, paddingLeft: 20, paddingRight: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pointerEvents: 'none' }}>
            <div>
              <p className="eyebrow">{lang === 'de' ? 'Punkte' : 'Score'}</p>
              <p style={{ ...fd, fontSize: 28, fontWeight: 500, marginTop: 2 }}>{nf(score)}</p>
              {combo > 1 && (
                <p style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--gold)', marginTop: 3 }}>
                  ×{combo >= 12 ? 3 : 2} {lang === 'de' ? 'Serie' : 'streak'} · {combo}
                </p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="eyebrow">{lang === 'de' ? `Stufe ${levelNr} von 3` : `Level ${levelNr} of 3`}</p>
              <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', marginTop: 7 }}>
                {[0, 1, 2].map(i => (
                  <svg key={i} viewBox="0 0 24 24" width="16" height="13"
                    style={{ filter: i < lives ? 'drop-shadow(0 0 5px rgba(37,99,255,.85))' : 'none' }}>
                    <path d="M12 3 21 20H3z" fill={i < lives ? '#5B8DFF' : 'rgba(255,255,255,.15)'} />
                  </svg>
                ))}
              </div>
            </div>
          </div>
          <div style={{ position: 'absolute', left: 20, right: 20, zIndex: 6,
            top: `calc(${oben} + 58px)`, height: 3, borderRadius: 3,
            background: 'rgba(255,255,255,.09)', overflow: 'hidden', pointerEvents: 'none' }}>
            <div style={{ height: '100%', borderRadius: 3, width: `${Math.max(0, wave) * 100}%`,
              background: 'linear-gradient(90deg,#7BA5FF,#2563FF)',
              boxShadow: '0 0 10px rgba(37,99,255,.7)', transition: 'width .35s cubic-bezier(.2,.8,.2,1)' }} />
          </div>
        </>
      )}

      {/* Zwischenmeldung */}
      {banner && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 8, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', textAlign: 'center' }}>
          <div style={{ ...fd, fontSize: 46, fontWeight: 600, letterSpacing: '-.03em',
            background: 'linear-gradient(120deg,#fff,#BFD4FF 60%,#5B8DFF)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{banner.a}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>{banner.b}</div>
        </div>
      )}

      {/* Countdown */}
      {phase === 'countdown' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 8, display: 'flex',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span key={cd} style={{ ...fd, fontSize: 78, fontWeight: 600 }}>
            {cd === 0 ? (lang === 'de' ? 'Los!' : 'Go!') : cd}
          </span>
        </div>
      )}

      {/* Intro */}
      {phase === 'intro' && (
        <>
          <button onClick={() => router.push('/arcade')} aria-label={t('common.back')} className="press"
            style={{ position: 'absolute', zIndex: 10, left: 20, top: `calc(${oben} + 6px)`,
              width: 38, height: 38, borderRadius: 13, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              background: 'linear-gradient(150deg,rgba(255,255,255,.16),rgba(255,255,255,.05))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)' }}>
            <Icon name="chevronLeft" size={17} strokeWidth={1.8} />
          </button>

          <div style={{ position: 'absolute', inset: 0, zIndex: 9, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', paddingTop: oben,
            paddingLeft: 32, paddingRight: 32, paddingBottom: 'calc(var(--tg-safe-bottom, 0px) + 16px)',
            textAlign: 'center', overflowY: 'auto' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-mark-v2.png" alt="" width={96} height={77}
              style={{ width: 96, height: 'auto', marginBottom: 20,
                filter: 'drop-shadow(0 14px 44px rgba(37,99,255,.55))' }} />
            <h1 style={{ ...fd, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em' }}>Vex Defender</h1>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', margin: '12px 0 24px', maxWidth: 290 }}>
              {lang === 'de'
                ? 'Drei Stufen. Bewege den Finger — geschossen wird automatisch.'
                : 'Three levels. Move your finger — firing is automatic.'}
            </p>

            <div style={{ width: '100%' }}>
              {([
                ['#FB7185', '#9F1239', lang === 'de' ? 'Drohnen' : 'Drones',
                  lang === 'de' ? 'Rücken vor und schießen zurück.' : 'They advance and shoot back.'],
                ['#FFD27A', '#B45309', lang === 'de' ? 'Kapseln' : 'Capsules',
                  lang === 'de' ? 'Doppelschuss für 8 Sekunden.' : 'Double shot for 8 seconds.'],
                ['#7BA5FF', '#1D4ED8', lang === 'de' ? 'Drei Leben' : 'Three lives',
                  lang === 'de' ? 'Stufe 3 endet mit dem Endgegner.' : 'Level 3 ends with the boss.'],
              ] as const).map(([c1, c2, titel, sub]) => (
                <div key={titel} style={{ display: 'flex', alignItems: 'center', gap: 13,
                  textAlign: 'left', marginBottom: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                    background: `linear-gradient(140deg,${c1},${c2})`,
                    boxShadow: 'inset 0 2px 0 rgba(255,255,255,.30)' }} />
                  <div>
                    <p style={{ ...fd, fontSize: 13.5, fontWeight: 500 }}>{titel}</p>
                    <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 4, alignItems: 'center' }}>
              <button className="btn-primary press" style={{ flex: 1 }}
                onClick={() => begin(runsLeft <= 0)}>
                {runsLeft > 0
                  ? (lang === 'de' ? 'Spiel starten' : 'Start game')
                  : (<><Icon name="tv" size={17} />{lang === 'de' ? 'Runde per Werbung' : 'Round via ad'}</>)}
              </button>
              <button onClick={() => { const n = !snd; setSnd(n); try { localStorage.setItem('vexdef_snd', n ? '1' : '0') } catch {} }}
                aria-label="Ton" className="press"
                style={{ width: 50, height: 50, flexShrink: 0, border: 'none', borderRadius: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: snd ? 'var(--blue-3)' : 'var(--text-faint)',
                  background: 'linear-gradient(150deg,rgba(255,255,255,.14),rgba(255,255,255,.05))',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.22)' }}>
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5 6 9H3v6h3l5 4z" />
                  {snd ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>
                       : <path d="M22 9l-6 6M16 9l6 6" />}
                </svg>
              </button>
            </div>
            <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 14 }}>
              {runsLeft > 0
                ? (lang === 'de' ? `Noch ${runsLeft} freie Runden heute` : `${runsLeft} free rounds left today`)
                : (lang === 'de' ? 'Ab jetzt eine Werbung pro Runde' : 'One ad per round from now on')}
            </p>
          </div>
        </>
      )}

      {/* Ergebnis */}
      {phase === 'over' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 9, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', paddingTop: oben,
          paddingLeft: 32, paddingRight: 32, paddingBottom: 'calc(var(--tg-safe-bottom, 0px) + 16px)',
          textAlign: 'center', overflowY: 'auto',
          background: 'rgba(4,6,12,.90)', backdropFilter: 'blur(10px)' }}>
          <p className="eyebrow" style={{ color: result?.why?.includes('!') ? 'var(--gold)' : 'var(--rose)' }}>
            {result?.why}
          </p>
          <h1 style={{ ...fd, fontSize: 52, fontWeight: 600, marginTop: 10 }}>{nf(score)}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            {lang === 'de' ? 'Punkte' : 'points'}
          </p>

          <div className="surface" style={{ width: '100%', padding: '4px 18px', margin: '24px 0 20px' }}>
            <div className="flex items-center justify-between" style={{ padding: '13px 0' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {lang === 'de' ? 'XP verdient' : 'XP earned'}</span>
              <span style={{ ...fd, fontSize: 17, fontWeight: 500, color: 'var(--emerald)' }}>
                +{nf(result?.xp ?? 0)}</span>
            </div>
            <div className="hairline" />
            <div className="flex items-center justify-between" style={{ padding: '13px 0' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {lang === 'de' ? 'Erreichte Stufe' : 'Level reached'}</span>
              <span style={{ ...fd, fontSize: 17, fontWeight: 500 }}>{result?.level ?? 1} / 3</span>
            </div>
            <div className="hairline" />
            <div className="flex items-center justify-between" style={{ padding: '13px 0' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {lang === 'de' ? 'Beste Serie' : 'Best streak'}</span>
              <span style={{ ...fd, fontSize: 17, fontWeight: 500, color: 'var(--gold)' }}>
                {result?.combo ?? 0}×</span>
            </div>
          </div>

          {board && board.entries.length > 0 && (
            <>
              <p className="eyebrow" style={{ alignSelf: 'flex-start', margin: '0 0 9px 2px' }}>
                {lang === 'de' ? 'Diese Woche' : 'This week'}
                {board.players > 0 && ` · ${board.players} ${lang === 'de' ? 'Spieler' : 'players'}`}
              </p>
              <div className="surface-2" style={{ width: '100%', padding: '3px 14px' }}>
                {board.entries.map((e, i) => (
                  <div key={e.rank}>
                    <div className="flex items-center" style={{ gap: 11, padding: '11px 0',
                      ...(e.isMe ? {
                        background: 'linear-gradient(150deg,rgba(91,141,255,.30),rgba(37,99,255,.14))',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.28), inset 0 0 0 .5px rgba(143,180,255,.35)',
                        borderRadius: 14, paddingLeft: 9, paddingRight: 11, margin: '2px 0' } : {}) }}>
                      <span style={{ ...fd, width: 20, fontSize: 12.5, fontWeight: 500, flexShrink: 0,
                        textAlign: 'center',
                        color: e.isMe ? '#fff' : e.rank === 1 ? 'var(--gold)' : 'var(--text-faint)' }}>{e.rank}</span>
                      <div style={{ position: 'relative', width: 30, height: 30, borderRadius: 10, flexShrink: 0,
                        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        ...fd, fontSize: 11, fontWeight: 500,
                        background: 'linear-gradient(140deg,#9CC0FF,#2563FF)' }}>
                        <span>{(e.name[0] ?? '?').toUpperCase()}</span>
                        {e.avatar && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={e.avatar} alt="" width={30} height={30}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={ev => { (ev.currentTarget as HTMLImageElement).style.display = 'none' }} />
                        )}
                      </div>
                      <span className="truncate" style={{ ...fd, flex: 1, textAlign: 'left', fontSize: 13.5, fontWeight: 500 }}>
                        {e.name}
                        {e.isMe && <span style={{ fontSize: 10, color: 'var(--blue-3)', fontWeight: 400 }}>
                          {lang === 'de' ? ' · du' : ' · you'}</span>}
                      </span>
                      <span className="tabular-nums" style={{ ...fd, fontSize: 14, fontWeight: 500,
                        color: e.rank === 1 ? 'var(--gold)' : 'var(--text-primary)' }}>{nf(e.score)}</span>
                    </div>
                    {i < board.entries.length - 1 && !e.isMe && !board.entries[i + 1]?.isMe && <div className="hairline" />}
                  </div>
                ))}
              </div>
              {board.gapPoints != null && board.gapRank != null && board.gapPoints > 0 && (
                <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 10 }}>
                  {lang === 'de'
                    ? `Du warst ${nf(board.gapPoints)} Punkte von Platz ${board.gapRank} entfernt`
                    : `You were ${nf(board.gapPoints)} points away from rank ${board.gapRank}`}
                </p>
              )}
              {board.myRank === 1 && (
                <p style={{ fontSize: 10.5, color: 'var(--gold)', marginTop: 10 }}>
                  {lang === 'de' ? 'Du führst diese Woche' : 'You lead this week'}
                </p>
              )}
              <div style={{ height: 18 }} />
            </>
          )}

          {result?.capped && (
            <p style={{ fontSize: 11, color: 'var(--gold)', marginTop: -12, marginBottom: 18, lineHeight: 1.5 }}>
              {lang === 'de'
                ? 'XP-Tageslimit erreicht. Weiterspielen geht — für Punkte und Bestwert.'
                : 'Daily XP limit reached. You can keep playing for points and your best score.'}
            </p>
          )}

          <button className="btn-primary press" onClick={() => begin(runsLeft <= 0)}>
            {runsLeft > 0
              ? (lang === 'de' ? 'Nochmal spielen' : 'Play again')
              : (<><Icon name="tv" size={17} />{lang === 'de' ? 'Nochmal per Werbung' : 'Play again via ad'}</>)}
          </button>
          <button className="btn-secondary press" style={{ marginTop: 10, height: 44 }}
            onClick={() => router.push('/arcade')}>
            {lang === 'de' ? 'Zur Übersicht' : 'Back to games'}
          </button>
        </div>
      )}
    </div>
  )
}
