// src/features/clan/hooks.ts
'use client'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { authedFetch } from '@/lib/authedFetch'

export interface ChatMessage {
  id:            string
  user_id:       string
  author_name:   string
  author_avatar: string | null
  body:          string
  created_at:    string
}

interface ChatLoad {
  clanId:    string | null
  role:      string | null
  messages:  ChatMessage[]
  notInClan: boolean
}

const MAX_IN_MEMORY = 80

export function useClanChat() {
  const token = useAuthStore(s => s.accessToken)

  // ── Initiales Laden ────────────────────────────────────────────────────────
  // WICHTIG: clanId/messages werden AUS den Query-Daten abgeleitet, nicht per
  // Seiteneffekt gesetzt. So liefert auch ein Cache-Treffer (ohne erneuten
  // queryFn-Lauf) korrekt clanId -> kein falsches "No clan yet".
  const { data, isLoading, isError, refetch } = useQuery<ChatLoad>({
    queryKey:  ['clan', 'chat'],
    enabled:   !!token,
    staleTime: 15_000,
    queryFn: async () => {
      const res  = await authedFetch('/api/v1/clans/chat', {
              })
      const json = await res.json()
      if (!json.success) {
        // 403 = wirklich kein Clan. Andere Fehler werfen (transient -> nicht als
        // "kein Clan" interpretieren).
        if (res.status === 403) {
          return { clanId: null, role: null, messages: [], notInClan: true }
        }
        throw new Error(json.error ?? 'Failed to load chat')
      }
      const d = json.data as { clanId: string; role: string; messages: ChatMessage[] }
      return { clanId: d.clanId, role: d.role, messages: d.messages ?? [], notInClan: false }
    },
  })

  const clanId    = data?.clanId ?? null
  const role      = data?.role ?? null
  const notInClan = data?.notInClan ?? false

  // ── Realtime-Nachrichten (separat gehalten, mit Initiallast gemerged) ──────
  const [live, setLive] = useState<ChatMessage[]>([])
  // Soft-gelöschte IDs (per Moderation) -> aus der Anzeige filtern.
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  // Bei Clan-Wechsel die Live-Liste + Lösch-Set leeren.
  useEffect(() => { setLive([]); setDeletedIds(new Set()) }, [clanId])

  const messages = useMemo(() => {
    const map = new Map<string, ChatMessage>()
    for (const m of data?.messages ?? []) map.set(m.id, m)
    for (const m of live)                 map.set(m.id, m)
    for (const id of deletedIds)          map.delete(id)
    return [...map.values()]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-MAX_IN_MEMORY)
  }, [data?.messages, live, deletedIds])

  // ── Senden ──────────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      const res  = await authedFetch('/api/v1/clans/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ body }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to send')
      return json.data.message as ChatMessage
    },
    onSuccess: (msg) => setLive(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]),
  })

  const send = useCallback((body: string) => {
    const trimmed = body.replace(/\s+/g, ' ').trim()
    if (!trimmed) return Promise.resolve()
    return sendMutation.mutateAsync(trimmed.slice(0, 200))
  }, [sendMutation])

  // ── Moderation: Nachricht löschen (Leader/Officer) ─────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const res  = await fetch(`/api/v1/clans/chat/${messageId}`, {
        method:  'DELETE',
              })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to delete')
      return messageId
    },
    // Optimistisch ausblenden; das Realtime-UPDATE bestätigt es für alle.
    onSuccess: (id) => setDeletedIds(prev => new Set(prev).add(id)),
  })

  const deleteMessage = useCallback(
    (messageId: string) => deleteMutation.mutateAsync(messageId),
    [deleteMutation],
  )

  // ── Realtime-Subscription (Cleanup am SELBEN Client -> kein Leak) ──────────
  const clientRef  = useRef<any>(null)
  const channelRef = useRef<any>(null)

  useEffect(() => {
    if (!token || !clanId) return
    let cancelled = false

    import('@/lib/supabase/client').then(async ({ createSupabaseBrowserClient }) => {
      if (cancelled) return
      const supabase = createSupabaseBrowserClient()
      clientRef.current = supabase

      // KRITISCH: Realtime mit User-JWT authentifizieren, sonst greift die
      // RLS-Policy (TO authenticated / auth.uid()) nicht.
      try { await supabase.realtime.setAuth(token) } catch { /* noop */ }

      const channel = supabase
        .channel(`clan-chat-${clanId}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'clan_chat_messages', filter: `clan_id=eq.${clanId}` },
          (payload: any) => {
            const r = payload.new
            if (!r || r.deleted_at) return
            setLive(prev => prev.some(m => m.id === r.id) ? prev : [...prev, {
              id: r.id, user_id: r.user_id, author_name: r.author_name,
              author_avatar: r.author_avatar ?? null, body: r.body, created_at: r.created_at,
            }])
          },
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'clan_chat_messages', filter: `clan_id=eq.${clanId}` },
          (payload: any) => {
            const r = payload.new
            // Moderation: deleted_at gesetzt -> Nachricht ausblenden.
            if (r?.deleted_at) setDeletedIds(prev => new Set(prev).add(r.id))
          },
        )
        .subscribe()
      channelRef.current = channel
    })

    return () => {
      cancelled = true
      const supabase = clientRef.current
      const channel  = channelRef.current
      if (supabase && channel) { try { supabase.removeChannel(channel) } catch { /* noop */ } }
      channelRef.current = null
    }
  }, [token, clanId])

  return {
    messages,
    clanId,
    role,
    notInClan,
    isLoading,
    isError,
    isSending: sendMutation.isPending,
    sendError: sendMutation.error as Error | null,
    send,
    deleteMessage,
    isDeleting: deleteMutation.isPending,
    reload: refetch,
  }
}
