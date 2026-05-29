// src/app/(game)/ecosystem/page.tsx 
// IMPORTANT: All copy uses "Ecosystem Support" — never "investment", "returns", "profit"
'use client'
import { useState }    from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUIStore }   from '@/stores/useUIStore'
import { Button }       from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatNumber } from '@/lib/utils'
import { ECOSYSTEM_TIERS } from '@/lib/constants/game'
import type { EcosystemSupportTier, ActiveEcosystemBoost } from '@/types/game'
import { Zap, Shield, TrendingUp } from 'lucide-react'

export default function EcosystemPage() {
  const token  = useAuthStore(s => s.accessToken)
  const { toast } = useUIStore()
  const qc     = useQueryClient()

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

  const { mutate: support, isPending, variables: pendingTier } = useMutation({
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

  // In production this would use TON Connect to send the real tx.
  // For MVP demo, we simulate with a placeholder hash.
  function handleSupport(tier: EcosystemSupportTier) {
    const demoHash = `demo_${Date.now()}_${tier.key}`
    support({ txHash: demoHash, tonAmount: tier.tonAmount })
  }

  if (isLoading) return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      <SkeletonCard lines={2} />
      {[1,2,3].map(i => <SkeletonCard key={i} lines={1} />)}
    </div>
  )

  const active = data?.activeBoost

  return (
    <div className="px-4 pt-4 pb-6 space-y-4 max-w-lg mx-auto">

      {/* Hero */}
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={16} className="text-violet-400" />
          <span className="text-sm font-bold text-violet-300">Ecosystem Support</span>
        </div>
        <p className="text-xs text-white/50 leading-relaxed">
          Support the TON MiniApp ecosystem and receive an XP boost for the rest of this season.
          Boosts apply to your first 3,000 XP earned each day.
        </p>
        <div className="flex items-center gap-4 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <Zap size={11} className="text-yellow-400" />
            Up to +25% XP/day
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <TrendingUp size={11} className="text-green-400" />
            Active for full season
          </div>
        </div>
      </div>

      {/* Active boost banner */}
      {active && (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-400 font-semibold mb-0.5">✓ Active Boost</p>
              <p className="text-xl font-black text-emerald-300">+{active.boostPercent}% XP</p>
              <p className="text-xs text-white/40 mt-0.5">
                Until {new Date(active.boostActiveUntil).toLocaleDateString()}
              </p>
            </div>
            <div className="text-3xl">⚡</div>
          </div>
        </div>
      )}

      {/* Tier cards */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Support Tiers</h3>
        {ECOSYSTEM_TIERS.map(tier => {
          const isCurrent  = active?.tier === tier.key
          const isBetter   = active && tier.boostPercent > active.boostPercent
          const isPendingThis = isPending && (pendingTier as any)?.tonAmount === tier.tonAmount

          return (
            <div
              key={tier.key}
              className={`rounded-2xl border p-4 transition-all ${
                isCurrent
                  ? 'border-violet-500/35 bg-violet-500/[0.07]'
                  : 'border-white/[0.07] bg-white/[0.02]'
              }`}
            >
              {isCurrent && (
                <div className="text-[10px] font-black text-violet-400 bg-violet-500/15
                                px-2 py-0.5 rounded-full inline-block mb-2 border border-violet-500/20">
                  ACTIVE
                </div>
              )}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-lg font-black text-white">{tier.tonAmount} TON</p>
                  <p className="text-xs text-white/40">{tier.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-violet-300">+{tier.boostPercent}%</p>
                  <p className="text-[10px] text-white/30">XP Boost</p>
                </div>
              </div>
              <p className="text-xs text-white/35 mb-3 leading-relaxed">{tier.description}</p>
              <Button
                fullWidth
                variant={isCurrent ? 'secondary' : 'primary'}
                size="sm"
                disabled={isCurrent}
                loading={isPendingThis}
                onClick={() => handleSupport(tier)}
                className="h-9"
              >
                {isCurrent   ? '✓ Active'
                 : isBetter  ? `Upgrade → ${tier.tonAmount} TON`
                 :             `Support with ${tier.tonAmount} TON`}
              </Button>
            </div>
          )
        })}
      </div>

      {/* History */}
      {(data?.history ?? []).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">History</h3>
          {data!.history.map((h: any) => (
            <div key={h.id}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl
                         border border-white/[0.05] bg-white/[0.02]">
              <div>
                <p className="text-xs font-semibold text-white/70">{h.tier.replace('_', ' ')} — +{h.boostPercent}%</p>
                <p className="text-[10px] text-white/30">{new Date(h.createdAt).toLocaleDateString()}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                h.isActive ? 'bg-emerald-500/15 text-emerald-400'
                           : 'bg-white/[0.06] text-white/30'
              }`}>
                {h.isActive ? 'Active' : h.txStatus}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-white/20 text-center leading-relaxed px-4">
        This is Ecosystem Support — not an investment product.
        No financial returns are implied or guaranteed.
      </p>
    </div>
  )
}
