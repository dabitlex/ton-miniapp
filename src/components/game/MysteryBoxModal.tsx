// src/components/game/MysteryBoxModal.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { useMysteryBoxStore } from '@/stores/useMysteryBoxStore'
import { authedFetch }        from '@/lib/authedFetch'
import { useUserStore }       from '@/stores/useUserStore'
import { useUIStore }         from '@/stores/useUIStore'
import { useQueryClient }     from '@tanstack/react-query'

type Tier = 'common' | 'uncommon' | 'rare' | 'epic' | 'jackpot'
type Phase = 'idle' | 'shaking' | 'lidopen' | 'opening' | 'reward'

interface TierStyle { label: string; c1: string; c2: string; glow: string; icon: 'star'|'coin'|'crown'|'gem'; conf: boolean }
const TIER_STYLE: Record<Tier, TierStyle> = {
  common:   { label: 'Common',   c1: '#9CC0FF', c2: '#2563FF', glow: '#2563FF', icon: 'star',  conf: false },
  uncommon: { label: 'Uncommon', c1: '#7BA5FF', c2: '#1D4ED8', glow: '#2563FF', icon: 'star',  conf: false },
  rare:     { label: 'Rare',     c1: '#8FF0C0', c2: '#15803D', glow: '#22C55E', icon: 'coin',  conf: false },
  epic:     { label: 'Epic',     c1: '#FCD34D', c2: '#B45309', glow: '#F59E0B', icon: 'crown', conf: true  },
  jackpot:  { label: 'Jackpot',  c1: '#FDE68A', c2: '#B45309', glow: '#FBBF24', icon: 'gem',   conf: true  },
}

export function MysteryBoxModal() {
  const isOpen = useMysteryBoxStore(s => s.isOpen)
  const close  = useMysteryBoxStore(s => s.close)
  const enqueueAchievements = useUIStore(s => s.enqueueAchievements)
  const pendingAch = useRef<any[]>([])
  const qc     = useQueryClient()
  const patchProfile = useUserStore(s => s.patchProfile)

  const [phase, setPhase]   = useState<Phase>('idle')
  const [result, setResult] = useState<{ tier: Tier; xp: number } | null>(null)
  const [busy, setBusy]     = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) { setPhase('idle'); setResult(null); setBusy(false) }
  }, [isOpen])

  if (!isOpen) return null

  async function openBox() {
    if (busy || phase !== 'idle') return
    setBusy(true)
    try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium') } catch {}

    // 1. Shake
    setPhase('shaking')

    // Parallel: API-Call (würfelt server-seitig)
    let apiResult: { tier: Tier; xp: number; newAchievements?: any[] } | null = null
    try {
      const res = await authedFetch('/api/v1/quests/mystery-box', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = await res.json()
      if (json.success) apiResult = { tier: json.data.tier, xp: json.data.xpReward, newAchievements: json.data.newAchievements }
    } catch {}

    // 2. Nach Shake: Deckel auf
    setTimeout(() => {
      setPhase('lidopen')
      // 3. Truhe platzt
      setTimeout(() => {
        setPhase('opening')
        // 4. Belohnung zeigen
        setTimeout(() => {
          if (apiResult) {
            setResult(apiResult)
            pendingAch.current = apiResult.newAchievements ?? []
            setPhase('reward')
            // XP optimistisch ins Profil (BEIDE: Season + Total, sonst driften sie)
            const p = useUserStore.getState().profile
            if (p) patchProfile({
              seasonXp: p.seasonXp + apiResult.xp,
              xpTotal:  p.xpTotal  + apiResult.xp,
            })
            const st = TIER_STYLE[apiResult.tier]
            if (st.conf) fireConfetti()
            try { (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success') } catch {}
            qc.invalidateQueries({ queryKey: ['leaderboard'] })
            // Echte Server-Werte nachziehen (Level/Liga können sich geändert haben)
            useUserStore.getState().refreshProfile()
          } else {
            // Fehler → schließen
            close()
          }
        }, 480)
      }, 430)
    }, 500)
  }

  function fireConfetti() {
    const popup = popupRef.current
    if (!popup) return
    const colors = ['#FFD27A','#7BA5FF','#8FF0C0','#2563FF','#9CC0FF']
    for (let i = 0; i < 44; i++) {
      const c = document.createElement('div')
      c.style.cssText = `position:absolute;width:8px;height:8px;opacity:0;pointer-events:none;left:50%;top:42%;background:${colors[i%colors.length]};border-radius:${Math.random()>0.5?'50%':'2px'}`
      popup.appendChild(c)
      const angle = Math.random() * Math.PI * 2
      const dist  = 100 + Math.random() * 170
      const dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist - 40
      c.animate(
        [{ transform: 'translate(0,0) rotate(0)', opacity: 1 },
         { transform: `translate(${dx}px,${dy}px) rotate(${Math.random()*720}deg)`, opacity: 0 }],
        { duration: 900 + Math.random()*500, easing: 'cubic-bezier(0.2,0.6,0.4,1)' }
      )
      setTimeout(() => c.remove(), 1500)
    }
  }

  const st = result ? TIER_STYLE[result.tier] : null

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(3,3,10,0.82)', backdropFilter:'blur(8px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div ref={popupRef} style={{ width:'90%', maxWidth:360, borderRadius:28, padding:'32px 24px 26px',
        textAlign:'center', position:'relative', overflow:'hidden',
        background:'radial-gradient(120% 80% at 50% 0%,rgba(139,92,246,0.18),transparent 60%),var(--surface-1)',
        boxShadow:'inset 0 1px 0 var(--edge-light),0 30px 80px rgba(0,0,0,0.6)' }}>

        <div style={{ fontFamily:'var(--font-display)', fontSize:11, fontWeight:800, letterSpacing:'0.16em',
          textTransform:'uppercase', color:'var(--violet-bright)', marginBottom:6 }}>
          Daily Quests Complete
        </div>
        <div style={{ fontFamily:'var(--font-display)', fontSize:24, fontWeight:800, color:'#fff', marginBottom:6 }}>
          Mystery Box Unlocked!
        </div>
        {phase !== 'reward' && (
          <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:24, lineHeight:1.5 }}>
            Du hast heute alle Daily Quests geschafft.<br/>Tippe auf die Truhe für deine Belohnung.
          </div>
        )}

        <div style={{ height:210, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', marginBottom:18 }}>
          {/* Chest */}
          {phase !== 'reward' && (
            <div onClick={openBox}
              className={
                'mbx-chest' +
                (phase==='idle' ? ' mbx-float' : '') +
                (phase==='shaking' ? ' mbx-shaking' : '') +
                (phase==='lidopen' ? ' mbx-lidopen' : '') +
                (phase==='opening' ? ' mbx-opening' : '')
              }
              style={{ cursor: phase==='idle'?'pointer':'default', userSelect:'none', position:'relative', zIndex:3 }}>
              <ChestSVG />
            </div>
          )}
          {phase === 'idle' && (
            <div style={{ position:'absolute', bottom:-4, left:'50%', transform:'translateX(-50%)',
              fontSize:12, fontWeight:700, color:'var(--text-faint)', animation:'mbxPulse 1.5s infinite' }}>
              tap to open
            </div>
          )}

          {/* Reward */}
          {phase === 'reward' && st && result && (
            <div style={{ width:'100%', animation:'mbxReveal 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14, height:96 }}>
                <div style={{ position:'absolute', inset:-10, borderRadius:'50%', filter:'blur(28px)', opacity:0.55, background:st.glow }} />
                <div style={{ position:'relative', zIndex:2 }}>
                  <RewardIcon icon={st.icon} c1={st.c1} c2={st.c2} />
                </div>
              </div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:9.5, fontWeight:500,
                letterSpacing:'0.16em', textTransform:'uppercase', color:st.c1, marginBottom:8 }}>
                {st.label}
              </div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:42, fontWeight:500, lineHeight:1,
                letterSpacing:'-0.03em', marginBottom:6, color:st.c1 }}>
                +{result.xp.toLocaleString('de-DE')} XP
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                bereits gutgeschrieben
              </div>
            </div>
          )}
        </div>

        {phase === 'reward' && (
          <button onClick={() => { const a = pendingAch.current; pendingAch.current = []; close(); if (a.length) setTimeout(() => enqueueAchievements(a), 250) }} className="press"
            style={{ marginTop:22, width:'100%', height:48, border:'none', borderRadius:16,
              fontFamily:'var(--font-display)', fontSize:14, fontWeight:500, cursor:'pointer', color:'#fff',
              background:'linear-gradient(135deg,#5B8DFF,#2563FF 55%,#1D4ED8)',
              boxShadow:'0 10px 26px rgba(37,99,255,0.40), inset 0 1px 0 rgba(255,255,255,0.35)' }}>
            Einsammeln
          </button>
        )}
      </div>

      {/* Scoped styles */}
      <style>{`
        .mbx-float{animation:mbxFloat 3s ease-in-out infinite}
        @keyframes mbxFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        .mbx-chest svg{filter:drop-shadow(0 14px 30px rgba(37,99,255,0.5));overflow:visible}
        .mbx-shaking{animation:mbxShake 0.5s ease-in-out}
        @keyframes mbxShake{0%,100%{transform:rotate(0) scale(1)}15%{transform:rotate(-7deg) scale(1.04)}30%{transform:rotate(6deg) scale(1.04)}45%{transform:rotate(-6deg) scale(1.06)}60%{transform:rotate(5deg) scale(1.06)}75%{transform:rotate(-4deg) scale(1.07)}90%{transform:rotate(3deg) scale(1.07)}}
        .mbx-opening{animation:mbxPop 0.5s ease-out forwards}
        @keyframes mbxPop{0%{transform:scale(1.07)}45%{transform:scale(1.28);filter:drop-shadow(0 0 48px rgba(251,191,36,0.95))}100%{transform:scale(0);opacity:0}}
        .mbx-chest #mbxLid{transition:transform 0.45s cubic-bezier(0.34,1.45,0.55,1);transform-box:fill-box;transform-origin:50% 92%}
        .mbx-lidopen #mbxLid{transform:translateY(-10px) rotate(-32deg)}
        .mbx-chest #mbxGlow{opacity:0;transition:opacity 0.3s 0.15s}
        .mbx-lidopen #mbxGlow{opacity:1}
        @keyframes mbxPulse{0%,100%{opacity:0.4}50%{opacity:1}}
        @keyframes mbxReveal{0%{opacity:0;transform:scale(0.6)}100%{opacity:1;transform:scale(1)}}
      `}</style>
    </div>
  )
}

// ===== Treasure chest SVG =====
function ChestSVG() {
  return (
    <svg width="180" height="160" viewBox="0 0 160 142" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mbxWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7C5BC9"/><stop offset="1" stopColor="#4A3382"/></linearGradient>
        <linearGradient id="mbxLidWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9B7DE0"/><stop offset="1" stopColor="#6D49C9"/></linearGradient>
        <linearGradient id="mbxGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FDE68A"/><stop offset="0.5" stopColor="#FBBF24"/><stop offset="1" stopColor="#D97706"/></linearGradient>
        <linearGradient id="mbxGoldV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FCD34D"/><stop offset="0.5" stopColor="#FBBF24"/><stop offset="1" stopColor="#D97706"/></linearGradient>
        <radialGradient id="mbxInner" cx="0.5" cy="0.5" r="0.6"><stop offset="0" stopColor="#FFF7DC"/><stop offset="0.6" stopColor="#FBBF24"/><stop offset="1" stopColor="#F59E0B" stopOpacity="0"/></radialGradient>
      </defs>
      <ellipse cx="80" cy="134" rx="60" ry="9" fill="#000" opacity="0.35"/>
      <rect x="20" y="74" width="120" height="54" rx="8" fill="url(#mbxWood)"/>
      <rect x="38" y="76" width="2.5" height="50" fill="#000" opacity="0.12"/>
      <rect x="62" y="76" width="2.5" height="50" fill="#000" opacity="0.12"/>
      <rect x="96" y="76" width="2.5" height="50" fill="#000" opacity="0.12"/>
      <rect x="120" y="76" width="2.5" height="50" fill="#000" opacity="0.12"/>
      <rect x="20" y="120" width="120" height="9" rx="4" fill="url(#mbxGold)"/>
      <rect x="20" y="112" width="14" height="16" rx="3" fill="url(#mbxGold)"/>
      <rect x="126" y="112" width="14" height="16" rx="3" fill="url(#mbxGold)"/>
      <ellipse id="mbxGlow" cx="80" cy="76" rx="52" ry="14" fill="url(#mbxInner)"/>
      <g id="mbxLid">
        <path d="M20 78 L20 56 Q20 30 80 30 Q140 30 140 56 L140 78 Z" fill="url(#mbxLidWood)"/>
        <path d="M44 78 L44 40 Q44 36 47 35" stroke="#000" strokeWidth="2.5" opacity="0.12" fill="none"/>
        <path d="M80 78 L80 32" stroke="#000" strokeWidth="2.5" opacity="0.12" fill="none"/>
        <path d="M116 78 L116 40 Q116 36 113 35" stroke="#000" strokeWidth="2.5" opacity="0.12" fill="none"/>
        <path d="M30 50 Q80 34 130 50 Q80 42 30 50 Z" fill="#fff" opacity="0.35"/>
        <rect x="20" y="74" width="120" height="9" rx="4" fill="url(#mbxGold)"/>
        <path d="M72 78 L72 33 Q80 31 88 33 L88 78 Z" fill="url(#mbxGoldV)"/>
        <path d="M20 78 L20 58 Q20 48 30 46 L34 46 L34 78 Z" fill="url(#mbxGold)"/>
        <path d="M140 78 L140 58 Q140 48 130 46 L126 46 L126 78 Z" fill="url(#mbxGold)"/>
        <circle cx="78" cy="40" r="1.8" fill="#fff" opacity="0.9"/>
        <circle cx="28" cy="56" r="1.5" fill="#fff" opacity="0.8"/>
      </g>
      <rect x="68" y="92" width="24" height="26" rx="5" fill="url(#mbxGold)"/>
      <rect x="71" y="95" width="18" height="20" rx="3" fill="#D97706" opacity="0.5"/>
      <circle cx="80" cy="102" r="3.5" fill="#3B2A6B"/>
      <rect x="78.5" y="102" width="3" height="8" rx="1.5" fill="#3B2A6B"/>
      <circle cx="80" cy="101" r="1.5" fill="#FFF7DC"/>
      <circle cx="40" cy="100" r="1.4" fill="#fff" opacity="0.5"/>
      <circle cx="120" cy="104" r="1.4" fill="#fff" opacity="0.5"/>
    </svg>
  )
}

// ===== Reward icons =====
function RewardIcon({ icon, c1, c2 }: { icon: 'star'|'coin'|'crown'|'gem'; c1: string; c2: string }) {
  if (icon === 'star') return (
    <svg width="80" height="80" viewBox="0 0 80 80" className="mbx-float" style={{ filter:'drop-shadow(0 6px 16px rgba(0,0,0,0.5))' }}>
      <defs><linearGradient id="mbxIc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c1}/><stop offset="1" stopColor={c2}/></linearGradient></defs>
      <path d="M40 6 L50 30 L76 32 L56 49 L62 74 L40 60 L18 74 L24 49 L4 32 L30 30 Z" fill="url(#mbxIc)"/>
      <path d="M40 6 L50 30 L40 34 Z" fill="#fff" opacity="0.35"/>
      <path d="M40 34 L40 60 L18 74 L24 49 Z" fill="#000" opacity="0.15"/>
    </svg>
  )
  if (icon === 'coin') return (
    <svg width="80" height="80" viewBox="0 0 80 80" className="mbx-float" style={{ filter:'drop-shadow(0 6px 16px rgba(0,0,0,0.5))' }}>
      <defs><linearGradient id="mbxIc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c1}/><stop offset="1" stopColor={c2}/></linearGradient></defs>
      <ellipse cx="40" cy="40" rx="32" ry="32" fill="url(#mbxIc)"/>
      <ellipse cx="40" cy="40" rx="23" ry="23" fill="#000" opacity="0.12"/>
      <path d="M40 22 L46 38 L40 42 L34 38 Z" fill="#fff" opacity="0.45"/>
      <text x="40" y="50" textAnchor="middle" fontFamily="var(--font-display)" fontSize="26" fontWeight="800" fill="#fff" opacity="0.92">V</text>
      <ellipse cx="33" cy="31" rx="6" ry="4" fill="#fff" opacity="0.3"/>
    </svg>
  )
  if (icon === 'crown') return (
    <svg width="84" height="80" viewBox="0 0 84 80" className="mbx-float" style={{ filter:'drop-shadow(0 6px 16px rgba(0,0,0,0.5))' }}>
      <defs><linearGradient id="mbxIc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c1}/><stop offset="1" stopColor={c2}/></linearGradient></defs>
      <path d="M10 60 L8 26 L26 44 L42 16 L58 44 L76 26 L74 60 Z" fill="url(#mbxIc)"/>
      <path d="M10 60 L74 60 L72 70 L12 70 Z" fill="url(#mbxIc)"/>
      <path d="M10 60 L74 60 L72 70 L12 70 Z" fill="#000" opacity="0.2"/>
      <path d="M42 16 L50 34 L42 38 L34 34 Z" fill="#fff" opacity="0.4"/>
      <circle cx="42" cy="14" r="4" fill="#fff" opacity="0.85"/>
      <circle cx="8" cy="24" r="3.5" fill={c1}/>
      <circle cx="76" cy="24" r="3.5" fill={c1}/>
    </svg>
  )
  return (
    <svg width="84" height="92" viewBox="0 0 70 86" className="mbx-float" style={{ filter:'drop-shadow(0 8px 20px rgba(0,0,0,0.55))' }}>
      <defs><linearGradient id="mbxIc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c1}/><stop offset="1" stopColor={c2}/></linearGradient></defs>
      <path d="M35 4 L60 26 L48 32 L22 32 L10 26 Z" fill="url(#mbxIc)"/>
      <path d="M10 26 L22 32 L35 82 Z" fill="url(#mbxIc)"/>
      <path d="M60 26 L48 32 L35 82 Z" fill="url(#mbxIc)"/>
      <path d="M22 32 L48 32 L35 82 Z" fill="url(#mbxIc)"/>
      <path d="M35 4 L60 26 L48 32 Z" fill="#fff" opacity="0.32"/>
      <path d="M10 26 L22 32 L35 82 Z" fill="#000" opacity="0.18"/>
      <path d="M22 32 L48 32 L35 82 Z" fill="#fff" opacity="0.12"/>
      <circle cx="35" cy="20" r="2.5" fill="#fff" opacity="0.9"/>
    </svg>
  )
}
