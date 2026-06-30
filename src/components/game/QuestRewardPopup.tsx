// src/components/game/QuestRewardPopup.tsx
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
import { useAuthStore }        from '@/stores/useAuthStore'
import { useUserStore }        from '@/stores/useUserStore'
import { useUIStore }          from '@/stores/useUIStore'
import { showDoubleAd, getDoubleBlockId } from '@/lib/adsgram'
import { Loader2, Play } from 'lucide-react'

type Phase = 'offer' | 'loadingAd' | 'crediting' | 'doubled'
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

export function QuestRewardPopup() {
  const isOpen = useQuestRewardStore(s => s.isOpen)
  const data   = useQuestRewardStore(s => s.data)
  const close  = useQuestRewardStore(s => s.close)
  const token  = useAuthStore(s => s.accessToken)
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
        const r = await fetch('/api/v1/quests/double', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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

  const accent = doubled ? '#34D399' : '#FBBF24'

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6" role="dialog" aria-modal="true">
      <style>{`
        @keyframes qrFloat{0%,100%{transform:translateY(-4px)}50%{transform:translateY(4px)}}
        @keyframes qrIn{0%{opacity:0;transform:scale(.9) translateY(10px)}100%{opacity:1;transform:none}}
        @keyframes qrStamp{0%{opacity:0;transform:scale(0) rotate(-12deg)}100%{opacity:1;transform:scale(1) rotate(-12deg)}}
      `}</style>

      <div className="absolute inset-0" onClick={phase === 'offer' || doubled ? handleClose : undefined}
        style={{ background: 'rgba(3,2,8,.72)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }} />

      <div ref={cardRef} className="relative w-full max-w-[330px] rounded-[28px] p-6 pt-7 text-center overflow-hidden"
        style={{ background: 'linear-gradient(180deg,rgba(30,23,52,.98),rgba(13,10,25,.98))',
          boxShadow: '0 30px 70px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.1)',
          animation: 'qrIn .35s cubic-bezier(.2,1.3,.4,1)' }}>

        {/* glow */}
        <div className="absolute left-1/2 pointer-events-none" style={{ top: -30, transform: 'translateX(-50%)', width: 220, height: 160,
          background: `radial-gradient(circle, ${doubled ? 'rgba(52,211,153,.4)' : 'rgba(251,191,36,.3)'}, transparent 65%)`, transition: 'background .5s' }} />

        {/* crystal */}
        <div className="relative mx-auto mb-3" style={{ width: 78, height: 88, animation: 'qrFloat 5s ease-in-out infinite' }}>
          <svg width="78" height="88" viewBox="0 0 78 88">
            <defs>
              <linearGradient id="qrT" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#E9D5FF"/><stop offset="1" stopColor="#A5F3FC"/></linearGradient>
              <linearGradient id="qrL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#C4B5FD"/><stop offset="1" stopColor="#7C3AED"/></linearGradient>
              <linearGradient id="qrR" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#67E8F9"/><stop offset="1" stopColor="#4F46E5"/></linearGradient>
              <linearGradient id="qrB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7C3AED"/><stop offset="1" stopColor="#3B2A8C"/></linearGradient>
            </defs>
            <polygon points="39,3 61,20 39,29 17,20" fill="url(#qrT)"/>
            <polygon points="17,20 39,29 31,62 12,40" fill="url(#qrL)"/>
            <polygon points="61,20 66,40 47,62 39,29" fill="url(#qrR)"/>
            <polygon points="31,62 47,62 39,86" fill="url(#qrB)"/>
            <polygon points="39,3 39,29 17,20" fill="#fff" opacity=".22"/>
            <polygon points="39,3 52,12 45,18 39,9" fill="#fff" opacity=".7"/>
          </svg>
        </div>

        <div className="eyebrow" style={{ color: accent }}>{doubled ? 'Doubled!' : 'Quest Complete'}</div>
        <h3 className="display text-[18px] mt-1.5" style={{ color: 'var(--text-primary)' }}>{data.title ?? 'Reward earned'}</h3>

        {/* reward number */}
        <div className="relative flex items-center justify-center gap-2.5 mt-4 mb-1">
          {doubled && (
            <span className="absolute" style={{ top: -8, right: 28, animation: 'qrStamp .5s cubic-bezier(.2,1.5,.4,1) forwards',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: '#06251f',
              background: 'linear-gradient(180deg,#6EE7B7,#10B981)', padding: '4px 10px', borderRadius: 999, boxShadow: '0 6px 16px rgba(16,185,129,.5)' }}>×2</span>
          )}
          <span className="display tabular-nums" style={{ fontSize: 44, lineHeight: 1,
            color: doubled ? '#6EE7B7' : '#FCD34D',
            textShadow: `0 0 22px ${doubled ? 'rgba(52,211,153,.55)' : 'rgba(251,191,36,.5)'}` }}>
            {display.toLocaleString('en-US')}
          </span>
          <span className="display" style={{ fontSize: 16, color: 'var(--violet-bright)' }}>XP</span>
        </div>

        {/* actions */}
        <div className="mt-5 flex flex-col gap-2.5">
          {phase === 'crediting' || phase === 'loadingAd' ? (
            <div className="flex items-center justify-center gap-2 py-4" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>
              <Loader2 size={16} className="animate-spin" />
              {phase === 'loadingAd' ? 'Loading ad…' : 'Crediting your reward…'}
            </div>
          ) : doubled ? (
            <button onClick={handleClose}
              className="press w-full rounded-2xl py-4"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: '#06251f',
                background: 'linear-gradient(180deg,#6EE7B7,#10B981)',
                boxShadow: '0 6px 0 #047857,0 14px 26px rgba(16,185,129,.45),inset 0 2px 0 rgba(255,255,255,.5)' }}>
              Claim {display.toLocaleString('en-US')} XP 🎉
            </button>
          ) : (
            <>
              {adAvailable && (
                <button onClick={watchAd}
                  className="press w-full rounded-2xl py-4 flex items-center justify-center gap-2"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14.5, color: '#2a1c06',
                    background: 'linear-gradient(180deg,#FCD34D,#F59E0B)',
                    boxShadow: '0 6px 0 #b45309,0 14px 26px rgba(245,158,11,.45),inset 0 2px 0 rgba(255,255,255,.5)' }}>
                  <Play size={17} fill="currentColor" /> Watch ad to double
                  <span style={{ fontSize: 11, background: 'rgba(0,0,0,.18)', padding: '2px 7px', borderRadius: 999 }}>×2</span>
                </button>
              )}
              <button onClick={handleClose}
                className="press w-full rounded-[15px] py-3"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13.5,
                  color: 'var(--violet-bright)', background: 'rgba(139,92,246,.14)', boxShadow: 'inset 0 0 0 1px rgba(139,92,246,.22)' }}>
                Claim {data.baseXp.toLocaleString('en-US')} XP
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
