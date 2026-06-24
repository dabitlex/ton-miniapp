// src/components/clan/ClanChatCard.tsx — Einstieg in den Clan-Chat ("My Clan"-Tab)
//
// Selbstständig: holt die Chat-Zusammenfassung (letzte Nachricht + Unread) und
// navigiert per Tap auf die Vollbild-Route /clans/chat. Stil identisch zum
// bestehenden "Clan Missions"-Shortcut (surface · press).

'use client'
import { useRouter }    from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { MessageCircle, ChevronRight } from 'lucide-react'

interface ChatSummary {
  inClan: boolean
  unread: number
  lastMessage: { author_name: string; body: string; created_at: string } | null
}

export function ClanChatCard() {
  const router = useRouter()
  const token  = useAuthStore(s => s.accessToken)
  const qc     = useQueryClient()

  const { data } = useQuery<ChatSummary>({
    queryKey: ['clan', 'chat', 'summary'],
    enabled:  !!token,
    staleTime: 20_000,
    refetchInterval: 60_000, // hält den Unread-Badge lebendig
    queryFn: async () => {
      const res  = await fetch('/api/v1/clans/chat/summary', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      return json.success ? json.data : { inClan: false, unread: 0, lastMessage: null }
    },
  })

  const unread  = data?.unread ?? 0
  const last    = data?.lastMessage ?? null
  const preview = last
    ? `${last.author_name}: ${last.body}`
    : 'No messages yet — say hi 👋'

  function open() {
    // Beim Öffnen markiert die Chat-GET-Route serverseitig als gelesen;
    // wir invalidieren die Summary, damit der Badge nach Rückkehr verschwindet.
    qc.invalidateQueries({ queryKey: ['clan', 'chat', 'summary'] })
    router.push('/clans/chat')
  }

  return (
    <button onClick={open} className="surface w-full flex items-center gap-3 px-4 py-3.5 press">
      <div className="relative flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
        style={{ background: 'rgba(139,92,246,0.14)' }}>
        <MessageCircle size={17} style={{ color: 'var(--violet-bright)' }} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-extrabold tabular-nums"
            style={{
              fontFamily: 'var(--font-display)', background: 'var(--rose)', color: '#3a0a14',
              boxShadow: '0 0 10px rgba(251,113,133,0.6)',
            }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-bold text-white">Clan Chat</p>
        <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{preview}</p>
      </div>
      <ChevronRight size={16} style={{ color: 'var(--text-faint)' }} />
    </button>
  )
}
