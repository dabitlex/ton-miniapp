// src/app/(game)/ecosystem/page.tsx
// IMPORTANT: "Ecosystem Support" — never "investment", "returns", "profit"
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore }      from '@/stores/useAuthStore'
import { useUIStore }        from '@/stores/useUIStore'
import { formatNumber }      from '@/lib/utils'
import { ECOSYSTEM_TIERS }   from '@/lib/constants/game'
import type { EcosystemSupportTier, ActiveEcosystemBoost } from '@/types/game'
import { Zap } from 'lucide-react'

export default function EcosystemPage() {
  const token   = useAuthStore(s => s.accessToken)
  const { toast } = useUIStore()
  const qc      = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['ecosystem'],
    enabled:  !!token,
    queryFn:  async () => {
      const res  = await fetch('/api/v1/ecosystem', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data as { activeBoost: ActiveEcosystemBoost | null; tiers: EcosystemSupportTier[]; history: any[] }
    },
  })

  const { mutate: support, isPending, variables: pendingVars } = useMutation({
    mutationFn: async ({ txHash, tonAmount }: { txHash: string; tonAmount: number }) => {
      const res = await fetch('/api/v1/ecosystem/support', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ txHash, tonAmount }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: () => {
      toast('success', '✅ Support registered! Boost activating after confirmation.')
      qc.invalidateQueries({ queryKey: ['ecosystem'] })
    },
    onError: (e: Error) => toast('error', e.message),
  })

  function handleSupport(tier: EcosystemSupportTier) {
    support({ txHash: `demo_${Date.now()}_${tier.key}`, tonAmount: tier.tonAmount })
  }

  const active = data?.activeBoost

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-6">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="relative px-4 pt-5 pb-5 overflow-hidden"
        style={{ background: 'linear-gradient(180deg, rgba(124,58,237,0.08) 0%, transparent 100%)' }}>

        <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at top right, rgba(168,85,247,0.12), transparent)',
            filter: 'blur(20px)',
          }} />

        <h1 className="text-xl font-black text-white mb-1"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>
          BOOST
        </h1>
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Unterstütze das Ecosystem und erhalte XP-Boosts für die gesamte Saison
        </p>
      </div>

      <div className="px-4 space-y-4">

        {/* ── Active Boost ─────────────────────────────────────── */}
        {active ? (
          <div className="rounded-2xl p-4 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.04))',
              border: '1px solid rgba(16,185,129,0.25)',
              boxShadow: '0 4px 24px rgba(16,185,129,0.1)',
            }}>
            <div className="absolute top-0 right-0 w-24 h-24"
              style={{ background: 'radial-gradient(circle at top right, rgba(16,185,129,0.15), transparent)' }} />
            <div className="flex items-start justify-between relative z-10">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />
                  <span className="text-[11px] font-bold" style={{ color: '#10B981' }}>AKTIVER BOOST</span>
                </div>
                <p className="text-3xl font-black"
                  style={{ fontFamily: 'var(--font-display)', color: '#34D399' }}>
                  +{active.boostPercent}% XP
                </p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Bis {new Date(active.boostActiveUntil).toLocaleDateString('de-DE')}
                </p>
              </div>
              <div className="text-4xl" style={{ filter: 'drop-shadow(0 0 12px rgba(16,185,129,0.5))' }}>
                ⚡
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-4 text-center"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
            <p className="text-2xl mb-1">🚀</p>
            <p className="text-sm font-bold text-white/50">Kein aktiver Boost</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Wähle einen Support-Tier unten
            </p>
          </div>
        )}

        {/* ── Tiers ────────────────────────────────────────────── */}
        <div>
          <h3 className="text-[11px] font-black tracking-widest mb-3"
            style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-display)' }}>
            SUPPORT TIERS
          </h3>

          <div className="space-y-2.5">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-2xl shimmer"
                    style={{ background: 'rgba(255,255,255,0.04)' }} />
                ))
              : ECOSYSTEM_TIERS.map(tier => {
                  const isCurrent = active?.tier === tier.key
                  const isPendingThis = isPending && (pendingVars as any)?.tonAmount === tier.tonAmount

                  return (
                    <div key={tier.key} className="rounded-2xl p-4 relative overflow-hidden"
                      style={{
                        background: isCurrent
                          ? 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(168,85,247,0.06))'
                          : 'rgba(255,255,255,0.03)',
                        border: isCurrent
                          ? '1px solid rgba(124,58,237,0.35)'
                          : '1px solid rgba(255,255,255,0.07)',
                        boxShadow: isCurrent ? '0 4px 20px rgba(124,58,237,0.1)' : 'none',
                      }}>

                      {isCurrent && (
                        <div className="absolute top-3 right-3">
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                            style={{
                              background: 'rgba(124,58,237,0.2)', color: '#A855F7',
                              border: '1px solid rgba(124,58,237,0.3)',
                              fontFamily: 'var(--font-display)',
                            }}>
                            AKTIV
                          </span>
                        </div>
                      )}

                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <p className="text-xl font-black text-white"
                              style={{ fontFamily: 'var(--font-display)' }}>
                              {tier.tonAmount}
                            </p>
                            <p className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>TON</p>
                          </div>
                          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{tier.label}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black"
                            style={{
                              fontFamily: 'var(--font-display)',
                              background: 'linear-gradient(135deg, #A855F7, #3B82F6)',
                              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            }}>
                            +{tier.boostPercent}%
                          </p>
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>XP Boost</p>
                        </div>
                      </div>

                      <p className="text-xs mb-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {tier.description}
                      </p>

                      <button
                        disabled={isCurrent || isPendingThis}
                        onClick={() => !isCurrent && handleSupport(tier)}
                        className="w-full py-2.5 rounded-xl text-sm font-bold text-white
                                   transition-all active:scale-95 disabled:opacity-50
                                   flex items-center justify-center gap-2"
                        style={{
                          background: isCurrent
                            ? 'rgba(255,255,255,0.06)'
                            : 'linear-gradient(135deg, #7C3AED, #A855F7)',
                          boxShadow: isCurrent ? 'none' : '0 4px 16px rgba(124,58,237,0.3)',
                          border: isCurrent ? '1px solid rgba(255,255,255,0.1)' : 'none',
                          color: isCurrent ? 'rgba(255,255,255,0.4)' : 'white',
                        }}>
                        {isPendingThis
                          ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          : isCurrent
                          ? '✓ Aktiv'
                          : <><Zap size={14} fill="currentColor" /> {tier.tonAmount} TON supporten</>
                        }
                      </button>
                    </div>
                  )
                })
            }
          </div>
        </div>

        {/* ── History ──────────────────────────────────────────── */}
        {(data?.history ?? []).length > 0 && (
          <div>
            <h3 className="text-[11px] font-black tracking-widest mb-3"
              style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-display)' }}>
              VERLAUF
            </h3>
            <div className="space-y-2">
              {data!.history.map((h: any) => (
                <div key={h.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                  <div>
                    <p className="text-xs font-semibold text-white/70">
                      {h.tier.replace('_', ' ')} — <span style={{ color: '#A855F7' }}>+{h.boostPercent}%</span>
                    </p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {new Date(h.createdAt).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: h.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                      color: h.isActive ? '#10B981' : 'rgba(255,255,255,0.3)',
                    }}>
                    {h.isActive ? 'Aktiv' : h.txStatus}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-center leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.15)' }}>
          Dies ist Ecosystem Support — kein Investitionsprodukt.
          Keine finanziellen Erträge werden impliziert oder garantiert.
        </p>
      </div>
    </div>
  )
}
