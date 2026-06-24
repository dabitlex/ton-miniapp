// src/components/clan/PendingRequestBanner.tsx — offene eigene Beitrittsanfrage
// Wird im "My Clan"-Leerzustand gezeigt (User ohne Clan, aber mit offener
// Anfrage an einen geschlossenen Clan). Erlaubt das Zurückziehen.

'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUIStore }   from '@/stores/useUIStore'
import { Clock3 } from 'lucide-react'

interface MyRequest { id: string; clanId: string; clanName: string; createdAt: string }

export function PendingRequestBanner() {
  const token  = useAuthStore(s => s.accessToken)
  const toast  = useUIStore(s => s.toast)
  const haptic = useUIStore(s => s.haptic)
  const qc     = useQueryClient()

  const { data } = useQuery<{ request: MyRequest | null }>({
    queryKey: ['my-request'],
    enabled:  !!token,
    staleTime: 20_000,
    queryFn: async () => {
      const res  = await fetch('/api/v1/clans/my-request', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      return json.success ? json.data : { request: null }
    },
  })

  const withdraw = useMutation({
    mutationFn: async () => {
      const res  = await fetch('/api/v1/clans/my-request', {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: async () => {
      toast('info', 'Request withdrawn')
      haptic?.('light')
      await qc.invalidateQueries({ queryKey: ['my-request'] })
    },
    onError: (e: Error) => { toast('error', e.message) },
  })

  const req = data?.request
  if (!req) return null

  return (
    <div className="surface-accent flex items-center gap-3 px-4 py-3.5">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
        style={{ background: 'rgba(139,92,246,0.16)' }}>
        <Clock3 size={17} style={{ color: 'var(--violet-bright)' }} />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-bold text-white truncate">Pending request</p>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>to {req.clanName}</p>
      </div>
      <button
        onClick={() => withdraw.mutate()}
        disabled={withdraw.isPending}
        className="press text-[11px] font-extrabold px-3 py-2 rounded-xl shrink-0 disabled:opacity-40"
        style={{ color: 'var(--rose)', background: 'rgba(251,113,133,0.14)', fontFamily: 'var(--font-display)' }}>
        Withdraw
      </button>
    </div>
  )
}
