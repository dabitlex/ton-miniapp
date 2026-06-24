// src/features/clan/hooks.ts
'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'

export interface ChatMessage {
  id:            string
  user_id:       string
  author_name:   string
  author_avatar: string | null
  body:          string
  created_at:    string
}

interface ChatLoad {
  clanId:   string
  role:     string
  messages: ChatMessage[]
}

async function apiFetch<T>(url: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options?.headers },
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Request failed')
  return json.data as T
}

// In-Memory-Cap: wir halten clientseitig nie mehr als so viele Nachrichten.
const MAX_IN_MEMORY = 80

export function useClanChat() {
  const token = useAuthStore(s => s.accessToken)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [clanId, setClanId]     = useState<string | null>(null)
  const [role, setRole]         = useState<string | null>(null)

  // Dedupe-Set: dieselbe Nachricht kommt sowohl aus dem POST-Result als auch
  // (für den Absender) aus dem Realtime-INSERT zurück.
  const seenIds = useRef<Set<string>>(new Set())

  const upsert = useCallback((incoming: ChatMessage[]) => {
    setMessages(prev => {
      const next = [...prev]
      for (const m of incoming) {
        if (seenIds.current.has(m.id)) continue
        seenIds.current.add(m.id)
        next.push(m)
      }
      next.sort((a, b) => a.created_at.localeCompare(b.created_at))
      // Cap einhalten (älteste vorne abschneiden)
      if (next.length > MAX_IN_MEMORY) {
        const dropped = next.splice(0, next.length - MAX_IN_MEMORY)
        for (const d of dropped) seenIds.current.delete(d.id)
      }
      return next
    })
  }, [])

  // ── Initiales Laden (letzte 30) ───────────────────────────────────────────
  const { isLoading, refetch } = useQuery({
    queryKey: ['clan', 'chat'],
    enabled:  !!token,
    staleTime: 30_000,
    queryFn: async () => {
      const data = await apiFetch<ChatLoad>('/api/v1/clans/chat', token!)
      setClanId(data.clanId)
      setRole(data.role)
      // frischer Stand: seen-Set zurücksetzen, dann befüllen
      seenIds.current = new Set()
      setMessages([])
      upsert(data.messages)
      return data
    },
  })

  // ── Senden ────────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      const data = await apiFetch<{ message: ChatMessage }>(
        '/api/v1/clans/chat', token!,
        { method: 'POST', body: JSON.stringify({ body }) },
      )
      return data.message
    },
    onSuccess: (msg) => upsert([msg]),
  })

  const send = useCallback((body: string) => {
    const trimmed = body.replace(/\s+/g, ' ').trim()
    if (!trimmed) return Promise.resolve()
    return sendMutation.mutateAsync(trimmed.slice(0, 200))
  }, [sendMutation])

  // ── Realtime: neue Nachrichten des eigenen Clans live empfangen ───────────
  useEffect(() => {
    if (!token || !clanId) return
    let channel: any = null
    let active = true

    import('@/lib/supabase/client').then(async ({ createSupabaseBrowserClient }) => {
      if (!active) return
      const supabase = createSupabaseBrowserClient()

      // KRITISCH: Realtime mit dem User-JWT authentifizieren, sonst läuft die
      // Verbindung als anon und die RLS-Policy (TO authenticated / auth.uid())
      // liefert NICHTS. Ohne diese Zeile bleibt der Live-Stream stumm.
      try { await supabase.realtime.setAuth(token) } catch { /* noop */ }

      channel = supabase
        .channel(`clan-chat-${clanId}`)
        .on('postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'clan_chat_messages',
            // Effizienz-Filter; die eigentliche Grenze bleibt die RLS.
            filter: `clan_id=eq.${clanId}`,
          },
          (payload: any) => {
            const r = payload.new
            if (!r || r.deleted_at) return
            upsert([{
              id:            r.id,
              user_id:       r.user_id,
              author_name:   r.author_name,
              author_avatar: r.author_avatar ?? null,
              body:          r.body,
              created_at:    r.created_at,
            }])
          },
        )
        .subscribe()
    })

    return () => {
      active = false
      if (channel) {
        import('@/lib/supabase/client')
          .then(({ createSupabaseBrowserClient }) =>
            createSupabaseBrowserClient().removeChannel(channel))
          .catch(() => {})
      }
    }
  }, [token, clanId, upsert])

  return {
    messages,
    clanId,
    role,
    isLoading,
    isSending: sendMutation.isPending,
    sendError: sendMutation.error as Error | null,
    send,
    reload: refetch,
  }
}
