// src/components/game/QuestRewardPopup.tsx — VEXALGO 2.0
// Die gesamte Ad-/Verdopplungs-Logik ist unveraendert; nur die Darstellung ist neu.
// Reward-Popup nach Abschluss einer Daily/Weekly-Quest.
// Zeigt die verdiente XP (bereits gutgeschrieben) + Option "Werbung für ×2".
// Global gemountet in src/app/(game)/layout.tsx (wie MysteryBoxModal).
//
// Ablauf:
//   • "Claim"        -> schließt nur (Basis-XP ist schon auf dem Konto)
//   • "Watch ad ×2"  -> showDoubleAd() (Adsgram-Vollbild) -> nach 'watched'
//        /api/v1/quests/double (mit Retry, da der S2S-Callback minimal nachlaufen
//        kann) -> Bonus wird vergeben, Zahl zählt auf den neuen Gesamtwert hoch.

'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuestRewardStore } from '@/stores/useQuestRewardStore'
import { useMysteryBoxStore }  from '@/stores/useMysteryBoxStore'
import { authedFetch }         from '@/lib/authedFetch'
import { useUserStore }        from '@/stores/useUserStore'
import { useUIStore }          from '@/stores/useUIStore'
import { showDoubleAd, getDoubleBlockId } from '@/lib/adsgram'
import { Icon, IconTile } from '@/components/ui/Icon'

type Phase = 'offer' | 'loadingAd' | 'crediting' | 'doubled'
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

export function QuestRewardPopup() {
  const isOpen = useQuestRewardStore(s => s.isOpen)
  const data   = useQuestRewardStore(s => s.data)
  const close  = useQuestRewardStore(s => s.close)
  const { toast, haptic } = useUIStore()

  const [phase, setPhase]     = useState<Phase>('offer')
  const [display, setDisplay] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const rafRef  = useRef<number | null>(null)

  useEffect(() => {
    if (isOpen && data) { setPhase('offer'); setDisplay(data.baseXp) }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isOpen, data])

  if (!isOpen || !data || typeof document === 'undefined') return null

  const adAvailable = !!getDoubleBlockId()
  const doubled     = phase === 'doubled'

  function handleClose() {
    const after = data?.mysteryBoxAfter
    close()
    if (after) setTimeout(() => useMysteryBoxStore.getState().trigger(), 350)
  }

  function countTo(target: number) {
    const start = display, t0 = performance.now(), dur = 700
    const step = (now: number) => {
      const p = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(start + (target - start) * e))
      if (p < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
  }

  function burst() {
    const card = cardRef.current; if (!card) return
    const cols = ['#6EE7B7', '#34D399', '#FCD34D', '#C4B5FD']
    for (let i = 0; i < 20; i++) {
      const s = document.createElement('div')
      const c = cols[i % 4]
      s.style.cssText = `position:absolute;left:50%;top:34%;width:6px;height:6px;border-radius:50%;pointer-events:none;z-index:3;background:${c};box-shadow:0 0 8px ${c}`
      card.appendChild(s)
      const ang = Math.random() * Math.PI * 2, dist = 55 + Math.random() * 90
      s.animate(
        [{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
         { transform: `translate(${Math.cos(ang) * dist - 50}%,${Math.sin(ang) * dist - 50}%) scale(0)`, opacity: 0 }],
        { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.2,1)' }
      ).onfinish = () => s.remove()
    }
  }

  function applyDoubled(bonus: number) {
    setPhase('doubled'); haptic('heavy')
    const profile = useUserStore.getState().profile
    if (profile) {
      useUserStore.getState().patchProfile({
        xpTotal:       profile.xpTotal + bonus,
        seasonXp:      profile.seasonXp + bonus,
        xpEarnedToday: profile.xpEarnedToday + bonus,
      })
    }
    useUserStore.getState().refreshProfile()
    burst()
    countTo((data?.baseXp ?? 0) + bonus)
  }

  async function creditDouble() {
    // Der Bonus wird jetzt direkt auf das "watched"-Signal gebucht; ein Retry
    // ist nur noch für kurzzeitige Netzwerkfehler nötig (nicht mehr für Gutschriften).
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const r = await authedFetch('/api/v1/quests/double', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questId: data!.questId, questType: data!.questType }),
        })
        const json = await r.json()
        if (json.success && json.data.doubled) { applyDoubled(json.data.bonus); return }

        const reason = json.data?.reason
        if (reason === 'already_doubled') { toast('warning', 'This quest was already doubled.'); handleClose(); return }
        // Logischer Fehlschlag (z.B. invalid_quest) -> nicht erneut versuchen, Basis bleibt sicher
        toast('warning', 'Could not double right now — your base reward is safe.')
        setPhase('offer'); return
      } catch {
        if (attempt < 2) { await sleep(1200); continue }
        toast('error', 'Network error — your base reward is safe.')
        setPhase('offer'); return
      }
    }
  }

  async function watchAd() {
    if (!adAvailable) { toast('error', 'Ad not available right now.'); return }
    setPhase('loadingAd'); haptic('light')
    const res = await showDoubleAd()
    if (res !== 'watched') {
      setPhase('offer')
      toast(res === 'no_ad' ? 'warning' : 'error',
            res === 'no_ad' ? 'No ad available right now.' : 'Ad could not be played.')
      return
    }
    haptic('medium'); setPhase('crediting')
    await creditDouble()
  }

  const fd: React.CSSProperties = { fontFamily: 'var(--font-display)' }
  const busy = phase === 'loadingAd' || phase === 'crediting'

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center"
         style={{ padding: 24 }} role="dialog" aria-modal="true">
      <div onClick={handleClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(4,7,16,.78)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />

      <div ref={cardRef} className="surface animate-pop"
        style={{ position: 'relative', width: '100%', maxWidth: 320,
          padding: '26px 22px 22px', textAlign: 'center', borderRadius: 28, overflow: 'hidden' }}>

        {/* Lichtschein oben — wechselt bei Verdopplung auf Gruen */}
        <div aria-hidden style={{ position: 'absolute', left: '50%', top: -40,
          transform: 'translateX(-50%)', width: 230, height: 170, pointerEvents: 'none',
          transition: 'background .5s',
          background: doubled
            ? 'radial-gradient(circle, rgba(34,197,94,.34), transparent 66%)'
            : 'radial-gradient(circle, rgba(37,99,255,.38), transparent 66%)' }} />

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <IconTile name="check" size={62} active />
        </div>

        <p className="eyebrow" style={{ position: 'relative',
          color: doubled ? 'var(--emerald)' : 'var(--blue-2)' }}>
          {doubled ? 'Verdoppelt!' : 'Quest abgeschlossen'}
        </p>

        <h2 style={{ ...fd, fontSize: 17, fontWeight: 600, marginTop: 7, position: 'relative' }}>
          {data.title}
        </h2>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline',
          justifyContent: 'center', gap: 8, margin: '18px 0 4px' }}>
          {doubled && (
            <span style={{ position: 'absolute', top: -10, right: 14, ...fd, fontSize: 13,
              fontWeight: 600, color: '#04231a', padding: '3px 10px', borderRadius: 999,
              background: 'linear-gradient(180deg,#8FF0C0,#22C55E)',
              boxShadow: '0 6px 16px rgba(34,197,94,.45)' }}>×2</span>
          )}
          <span style={{ ...fd, fontSize: 44, fontWeight: 500, lineHeight: 1,
            color: doubled ? 'var(--emerald)' : '#fff' }}>
            {display.toLocaleString('de-DE')}
          </span>
          <span style={{ ...fd, fontSize: 16, color: 'var(--text-secondary)' }}>XP</span>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', position: 'relative' }}>
          {doubled ? 'Bonus gutgeschrieben · zählt auf Season-XP' : 'bereits gutgeschrieben'}
        </p>

        {busy ? (
          <div style={{ marginTop: 22, padding: '14px 0', position: 'relative' }}>
            <div style={{ width: 22, height: 22, margin: '0 auto 10px', borderRadius: '50%',
              border: '2px solid rgba(255,255,255,.15)', borderTopColor: 'var(--blue-2)',
              animation: 'ring-spin .8s linear infinite' }} />
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {phase === 'loadingAd' ? 'Werbung wird geladen…' : 'Bonus wird gutgeschrieben…'}
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column',
            gap: 10, position: 'relative' }}>
            {!doubled && adAvailable && (
              <button className="btn-primary press" onClick={watchAd}>
                <Icon name="tv" size={17} />
                Werbung ansehen für ×2
              </button>
            )}
            <button
              className={doubled ? 'btn-primary press' : 'btn-secondary press'}
              onClick={handleClose}
              style={doubled ? {
                background: 'linear-gradient(135deg,#8FF0C0,#22C55E 55%,#15803D)',
                color: '#04231a',
                boxShadow: '0 10px 26px rgba(34,197,94,.4), inset 0 1px 0 rgba(255,255,255,.45)',
              } : { height: 44 }}
            >
              Belohnung annehmen
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
