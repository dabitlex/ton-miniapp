// src/components/clan/ClanPolicyToggle.tsx — Beitrittsregel umschalten (Leader)
// open    : jeder tritt sofort bei
// request : Beitritt nur per Anfrage (Leader/Officer entscheiden)

'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUIStore }   from '@/stores/useUIStore'
import { Globe, Lock } from 'lucide-react'

type Policy = 'open' | 'request'

export function ClanPolicyToggle({ clanId }: { clanId: string }) {
  const token  = useAuthStore(s => s.accessToken)
  const toast  = useUIStore(s => s.toast)
  const haptic = useUIStore(s => s.haptic)
  const qc     = useQueryClient()

  const { data } = useQuery<{ policy: Policy }>({
    queryKey: ['clan-policy', clanId],
    enabled:  !!token && !!clanId,
    staleTime: 30_000,
    queryFn: async () => {
      const res  = await fetch(`/api/v1/clans/${clanId}`, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      return { policy: (json?.data?.clan?.join_policy as Policy) ?? 'open' }
    },
  })

  const policy = data?.policy ?? 'open'

  const setPolicy = useMutation({
    mutationFn: async (next: Policy) => {
      const res  = await fetch(`/api/v1/clans/${clanId}`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ joinPolicy: next }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return next
    },
    onSuccess: (next) => {
      qc.setQueryData(['clan-policy', clanId], { policy: next })
      toast('success', next === 'open' ? 'Clan is now open' : 'Clan now requires requests')
      haptic?.('light')
    },
    onError: (e: Error) => { toast('error', e.message) },
  })

  const Opt = ({ value, icon: Icon, label }: { value: Policy; icon: any; label: string }) => {
    const active = policy === value
    return (
      <button
        onClick={() => { if (!active && !setPolicy.isPending) setPolicy.mutate(value) }}
        disabled={setPolicy.isPending}
        className="press flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-bold disabled:opacity-50"
        style={active
          ? { background: 'linear-gradient(160deg,rgba(139,92,246,0.24),rgba(91,141,239,0.1))', color: '#C4B5FD', boxShadow: 'inset 0 1px 0 rgba(167,139,250,0.3)', fontFamily: 'var(--font-display)' }
          : { color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
        <Icon size={14} /> {label}
      </button>
    )
  }

  return (
    <div className="surface px-3.5 py-3 space-y-2">
      <p className="eyebrow">Join policy</p>
      <div className="flex gap-2">
        <Opt value="open"    icon={Globe} label="Open" />
        <Opt value="request" icon={Lock}  label="By request" />
      </div>
    </div>
  )
}
