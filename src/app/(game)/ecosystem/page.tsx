// src/app/(game)/ecosystem/page.tsx — Redesigned (Aurora OS · Relics Vault)
'use client'
import { useState }                                     from 'react'
import { useQuery, useMutation, useQueryClient }        from '@tanstack/react-query'
import { useTonConnectUI, useTonWallet }                from '@tonconnect/ui-react'
import { useAuthStore }      from '@/stores/useAuthStore'
import { useUIStore }        from '@/stores/useUIStore'
import { formatNumber }      from '@/lib/utils'
import { ECOSYSTEM_TIERS }   from '@/lib/constants/game'
import type { EcosystemSupportTier, ActiveEcosystemBoost } from '@/types/game'
import { Zap, Wallet, Rocket, Clock } from 'lucide-react'

// TON -> Nano conversion
function toNano(amount: number): string {
  return (BigInt(Math.round(amount * 1e9))).toString()
}

// Visual rarity per tier (presentation only)
const RELIC: Record<string, { gem: string; color: string; glow: string; rarity: string }> = {
  tier_1:   { gem: '🔹', color: '#5EEAD4', glow: 'rgba(94,234,212,0.45)', rarity: 'Common Relic' },
  tier_5:   { gem: '🔷', color: '#5B8DEF', glow: 'rgba(91,141,239,0.45)', rarity: 'Rare Crystal' },
  tier_20:  { gem: '🟣', color: '#8B5CF6', glow: 'rgba(139,92,246,0.5)',  rarity: 'Epic Shard' },
  tier_50:  { gem: '💠', color: '#A78BFA', glow: 'rgba(167,139,250,0.55)',rarity: 'Mythic Core' },
  tier_100: { gem: '👑', color: '#FBBF24', glow: 'rgba(251,191,36,0.6)',  rarity: 'Legendary Vault' },
}

export default function EcosystemPage() {
  const token          = useAuthStore(s => s.accessToken)
  const { toast }      = useUIStore()
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
    onSuccess: () => {
      toast('success', '✅ Transaction confirmed! Boost activates in ~30 seconds.')
      qc.invalidateQueries({ queryKey: ['ecosystem'] })
      setPendingTierKey(null)
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
      // Step 1: send transaction via TON Connect
      const result = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600, // valid for 10 min
        messages: [{
          address: treasuryWallet,
          amount:  toNano(tier.tonAmount),
        }],
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
        toast('success', '✅ Payment sent! Boost will activate automatically in ~30 seconds.')
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
                <p className="display-xl text-[34px]" style={{ color: '#5EEAD4' }}>+{active.boostPercent}%</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Until {new Date(active.boostActiveUntil).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
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
                +{pending.boostPercent}% XP — waiting for TON blockchain (~30s)
              </p>
            </div>
          </div>
        )}

        {/* ── Relics grid ────────────────────────────────────── */}
        <div>
          <h3 className="eyebrow mb-3">Collectible Relics</h3>

          <div className="space-y-2.5">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 shimmer" />)
              : ECOSYSTEM_TIERS.map((tier, i) => {
                  const isCurrent     = active?.tier === tier.key
                  const isPendingThis = pendingTierKey === tier.key
                  const isLowerTier   = active ? tier.boostPercent <= active.boostPercent && !isCurrent : false
                  const r = RELIC[tier.key] ?? RELIC.tier_1

                  return (
                    <div key={tier.key}
                      className="surface relative overflow-hidden p-4 animate-rise"
                      style={{
                        animationDelay: `${i * 50}ms`,
                        background: isCurrent
                          ? `linear-gradient(150deg, ${r.color}26, transparent 65%), var(--surface-1)`
                          : 'var(--surface-1)',
                        boxShadow: isCurrent
                          ? `inset 0 0 0 1px ${r.color}4d, 0 12px 32px ${r.glow}`
                          : 'inset 0 1px 0 var(--edge-light), var(--shadow-sm)',
                        opacity: isLowerTier ? 0.5 : 1,
                      }}>

                      {/* relic glow */}
                      <div className="absolute -top-6 -right-4 w-24 h-24 pointer-events-none"
                        style={{ background: `radial-gradient(circle, ${r.glow}, transparent 70%)`, opacity: isCurrent ? 1 : 0.45 }} />

                      <div className="flex items-center gap-3.5 relative z-10">
                        {/* gem tile */}
                        <div className="flex items-center justify-center w-14 h-14 rounded-2xl text-2xl shrink-0"
                          style={{ background: `${r.color}1f`, boxShadow: `inset 0 0 0 1px ${r.color}40, 0 0 18px ${r.glow}` }}>
                          {r.gem}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] font-extrabold tracking-wider uppercase" style={{ color: r.color, fontFamily: 'var(--font-display)' }}>
                              {r.rarity}
                            </p>
                            {isCurrent && (
                              <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-md"
                                style={{ background: `${r.color}26`, color: r.color, fontFamily: 'var(--font-display)' }}>
                                EQUIPPED
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-white mt-0.5">{tier.label}</p>
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="display text-[18px]" style={{ color: r.color }}>+{tier.boostPercent}%</span>
                            <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>XP · {tier.tonAmount} TON</span>
                          </div>
                        </div>
                      </div>

                      <button
                        disabled={isCurrent || isLowerTier || !!pendingTierKey || !!pending}
                        onClick={() => handleSupport(tier)}
                        className="sheen relative w-full mt-3.5 py-2.5 rounded-xl text-sm font-bold press disabled:opacity-60 flex items-center justify-center gap-2 overflow-hidden"
                        style={{
                          background: isCurrent ? 'var(--surface-2)' : `linear-gradient(135deg, ${r.color}, ${r.color}bb)`,
                          color: isCurrent ? 'var(--text-muted)' : (tier.key === 'tier_100' ? '#1a1505' : 'white'),
                          boxShadow: isCurrent ? 'inset 0 1px 0 var(--edge-light)' : `0 6px 18px ${r.glow}`,
                        }}>
                        {isPendingThis ? (
                          <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Claiming...</>
                        ) : isCurrent ? (
                          '✓ Equipped'
                        ) : isLowerTier ? (
                          '🔒 Outranked'
                        ) : (
                          <><Zap size={14} fill="currentColor" /> Claim · {tier.tonAmount} TON</>
                        )}
                      </button>
                    </div>
                  )
                })
            }
          </div>
        </div>

        {/* ── Info ───────────────────────────────────────────── */}
        <div className="surface-quiet px-3.5 py-3" style={{ background: 'rgba(91,141,239,0.07)' }}>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            ℹ️ Your transaction is verified automatically after sending. The relic equips once the TON blockchain confirms the TX (~30 seconds).
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
                      {new Date(h.createdAt).toLocaleDateString('en-US')} · {formatNumber(h.tonAmount)} TON
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
