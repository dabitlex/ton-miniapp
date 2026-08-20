// src/app/(game)/arcade/page.tsx — XP Rush
//
// Die Spiellogik entspricht der abgenommenen Vorschau. Neu gegenüber
// dieser: Der Lauf wird serverseitig eröffnet und abgeschlossen, das
// Tageslimit kommt vom Server, und Extra-Runden laufen über Adsgram.
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter }  from 'next/navigation'
import { useArcade }  from '@/features/arcade/hooks'
import { showArcadeAd } from '@/lib/adsgram'
import { useUIStore } from '@/stores/useUIStore'
import { useI18n }    from '@/lib/i18n'
import { Icon, IconTile } from '@/components/ui/Icon'

type Phase = 'intro' | 'countdown' | 'running' | 'over'
type Kind  = 'orb' | 'logo' | 'dud'

interface Item {
  id: number; el: HTMLDivElement; x: number; y: number
  speed: number; kind: Kind; size: number; gone: boolean
}

const DURATION = 60        // Sekunden
const RING_LEN = 119.4

const fd: React.CSSProperties = { fontFamily: 'var(--font-display)' }

export default function ArcadePage() {
  const router = useRouter()
  const { t, lang } = useI18n()
  const { status, startRun, finishRun } = useArcade()
  const toast  = useUIStore(s => s.toast)
  const setNavVisible = useUIStore(s => s.setNavVisible)
  const haptic = useUIStore(s => s.haptic)

  const [phase, setPhase]   = useState<Phase>('intro')
  const [score, setScore]   = useState(0)
  const [left, setLeft]     = useState(DURATION)
  const [cd, setCd]         = useState(3)
  const [result, setResult] = useState<{ xp: number; why: string; combo: number; capped: boolean } | null>(null)
  const [combo, setCombo]   = useState(0)

  const fieldRef  = useRef<HTMLDivElement>(null)
  const itemsRef  = useRef<Item[]>([])
  const rafRef    = useRef<number | null>(null)
  const runIdRef  = useRef<string | null>(null)
  const scoreRef  = useRef(0)
  const comboRef  = useRef(0)
  const bestComboRef = useRef(0)
  const comboTORef= useRef<ReturnType<typeof setTimeout> | null>(null)
  const startRef  = useRef(0)
  const spawnRef  = useRef(0)
  const lastRef   = useRef(0)
  const endedRef  = useRef(false)

  const W = () => fieldRef.current?.clientWidth  ?? 390
  const H = () => fieldRef.current?.clientHeight ?? 700

  /* ── Aufräumen ─────────────────────────────────────────────── */
  const clearField = useCallback(() => {
    itemsRef.current.forEach(i => i.el.remove())
    itemsRef.current = []
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (comboTORef.current) clearTimeout(comboTORef.current)
  }, [])

  useEffect(() => clearField, [clearField])

  // Vollbild auf dem GANZEN Arcade-Screen — auch im Ergebnis, denn dort
  // gibt es einen eigenen "Zurueck zur App"-Knopf. Sonst springt das
  // Layout nach jeder Runde und die Navigation lenkt vom Ergebnis ab.
  useEffect(() => {
    setNavVisible(false)
    // Beim Verlassen immer wieder einblenden — auch wenn der Screen
    // mitten in einer Runde verlassen wird.
    return () => setNavVisible(true)
  }, [setNavVisible])

  /* ── Lauf beenden ──────────────────────────────────────────── */
  const endRun = useCallback(async (why: string) => {
    if (endedRef.current) return
    endedRef.current = true
    clearField()
    setPhase('over')

    const finalScore = scoreRef.current
    const bestCombo  = bestComboRef.current

    if (!runIdRef.current) {
      setResult({ xp: 0, why, combo: bestCombo, capped: false })
      return
    }

    const r = await finishRun({ runId: runIdRef.current, score: finalScore, bestCombo })
    runIdRef.current = null
    setResult({ xp: r.xp, why, combo: bestCombo, capped: !!r.capped })
  }, [clearField, finishRun])

  /* ── Treffer ───────────────────────────────────────────────── */
  const hit = useCallback((item: Item) => {
    if (item.gone || endedRef.current) return
    item.gone = true

    if (item.kind === 'dud') {
      item.el.remove()
      haptic?.('heavy')
      endRun(lang === 'de' ? 'Niete getroffen' : 'You hit a dud')
      return
    }

    comboRef.current += 1
    bestComboRef.current = Math.max(bestComboRef.current, comboRef.current)
    const mult  = comboRef.current >= 15 ? 3 : comboRef.current >= 8 ? 2 : 1
    const pts   = (item.kind === 'logo' ? 100 : 10) * mult

    scoreRef.current += pts
    setScore(scoreRef.current)
    setCombo(mult > 1 ? comboRef.current : 0)

    // Trefferanzeige
    const pop = document.createElement('div')
    pop.textContent = `+${pts}`
    pop.style.cssText = `position:absolute;left:${item.x + item.size / 2 - 18}px;top:${item.y}px;` +
      `font-family:var(--font-display);font-weight:600;font-size:15px;pointer-events:none;z-index:6;` +
      `color:${item.kind === 'logo' ? 'var(--gold)' : 'var(--blue-3)'};` +
      `animation:arcPop .7s cubic-bezier(.2,.8,.2,1) forwards`
    fieldRef.current?.appendChild(pop)
    setTimeout(() => pop.remove(), 700)

    if (comboTORef.current) clearTimeout(comboTORef.current)
    comboTORef.current = setTimeout(() => { comboRef.current = 0; setCombo(0) }, 1400)

    haptic?.('light')
    item.el.remove()
  }, [endRun, haptic, lang])

  /* ── Element erzeugen ──────────────────────────────────────── */
  const spawn = useCallback((sec: number) => {
    const field = fieldRef.current
    if (!field) return

    const dudChance = Math.min(0.13 + sec * 0.0035, 0.28)
    const r = Math.random()
    const kind: Kind = r < 0.05 ? 'logo' : (r < 0.05 + dudChance ? 'dud' : 'orb')
    const size = kind === 'logo' ? 54 : kind === 'dud' ? 46 : 44

    const el = document.createElement('div')
    el.className = `arc-item arc-${kind}`
    el.style.width  = `${size}px`
    el.style.height = `${kind === 'logo' ? Math.round(size * 0.8) : size}px`

    if (kind === 'orb')  el.textContent = '+10'
    if (kind === 'logo') el.innerHTML = '<img src="/icon-mark-v2.png" alt="" style="width:100%;height:auto;display:block">'
    if (kind === 'dud')  el.innerHTML =
      '<svg viewBox="0 0 24 24" style="width:52%;height:52%;stroke:#fff;fill:none;stroke-width:2.4;stroke-linecap:round"><path d="M6 6l12 12M18 6 6 18"/></svg>'

    const x = 14 + Math.random() * (W() - size - 28)
    const y = -size - Math.random() * 40
    const speed = (135 + sec * 3.2 + Math.random() * 45) * (kind === 'logo' ? 1.35 : 1)

    const item: Item = { id: Math.random(), el, x, y, speed, kind, size, gone: false }
    el.style.transform = `translate(${x}px, ${y}px)`
    el.addEventListener('pointerdown', e => { e.preventDefault(); hit(item) }, { passive: false })
    field.appendChild(el)
    itemsRef.current.push(item)
  }, [hit])

  /* ── Schleife ──────────────────────────────────────────────── */
  const frame = useCallback((ts: number) => {
    if (endedRef.current) return
    const dt  = Math.min((ts - lastRef.current) / 1000, 0.05)
    lastRef.current = ts
    const sec  = (ts - startRef.current) / 1000
    const rest = Math.max(0, DURATION - sec)
    setLeft(Math.ceil(rest))

    spawnRef.current += dt * (1.5 + sec * 0.045)
    while (spawnRef.current >= 1) { spawn(sec); spawnRef.current -= 1 }

    const items = itemsRef.current
    for (let i = items.length - 1; i >= 0; i--) {
      const o = items[i]!
      if (o.gone) { items.splice(i, 1); continue }
      o.y += o.speed * dt
      o.el.style.transform = `translate(${o.x}px, ${o.y}px)`
      if (o.y > H() + 60) {
        o.el.remove(); items.splice(i, 1)
        // Verpasste Kugel bricht die Serie, durchgefallene Nieten nicht
        if (o.kind !== 'dud') { comboRef.current = 0; setCombo(0) }
      }
    }

    if (rest <= 0) { endRun(lang === 'de' ? 'Zeit abgelaufen' : 'Time is up'); return }
    rafRef.current = requestAnimationFrame(frame)
  }, [spawn, endRun, lang])

  /* ── Start ─────────────────────────────────────────────────── */
  const begin = useCallback(async (withAd: boolean) => {
    try {
      if (withAd) {
        // Eigener Werbeblock: der normale Block wuerde ueber seinen
        // Server-Callback einen ad_views-Eintrag anlegen und damit auf
        // die Quest "5 Ads ansehen" zaehlen. Das Limit der Arcade wird
        // serverseitig in start_arcade_run geprueft.
        const res = await showArcadeAd()
        if (res !== 'watched') {
          toast?.('warning', lang === 'de'
            ? 'Werbung nicht abgespielt — Runde nicht gestartet.'
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

    clearField()
    scoreRef.current = 0; comboRef.current = 0; bestComboRef.current = 0
    spawnRef.current = 0; endedRef.current = false
    setScore(0); setCombo(0); setResult(null); setLeft(DURATION)
    setPhase('countdown'); setCd(3)
  }, [startRun, toast, clearField, lang])

  // Countdown → Spielstart
  useEffect(() => {
    if (phase !== 'countdown') return
    if (cd < 0) {
      setPhase('running')
      startRef.current = performance.now()
      lastRef.current  = startRef.current
      rafRef.current   = requestAnimationFrame(frame)
      return
    }
    const t = setTimeout(() => setCd(c => c - 1), 850)
    return () => clearTimeout(t)
  }, [phase, cd, frame])

  const nf = (n: number) => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US').format(n)

  /* ── Nicht aktiv ───────────────────────────────────────────── */
  if (status && !status.enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full relative z-10" style={{ padding: 32 }}>
        <IconTile name="target" size={62} />
        <p style={{ ...fd, fontSize: 15, fontWeight: 500, marginTop: 16 }}>XP Rush</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
          {lang === 'de' ? 'Bald verfügbar.' : 'Coming soon.'}
        </p>
        <button className="btn-secondary press" style={{ marginTop: 20, width: 'auto', padding: '0 20px', height: 42 }}
          onClick={() => router.push('/home')}>{t('common.back')}</button>
      </div>
    )
  }

  const runsLeft = status?.runsLeft ?? 0
  const board    = status?.board ?? null

  return (
    <div className="relative z-10" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <style>{`
        @keyframes arcPop{0%{opacity:1;transform:translateY(0) scale(1)}
          100%{opacity:0;transform:translateY(-38px) scale(1.25)}}
        @keyframes arcCd{0%{opacity:0;transform:scale(.6)}30%{opacity:1;transform:scale(1)}
          100%{opacity:0;transform:scale(1.4)}}
        .arc-item{position:absolute;display:flex;align-items:center;justify-content:center;
          will-change:transform;cursor:pointer}
        .arc-orb{border-radius:50%;background:linear-gradient(140deg,#9CC0FF,#1D4ED8);
          box-shadow:inset 0 2px 0 rgba(255,255,255,.45),0 6px 18px rgba(37,99,255,.5);
          font-family:var(--font-display);font-weight:600;font-size:13px;color:#fff}
        .arc-logo img{filter:drop-shadow(0 6px 20px rgba(37,99,255,.65))}
        .arc-dud{border-radius:14px;background:linear-gradient(140deg,#FB7185,#9F1239);
          box-shadow:inset 0 2px 0 rgba(255,255,255,.30),0 6px 18px rgba(244,63,94,.45)}
      `}</style>

      {/* Spielfeld */}
      <div ref={fieldRef} style={{ position: 'absolute', inset: 0, zIndex: 3 }} />

      {/* HUD */}
      {phase === 'running' && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
          // Derselbe Abstand, den sonst die Kopfzeile reserviert — sonst
          // liegen Punktestand und Uhr hinter Telegrams eigenen Knoepfen.
          paddingTop: 'calc(var(--tg-safe-area-top, 0px) + var(--tg-content-top, 48px) + 8px)',
          paddingLeft: 20, paddingRight: 20, paddingBottom: 18,
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', pointerEvents: 'none' }}>
          <div>
            <p className="eyebrow">{lang === 'de' ? 'Punkte' : 'Score'}</p>
            <p style={{ ...fd, fontSize: 30, fontWeight: 500, marginTop: 2 }}>{nf(score)}</p>
            {combo > 1 && (
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--gold)', marginTop: 4 }}>
                {combo}{lang === 'de' ? 'er Serie' : ' streak'} · ×{combo >= 15 ? 3 : 2}
              </p>
            )}
          </div>
          <div style={{ position: 'relative', width: 46, height: 46 }}>
            <svg width="46" height="46" viewBox="0 0 46 46" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="23" cy="23" r="19" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="4" />
              <circle cx="23" cy="23" r="19" fill="none" stroke="#5B8DFF" strokeWidth="4"
                strokeLinecap="round" strokeDasharray={RING_LEN}
                strokeDashoffset={RING_LEN * (1 - left / DURATION)} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center', ...fd, fontSize: 14, fontWeight: 500 }}>
              {left}
            </div>
          </div>
        </div>
      )}

      {/* Countdown */}
      {phase === 'countdown' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 8, display: 'flex',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span key={cd} style={{ ...fd, fontSize: 82, fontWeight: 600, animation: 'arcCd .85s ease-out' }}>
            {cd === 0 ? (lang === 'de' ? 'Los!' : 'Go!') : cd}
          </span>
        </div>
      )}

      {/* Zurueck-Knopf: nur im Intro. Waehrend der Runde waere er eine
          Fehlerquelle beim Tippen, im Ergebnis gibt es "Zurueck zur App".
          Sitzt unterhalb von Telegrams "Schliessen", damit sich beide
          nicht ueberlagern. */}
      {phase === 'intro' && (
        <button
          onClick={() => router.push('/home')}
          aria-label={t('common.back')}
          className="press"
          style={{
            position: 'absolute', zIndex: 10, left: 20,
            top: 'calc(var(--tg-safe-area-top, 0px) + var(--tg-content-top, 48px) + 6px)',
            width: 38, height: 38, borderRadius: 13, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            background: 'linear-gradient(150deg,rgba(255,255,255,.16),rgba(255,255,255,.05))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25), inset 0 0 0 .5px rgba(255,255,255,.08)',
          }}
        >
          <Icon name="chevronLeft" size={17} strokeWidth={1.8} />
        </button>
      )}

      {/* Intro */}
      {phase === 'intro' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 9, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          paddingTop: 'calc(var(--tg-safe-area-top, 0px) + var(--tg-content-top, 48px))',
          paddingLeft: 34, paddingRight: 34,
          paddingBottom: 'calc(var(--tg-safe-bottom, 0px) + 16px)',
          overflowY: 'auto', textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-mark-v2.png" alt="" width={110} height={88}
            style={{ width: 110, height: 'auto', marginBottom: 22,
              filter: 'drop-shadow(0 14px 40px rgba(37,99,255,.45))' }} />
          <h1 style={{ ...fd, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em' }}>XP Rush</h1>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', marginTop: 12 }}>
            {lang === 'de'
              ? 'Tippe die fallenden XP-Kugeln, bevor sie unten ankommen.'
              : 'Tap the falling XP orbs before they reach the bottom.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, width: '100%', margin: '26px 0 30px' }}>
            {([
              ['orb',  lang === 'de' ? 'XP-Kugel' : 'XP orb',
                       lang === 'de' ? 'Serien geben Bonus.' : 'Streaks give a bonus.'],
              ['logo', 'Logo',
                       lang === 'de' ? 'Selten — 100 Punkte.' : 'Rare — 100 points.'],
              ['dud',  lang === 'de' ? 'Niete' : 'Dud',
                       lang === 'de' ? 'Eine Berührung beendet das Spiel.' : 'One tap ends the game.'],
            ] as const).map(([kind, title, sub]) => (
              <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left' }}>
                <div className={`arc-${kind}`} style={{ position: 'relative', width: 42, height: 42,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  ...(kind === 'logo' ? { borderRadius: 13,
                    background: 'linear-gradient(150deg,rgba(255,255,255,.18),rgba(255,255,255,.05))',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3)' } : {}) }}>
                  {kind === 'orb'  && '+10'}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {kind === 'logo' && <img src="/icon-mark-v2.png" alt="" style={{ width: 26, height: 'auto' }} />}
                  {kind === 'dud'  && (
                    <svg viewBox="0 0 24 24" style={{ width: '52%', height: '52%', stroke: '#fff',
                      fill: 'none', strokeWidth: 2.4, strokeLinecap: 'round' }}><path d="M6 6l12 12M18 6 6 18" /></svg>
                  )}
                </div>
                <div>
                  <p style={{ ...fd, fontSize: 13.5, fontWeight: 500 }}>{title}</p>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {runsLeft > 0 ? (
            <button className="btn-primary press" onClick={() => begin(false)}>
              {lang === 'de' ? 'Spiel starten' : 'Start game'}
            </button>
          ) : (
            <button className="btn-primary press" onClick={() => begin(true)}>
              <Icon name="tv" size={17} />
              {lang === 'de' ? 'Runde per Werbung' : 'Round via ad'}
            </button>
          )}

          <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 14 }}>
            {runsLeft > 0
              ? (lang === 'de' ? `Noch ${runsLeft} freie Runden heute` : `${runsLeft} free rounds left today`)
              : (lang === 'de' ? 'Ab jetzt eine Werbung pro Runde' : 'One ad per round from now on')}
          </p>
          {status?.xpCapped && (
            <p style={{ fontSize: 10.5, color: 'var(--gold)', marginTop: 6, textAlign: 'center' }}>
              {lang === 'de'
                ? 'XP-Tageslimit erreicht — Punkte und Bestwert zählen weiter'
                : 'Daily XP limit reached — points and best score still count'}
            </p>
          )}
          {(status?.bestScore ?? 0) > 0 && (
            <p style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 6 }}>
              {lang === 'de' ? 'Bestwert' : 'Best'} {nf(status!.bestScore)}
            </p>
          )}
        </div>
      )}

      {/* Ergebnis */}
      {phase === 'over' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 9, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          paddingTop: 'calc(var(--tg-safe-area-top, 0px) + var(--tg-content-top, 48px))',
          paddingLeft: 34, paddingRight: 34,
          paddingBottom: 'calc(var(--tg-safe-bottom, 0px) + 16px)',
          overflowY: 'auto', textAlign: 'center',
          background: 'rgba(5,8,16,.86)', backdropFilter: 'blur(8px)' }}>
          <p className="eyebrow" style={{ color: result?.why?.includes('Zeit') || result?.why?.includes('Time')
            ? 'var(--blue-2)' : 'var(--rose)' }}>{result?.why}</p>
          <h1 style={{ ...fd, fontSize: 52, fontWeight: 600, marginTop: 10 }}>{nf(score)}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            {lang === 'de' ? 'Punkte' : 'points'}
          </p>

          <div className="surface" style={{ width: '100%', padding: '4px 18px', margin: '26px 0 22px' }}>
            <div className="flex items-center justify-between" style={{ padding: '13px 0' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {lang === 'de' ? 'XP verdient' : 'XP earned'}</span>
              <span style={{ ...fd, fontSize: 17, fontWeight: 500, color: 'var(--emerald)' }}>
                +{nf(result?.xp ?? 0)}</span>
            </div>
            <div className="hairline" />
            <div className="flex items-center justify-between" style={{ padding: '13px 0' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {lang === 'de' ? 'Beste Serie' : 'Best streak'}</span>
              <span style={{ ...fd, fontSize: 17, fontWeight: 500 }}>{result?.combo ?? 0}×</span>
            </div>
          </div>

          {/* Wochen-Bestenliste — nur Vergleich, keine Belohnung */}
          {board && board.entries.length > 0 && (
            <>
              <p className="eyebrow" style={{ alignSelf: 'flex-start', margin: '0 0 9px 2px' }}>
                {lang === 'de' ? 'Diese Woche' : 'This week'}
                {board.players > 0 && ` · ${board.players} ${lang === 'de' ? 'Spieler' : 'players'}`}
              </p>
              <div className="surface-2" style={{ width: '100%', padding: '3px 14px' }}>
                {board.entries.map((e, i) => (
                  <div key={e.rank}>
                    <div className="flex items-center"
                      style={{
                        gap: 11, padding: '11px 0',
                        ...(e.isMe ? {
                          background: 'linear-gradient(150deg,rgba(91,141,255,.30),rgba(37,99,255,.14))',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.28), inset 0 0 0 .5px rgba(143,180,255,.35)',
                          borderRadius: 14, paddingLeft: 9, paddingRight: 11, margin: '2px 0',
                        } : {}),
                      }}>
                      <span style={{ ...fd, width: 20, fontSize: 12.5, fontWeight: 500, flexShrink: 0,
                        textAlign: 'center', color: e.isMe ? '#fff' : e.rank === 1 ? 'var(--gold)' : 'var(--text-faint)' }}>
                        {e.rank}
                      </span>
                      {/* Buchstabe liegt IMMER darunter; das Bild deckt ihn ab.
                          Telegram-Bild-URLs laufen ab — faellt eines weg, wird
                          es ausgeblendet und der Buchstabe erscheint wieder. */}
                      <div style={{ position: 'relative', width: 30, height: 30, borderRadius: 10,
                        flexShrink: 0, overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        ...fd, fontSize: 11, fontWeight: 500,
                        background: 'linear-gradient(140deg,#9CC0FF,#2563FF)' }}>
                        <span>{(e.name[0] ?? '?').toUpperCase()}</span>
                        {e.avatar && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={e.avatar} alt="" width={30} height={30}
                            style={{ position: 'absolute', inset: 0,
                              width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={ev => { (ev.currentTarget as HTMLImageElement).style.display = 'none' }} />
                        )}
                      </div>
                      <span className="truncate" style={{ ...fd, flex: 1, textAlign: 'left',
                        fontSize: 13.5, fontWeight: 500 }}>
                        {e.name}
                        {e.isMe && (
                          <span style={{ fontSize: 10, color: 'var(--blue-3)', fontWeight: 400 }}>
                            {lang === 'de' ? ' · du' : ' · you'}
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums" style={{ ...fd, fontSize: 14, fontWeight: 500,
                        color: e.rank === 1 ? 'var(--gold)' : 'var(--text-primary)' }}>
                        {nf(e.score)}
                      </span>
                    </div>
                    {i < board.entries.length - 1 && !e.isMe && !board.entries[i + 1]?.isMe && (
                      <div className="hairline" />
                    )}
                  </div>
                ))}
              </div>

              {/* Abstand nach oben — beschreibt, was war, statt eine Aufgabe zu stellen */}
              {board.gapPoints != null && board.gapRank != null && board.gapPoints > 0 && (
                <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
                  {lang === 'de'
                    ? `Du warst ${nf(board.gapPoints)} Punkte von Platz ${board.gapRank} entfernt`
                    : `You were ${nf(board.gapPoints)} points away from rank ${board.gapRank}`}
                </p>
              )}
              {board.myRank === 1 && (
                <p style={{ fontSize: 10.5, color: 'var(--gold)', marginTop: 10, textAlign: 'center' }}>
                  {lang === 'de' ? 'Du führst diese Woche' : 'You lead this week'}
                </p>
              )}
              <div style={{ height: 18 }} />
            </>
          )}

          {result?.capped && (
            <p style={{ fontSize: 11, color: 'var(--gold)', marginTop: -12, marginBottom: 18,
              textAlign: 'center', lineHeight: 1.5 }}>
              {lang === 'de'
                ? 'XP-Tageslimit erreicht. Weiterspielen geht — für Punkte und Bestwert.'
                : 'Daily XP limit reached. You can keep playing for points and your best score.'}
            </p>
          )}

          {runsLeft > 0 ? (
            <button className="btn-primary press" onClick={() => begin(false)}>
              {lang === 'de' ? 'Nochmal spielen' : 'Play again'}
            </button>
          ) : (
            <button className="btn-primary press" onClick={() => begin(true)}>
              <Icon name="tv" size={17} />
              {lang === 'de' ? 'Nochmal per Werbung' : 'Play again via ad'}
            </button>
          )}

          <button className="btn-secondary press" style={{ marginTop: 10, height: 44 }}
            onClick={() => router.push('/home')}>
            {lang === 'de' ? 'Zurück zur App' : 'Back to the app'}
          </button>
        </div>
      )}
    </div>
  )
}
