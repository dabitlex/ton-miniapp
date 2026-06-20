// src/app/(game)/ecosystem/page.tsx — Redesigned (Aurora OS · Relics Vault)
'use client'
import { useState }                                     from 'react'
import { useQuery, useMutation, useQueryClient }        from '@tanstack/react-query'
import { useTonConnectUI, useTonWallet }                from '@tonconnect/ui-react'
import { useAuthStore }      from '@/stores/useAuthStore'
import { useUIStore }        from '@/stores/useUIStore'
import { formatNumber }      from '@/lib/utils'
import { ECOSYSTEM_TIERS, CURRENCY_LABEL, CURRENCY_SHORT }   from '@/lib/constants/game'
import type { EcosystemSupportTier, ActiveEcosystemBoost } from '@/types/game'
import { Zap, Wallet, Rocket, Clock } from 'lucide-react'

// TON -> Nano conversion
function toNano(amount: number): string {
  return (BigInt(Math.round(amount * 1e9))).toString()
}

// Faceted relic crystal themes per tier (presentation only)
const RELIC: Record<string, { c1: string; c2: string; accent: string; glow: string; aura: string }> = {
  tier_1:   { c1: '#BCC4FF', c2: '#6E7BFF', accent: '#9AA6FF', glow: 'rgba(110,123,255,0.5)', aura: '#6E7BFF' },
  tier_5:   { c1: '#9CF0FF', c2: '#06B6D4', accent: '#67E8F9', glow: 'rgba(6,182,212,0.5)',   aura: '#06B6D4' },
  tier_20:  { c1: '#D7B3FF', c2: '#A855F7', accent: '#C9A3FF', glow: 'rgba(168,85,247,0.5)',  aura: '#A855F7' },
  tier_50:  { c1: '#FFD0B3', c2: '#F97316', accent: '#FFB98F', glow: 'rgba(249,115,22,0.5)',  aura: '#F97316' },
  tier_100: { c1: '#FFF0C8', c2: '#F59E0B', accent: '#FBBF24', glow: 'rgba(245,158,11,0.55)', aura: '#F59E0B' },
}

// Faceted crystal gem (SVG), gently floating
function Gem({ id, c1, c2, size = 56 }: { id: string; c1: string; c2: string; size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 76 / 60)} viewBox="0 0 60 76" className="float"
      style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))', position: 'relative', zIndex: 2 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      <path d="M30 2 L56 24 L30 74 L4 24 Z" fill={`url(#${id})`} />
      <path d="M30 2 L56 24 L30 36 Z" fill="#fff" opacity="0.3" />
      <path d="M4 24 L30 36 L30 74 Z" fill="#000" opacity="0.16" />
    </svg>
  )
}

// "ACTIVE" corner flag for the equipped relic
function Flag({ accent }: { accent: string }) {
  return (
    <span className="absolute top-2.5 right-2.5 z-20 text-[8px] font-extrabold tracking-wider px-1.5 py-0.5 rounded-md"
      style={{ color: accent, background: `${accent}26`, fontFamily: 'var(--font-display)' }}>
      ACTIVE
    </span>
  )
}

// Every tier carries the same flat +100% energy regen perk on top of its
// XP boost — same gold styling as the "⚡2x" badge in EnergyStrip, so
// players recognize it as the same perk across the app.
function EnergyBoostBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const isSm = size === 'sm'
  return (
    <span
      className={`relative z-10 inline-flex items-center gap-1 font-extrabold tracking-wide rounded-md whitespace-nowrap ${isSm ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2 py-1'}`}
      style={{ color: 'var(--gold)', background: 'var(--gold-dim)', fontFamily: 'var(--font-display)' }}>
      <Zap size={isSm ? 9 : 11} fill="currentColor" />2x Energy
    </span>
  )
}

export default function EcosystemPage() {
  const token          = useAuthStore(s => s.accessToken)
  const { toast }      = useUIStore()
  const enqueueAchievements = useUIStore(s => s.enqueueAchievements)
  const qc             = useQueryClient()
  const [tonConnectUI] = useTonConnectUI()
  const wallet         = useTonWallet()
  const [pendingTierKey, setPendingTierKey] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['ecosystem'],
    enabled:  !!token,
    queryFn:  async () => {
      const res  = await fetch('/api/v1/ecosystem', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data as {
        activeBoost: ActiveEcosystemBoost | null
        pendingBoost: { tier: string; boostPercent: number } | null
        purchaseInProgress: { tier: string; at: string } | null
        tiers: EcosystemSupportTier[]
        history: any[]
      }
    },
  })

  const { mutate: submitSupport } = useMutation({
    mutationFn: async ({ txHash, tonAmount, source }: { txHash: string; tonAmount: number; source?: string }) => {
      const res = await fetch('/api/v1/ecosystem/support', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ txHash, tonAmount, source }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: (data: any) => {
      toast('success', '✅ Zahlung bestätigt! Dein Boost wird aktiviert.')
      qc.invalidateQueries({ queryKey: ['ecosystem'] })
      setPendingTierKey(null)
      if (data?.newAchievements?.length) enqueueAchievements(data.newAchievements)
    },
    onError: (e: Error) => {
      toast('error', e.message)
      setPendingTierKey(null)
    },
  })

  async function handleSupport(tier: EcosystemSupportTier) {
    if (!wallet) {
      toast('error', 'Connect a TON wallet first')
      tonConnectUI.openModal()
      return
    }

    const treasuryWallet = process.env.NEXT_PUBLIC_TON_TREASURY_WALLET
    if (!treasuryWallet) {
      toast('error', 'Treasury wallet not configured')
      return
    }

    setPendingTierKey(tier.key)

    try {
      // ── Kauf-Sperre holen (serverseitig) ──────────────────────
      // Verhindert einen zweiten Kauf, solange dieser läuft. Übersteht App-Neustart.
      const intentRes = await fetch('/api/v1/ecosystem/intent', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tier: tier.key }),
      })
      const intentJson = await intentRes.json().catch(() => ({}))
      if (!intentRes.ok || !intentJson.success) {
        toast('error', intentJson.error ?? 'Eine Zahlung wird bereits verarbeitet. Bitte nicht erneut bezahlen.')
        qc.invalidateQueries({ queryKey: ['ecosystem'] })
        setPendingTierKey(null)
        return
      }

      // Step 1: send transaction via TON Connect
      const result = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600, // valid for 10 min
        messages: [{
          address: treasuryWallet,
          amount:  toNano(tier.tonAmount),
        }],
      }, {
        // iOS: Verhindert automatischen Deeplink-Redirect zur Wallet-App.
        // Ohne diese Option blendet iOS den "Link öffnen?"-System-Dialog ein.
        // Auf Android hat diese Option keinen Effekt — läuft dort wie gewohnt.
        skipRedirectToWallet: 'ios',
      })

      toast('info', 'Transaction sent — resolving TX hash...')

      // Step 2: resolve TX hash (TONapi polling)
      const hashRes = await fetch('/api/v1/ecosystem/resolve-tx', {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tonAmount:     tier.tonAmount,
          tierKey:       tier.key,
          senderAddress: wallet?.account?.address ?? null,
        }),
      })

      const hashJson = await hashRes.json()

      if (hashRes.status === 202) {
        toast('success', '✅ Zahlung gesendet! Dein Boost wird in den nächsten Minuten automatisch aktiviert — bitte nicht erneut bezahlen.')
        qc.invalidateQueries({ queryKey: ['ecosystem'] })
        setPendingTierKey(null)
        return
      }

      if (!hashJson.success) throw new Error(hashJson.error)

      const txHash  = hashJson.data.txHash
      const source  = hashJson.data.source

      // Step 3: register support with real hash
      submitSupport({ txHash, tonAmount: tier.tonAmount, source })

    } catch (e: any) {
      setPendingTierKey(null)
      if (e?.message?.includes('User rejects') || e?.message?.includes('Reject')) {
        toast('info', 'Transaction cancelled')
      } else if (e?.message?.includes('verifiziert werden') || e?.message?.includes('not verified')) {
        toast('error', '⚠️ TX not verified — check your wallet. Support: @vexalgo_support')
      } else {
        toast('error', e?.message ?? 'Transaction failed')
      }
    }
  }

  const active = data?.activeBoost
  const pending = data?.pendingBoost
  const purchaseInProgress = data?.purchaseInProgress

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-6 relative z-10">

      {/* ── Hero ───────────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-4 animate-rise">
        <h1 className="display-xl text-[24px] text-white leading-none">The Vault</h1>
        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Unlock status relics that boost your XP for the entire season
        </p>
      </div>

      <div className="px-5 space-y-4">

        {/* ── Wallet status ──────────────────────────────────── */}
        {!wallet && (
          <button onClick={() => tonConnectUI.openModal()}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl press animate-rise"
            style={{ background: 'rgba(91,141,239,0.10)', boxShadow: 'inset 0 0 0 1px rgba(91,141,239,0.25)' }}>
            <div className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'rgba(91,141,239,0.16)' }}>
              <Wallet size={16} style={{ color: '#5B8DEF' }} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-white">Connect Wallet</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>TON wallet required to claim relics</p>
            </div>
            <span className="text-sm font-bold" style={{ color: '#5B8DEF' }}>→</span>
          </button>
        )}

        {/* ── Active boost ───────────────────────────────────── */}
        {active ? (
          <div className="surface relative overflow-hidden p-5 animate-rise"
            style={{ background: 'linear-gradient(150deg, rgba(52,211,153,0.16), rgba(94,234,212,0.04) 60%, transparent), var(--surface-1)', boxShadow: 'inset 0 1px 0 rgba(52,211,153,0.25), 0 12px 34px rgba(16,185,129,0.14)' }}>
            <div className="absolute -top-8 -right-8 w-32 h-32 pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.22), transparent 70%)' }} />
            <div className="flex items-center justify-between relative z-10">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full pulse-glow" style={{ background: '#34D399' }} />
                  <span className="eyebrow" style={{ color: '#34D399' }}>Active Boost</span>
                </div>
                <p className="display-xl text-[34px]" style={{ color: '#5EEAD4' }}>
                  +{active.boostPercent}%<span className="text-[16px]" style={{ color: 'var(--text-muted)' }}> XP</span>
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <EnergyBoostBadge size="md" />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Until {new Date(active.boostActiveUntil).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <Zap size={40} fill="#34D399" style={{ color: '#34D399', filter: 'drop-shadow(0 0 14px rgba(16,185,129,0.55))' }} />
            </div>
          </div>
        ) : !isLoading && (
          <div className="surface p-5 text-center animate-rise">
            <Rocket size={28} className="mx-auto mb-2" style={{ color: 'var(--text-faint)' }} />
            <p className="display text-sm" style={{ color: 'var(--text-secondary)' }}>No relic equipped</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>Claim one below to boost your season</p>
          </div>
        )}

        {/* ── Pending banner ─────────────────────────────────── */}
        {pending && !active && (
          <div className="surface flex items-center gap-3 p-4"
            style={{ background: 'rgba(245,158,11,0.10)', boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.25)' }}>
            <span className="w-4 h-4 rounded-full border-2 border-amber-400/60 border-t-amber-400 animate-spin shrink-0" />
            <div>
              <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: '#FBBF24' }}>
                <Clock size={14} /> Relic confirming...
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                +{pending.boostPercent}% XP & 2x Energy regen — waiting for TON blockchain (~30s)
              </p>
            </div>
          </div>
        )}

        {/* ── Support tiers · relic grid ─────────────────────── */}
        <div>
          <h3 className="eyebrow mb-3">Support Tiers · forge a relic</h3>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-2.5">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-44 shimmer" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {ECOSYSTEM_TIERS.map((tier, i) => {
                const isCurrent     = active?.tier === tier.key
                const isPendingThis = pendingTierKey === tier.key
                const isLowerTier   = active ? tier.boostPercent <= active.boostPercent && !isCurrent : false
                const r = RELIC[tier.key] ?? RELIC.tier_1
                const isLegend = tier.key === 'tier_100'
                const btnDisabled = isCurrent || isLowerTier || !!pendingTierKey || !!pending || !!purchaseInProgress

                const btnLabel = isPendingThis
                  ? (<><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Claiming…</>)
                  : isCurrent   ? '✓ Active'
                  : isLowerTier ? '🔒 Outranked'
                  : (<><Zap size={13} fill="currentColor" /> {tier.tonAmount} {CURRENCY_SHORT}</>)

                const btnStyle: React.CSSProperties = (isCurrent || isLowerTier)
                  ? { background: 'var(--surface-2)', color: 'var(--text-muted)', boxShadow: 'inset 0 1px 0 var(--edge-light)' }
                  : { background: `linear-gradient(135deg, ${r.c1}, ${r.c2})`, color: isLegend ? '#1a1505' : '#fff', boxShadow: `0 6px 18px ${r.glow}` }

                const cardBase: React.CSSProperties = {
                  animationDelay: `${i * 50}ms`,
                  background: isCurrent
                    ? `linear-gradient(150deg, ${r.aura}22, transparent 62%), var(--surface-1)`
                    : 'var(--surface-1)',
                  boxShadow: isCurrent
                    ? `inset 0 0 0 1px ${r.aura}55, 0 12px 30px ${r.glow}`
                    : 'inset 0 1px 0 var(--edge-light), var(--shadow-sm)',
                  opacity: isLowerTier ? 0.5 : 1,
                }

                // ── Legendary tier: full-width horizontal relic ──
                if (isLegend) {
                  return (
                    <div key={tier.key} className="relative overflow-hidden rounded-[22px] p-4 animate-rise"
                      style={{ ...cardBase, gridColumn: '1 / -1' }}>
                      <div className="absolute pointer-events-none rounded-full"
                        style={{ top: '-40%', left: '16%', width: 120, height: 120, background: r.aura, filter: 'blur(34px)', opacity: isCurrent ? 0.55 : 0.4 }} />
                      {isCurrent && <Flag accent={r.accent} />}
                      <div className="relative z-10 flex items-center gap-3">
                        <Gem id="gem-tier_100" c1={r.c1} c2={r.c2} size={46} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: r.accent, fontFamily: 'var(--font-display)' }}>
                            {tier.label}
                          </p>
                          <p className="display text-[17px] text-white mt-0.5">
                            {tier.tonAmount} <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>{CURRENCY_LABEL}</span>
                          </p>
                        </div>
                        <div className="text-center shrink-0">
                          <p className="display-xl text-[22px]" style={{ color: r.accent }}>
                            +{tier.boostPercent}%<span className="text-[11px]" style={{ color: 'var(--text-muted)' }}> XP</span>
                          </p>
                          <div className="flex justify-center mt-1 mb-1.5">
                            <EnergyBoostBadge size="sm" />
                          </div>
                          <button disabled={btnDisabled} onClick={() => handleSupport(tier)}
                            className="px-4 py-2 rounded-xl text-[12px] font-bold press disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
                            style={btnStyle}>
                            {btnLabel}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                }

                // ── Standard tiers: vertical relic card ──
                return (
                  <div key={tier.key} className="relative overflow-hidden rounded-[22px] p-4 pt-5 flex flex-col items-center gap-2 animate-rise press"
                    style={cardBase}>
                    <div className="absolute pointer-events-none rounded-full"
                      style={{ top: '-26%', left: '50%', transform: 'translateX(-50%)', width: 110, height: 110, background: r.aura, filter: 'blur(32px)', opacity: isCurrent ? 0.6 : 0.42 }} />
                    {isCurrent && <Flag accent={r.accent} />}
                    <Gem id={`gem-${tier.key}`} c1={r.c1} c2={r.c2} size={56} />
                    <p className="relative z-10 display text-[15px] text-white">
                      {tier.tonAmount} <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>{CURRENCY_LABEL}</span>
                    </p>
                    <p className="relative z-10 text-[10px] font-extrabold uppercase tracking-wider" style={{ color: r.accent, fontFamily: 'var(--font-display)' }}>
                      {tier.label}
                    </p>
                    <p className="relative z-10 display-xl text-[18px]" style={{ color: r.accent }}>
                      +{tier.boostPercent}%<span className="text-[10px]" style={{ color: 'var(--text-muted)' }}> XP</span>
                    </p>
                    <EnergyBoostBadge size="sm" />
                    <button disabled={btnDisabled} onClick={() => handleSupport(tier)}
                      className="relative z-10 w-full mt-1 py-2.5 rounded-xl text-[12px] font-bold press disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
                      style={btnStyle}>
                      {btnLabel}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Info ───────────────────────────────────────────── */}
        <div className="surface-quiet px-3.5 py-3" style={{ background: 'rgba(91,141,239,0.07)' }}>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            ℹ️ Your transaction is verified automatically after sending. The relic equips once the TON blockchain confirms the TX (~30 seconds). Boost applies to your first 3,000 XP per day. Every relic also doubles your energy regen (2 instead of 1 every 15 min) for as long as it's active.
          </p>
        </div>

        {/* ── History ────────────────────────────────────────── */}
        {(data?.history ?? []).length > 0 && (
          <div>
            <h3 className="eyebrow mb-3">Collection History</h3>
            <div className="space-y-2">
              {data!.history.map((h: any) => (
                <div key={h.id} className="surface flex items-center justify-between px-3.5 py-3">
                  <div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {h.tier.replace('_', ' ')} — <span style={{ color: 'var(--violet-bright)' }}>+{h.boostPercent}%</span>
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                      {new Date(h.createdAt).toLocaleDateString('en-US')} · {formatNumber(h.tonAmount)} {CURRENCY_LABEL}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: h.isActive ? 'rgba(52,211,153,0.16)' : 'rgba(255,255,255,0.06)',
                      color: h.isActive ? 'var(--emerald)' : 'var(--text-faint)',
                    }}>
                    {h.isActive ? 'Active' : h.txStatus}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-center leading-relaxed" style={{ color: 'var(--text-ultra)' }}>
          This is Ecosystem Support — not an investment product. No financial returns are implied or guaranteed.
        </p>
      </div>
    </div>
  )
}
