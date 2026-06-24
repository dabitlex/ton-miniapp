// src/components/clan/ClanJoinRequests.tsx — Beitrittsanfragen (Leader/Officer)
// Rendert eine Sektion im "My Clan"-Tab. Zeigt nichts, wenn keine offenen
// Anfragen vorliegen. Approve/Reject laufen über die service-role API.

'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUIStore }   from '@/stores/useUIStore'
import { Check, X } from 'lucide-react'

interface JoinRequest {
  id: string; userId: string; name: string
  avatar: string | null; level: number; createdAt: string
}

export function ClanJoinRequests({ clanId }: { clanId: string }) {
  const token  = useAuthStore(s => s.accessToken)
  const toast  = useUIStore(s => s.toast)
  const haptic = useUIStore(s => s.haptic)
  const qc     = useQueryClient()

  const { data } = useQuery<{ requests: JoinRequest[]; count: number }>({
    queryKey: ['clan-requests', clanId],
    enabled:  !!token && !!clanId,
    staleTime: 15_000,
    refetchInterval: 45_000,
    queryFn: async () => {
      const res  = await fetch(`/api/v1/clans/${clanId}/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      return json.success ? json.data : { requests: [], count: 0 }
    },
  })

  const decide = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'approve' | 'reject' }) => {
      const res  = await fetch(`/api/v1/clans/${clanId}/requests`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ requestId, action }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: async (d) => {
      toast('success', d.decided === 'approved' ? 'Member added' : 'Request rejected')
      haptic?.('success')
      await qc.invalidateQueries({ queryKey: ['clan-requests', clanId] })
      await qc.invalidateQueries({ queryKey: ['my-membership'] }) // Roster/Member-Count
    },
    onError: (e: Error) => { toast('error', e.message); haptic?.('error') },
  })

  const requests = data?.requests ?? []
  if (requests.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="eyebrow">Join Requests · {requests.length}</h3>
      {requests.map(r => (
        <div key={r.id} className="surface flex items-center gap-3 px-3.5 py-3">
          {r.avatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={r.avatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
            : <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: 'var(--aurora)' }}>{r.name?.[0] ?? '?'}</div>}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{r.name}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Lv.{r.level}</p>
          </div>
          <button
            onClick={() => decide.mutate({ requestId: r.id, action: 'approve' })}
            disabled={decide.isPending}
            aria-label="Approve"
            className="press w-9 h-9 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40"
            style={{ background: 'rgba(52,211,153,0.16)' }}>
            <Check size={17} style={{ color: 'var(--emerald)' }} />
          </button>
          <button
            onClick={() => decide.mutate({ requestId: r.id, action: 'reject' })}
            disabled={decide.isPending}
            aria-label="Reject"
            className="press w-9 h-9 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40"
            style={{ background: 'rgba(251,113,133,0.14)' }}>
            <X size={17} style={{ color: 'var(--rose)' }} />
          </button>
        </div>
      ))}
    </div>
  )
}
