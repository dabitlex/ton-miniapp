// src/features/ads/hooks.ts
'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useEffect } from 'react'
import { useAuthStore }   from '@/stores/useAuthStore'
import { useUserStore }   from '@/stores/useUserStore'
import { useUIStore }     from '@/stores/useUIStore'
import { showAd, getBlockId } from '@/lib/adsgram'
import { authedFetch } from '@/lib/authedFetch'

interface AdStatus {
  watchedToday:   number
  dailyLimit:     number
  remainingToday: number
  weeklyCount:    number
  weeklyTarget:   number
  xpPerAd:        number
}

async function apiFetch<T>(url: string, _token: string, options?: RequestInit): Promise<T> {
  // Siehe Kommentar in features/quests/hooks.ts: eigener fetch ohne
  // 401-Refresh liess Ad-Belohnungen nach Token-Ablauf dauerhaft scheitern.
  const res  = await authedFetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  const json = await res.json().catch(() => null)
  if (!json) throw new Error('Server nicht erreichbar')
  if (!json.success) throw new Error(json.error ?? 'Request failed')
  return json.data as T
}

export function useAds() {
  const token = useAuthStore(s => s.accessToken)
  const qc    = useQueryClient()
  const { toast, haptic } = useUIStore()
  const [watching, setWatching] = useState(false)

  const { data, refetch, isLoading } = useQuery({
    queryKey:  ['ads', 'status'],
    enabled:   !!token,
    staleTime: 30_000,
    queryFn:   () => apiFetch<AdStatus>('/api/v1/ads/status', token!),
  })

  const remainingToday = data?.remainingToday ?? 5

  async function watchAd() {
    if (watching) return
    if (!getBlockId()) { toast('error', 'Werbung ist noch nicht verfügbar.'); return }
    if (remainingToday <= 0) { toast('warning', '⚠️ Tageslimit erreicht — morgen wieder!'); return }

    setWatching(true)
    haptic('light')
    const result = await showAd()
    setWatching(false)

    if (result === 'no_ad') { toast('warning', 'Gerade keine Werbung verfügbar. Bitte später erneut versuchen.'); return }
    if (result === 'error') { toast('error', 'Werbung konnte nicht abgespielt werden.'); return }

    // Reward kommt server-seitig (Adsgram-Callback). Kurz warten, dann Werte nachziehen.
    haptic('medium')
    toast('success', '✓ Belohnung wird gutgeschrieben …', 2000)
    setTimeout(() => {
      refetch()
      qc.invalidateQueries({ queryKey: ['quests', 'weekly'] })
      useUserStore.getState().refreshProfile()
    }, 1500)
  }

  return {
    watchedToday:   data?.watchedToday ?? 0,
    dailyLimit:     data?.dailyLimit ?? 5,
    remainingToday,
    weeklyCount:    data?.weeklyCount ?? 0,
    weeklyTarget:   data?.weeklyTarget ?? 20,
    xpPerAd:        data?.xpPerAd ?? 50,
    // true, solange der echte Ad-Stand noch nicht geladen ist. Verhindert,
    // dass die Watch-Ads-Karte vor dem Laden fälschlich "available" zeigt
    // (Flackern: kurz offen → dann done).
    isLoading:      isLoading || (!data && !!token),
    watching,
    watchAd,
    refetchAds:     refetch,
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Clan Chat
//
// WICHTIG: Diese Hook muss in dieser Datei exportiert werden, weil die Chat-
// Seite direkt `useClanChat` aus `@/features/clan/hooks` importiert.
// Der Chat-Endpunkt leitet den Clan serverseitig aus der Mitgliedschaft ab.
//
// Wir verwenden bewusst die authentifizierte API als Quelle der Wahrheit.
// Das ist robuster als ein separater Supabase-Realtime-Client, da die App ihre
// eigene Bearer-Session verwendet und nicht zwingend eine Supabase-Auth-Session
// besitzt. Nach Senden/Löschen wird der Query sofort invalidiert; zusätzlich
// wird regelmäßig nach neuen Nachrichten gefragt.
export interface ClanChatMessage {
  id: string
  user_id: string
  author_name: string
  author_avatar: string | null
  body: string
  created_at: string
}

interface ClanChatResponse {
  clanId: string
  role: string
  messages: ClanChatMessage[]
}

interface ClanChatState {
  messages: ClanChatMessage[]
  clanId: string | null
  role: string | null
  notInClan: boolean
  isLoading: boolean
  isSending: boolean
  sendError: Error | null
  send: (body: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
}

async function clanChatFetch<T>(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await authedFetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const json = await res.json().catch(() => null)
  if (!json) throw new Error('Server nicht erreichbar')
  if (!json.success) {
    const error = new Error(json.error ?? 'Request failed') as Error & { code?: string }
    error.code = json.code
    throw error
  }

  return json.data as T
}

export function useClanChat(): ClanChatState {
  const token = useAuthStore(s => s.accessToken)
  const qc = useQueryClient()
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<Error | null>(null)

  const query = useQuery({
    queryKey: ['clan', 'chat'],
    enabled: !!token,
    staleTime: 5_000,
    refetchInterval: 8_000,
    queryFn: async () => {
      try {
        return await clanChatFetch<ClanChatResponse>(
          '/api/v1/clans/chat',
          token!,
        )
      } catch (error) {
        // Kein Clan ist ein normaler Zustand und kein technischer Fehler.
        const e = error as Error & { code?: string }
        if (e.code === 'NOT_IN_CLAN') {
          return null
        }
        throw error
      }
    },
  })

  const send = useCallback(async (body: string) => {
    if (!token) throw new Error('Nicht angemeldet')
    if (!body.trim()) return

    setIsSending(true)
    setSendError(null)

    try {
      await clanChatFetch<{ message: ClanChatMessage }>(
        '/api/v1/clans/chat',
        token,
        {
          method: 'POST',
          body: JSON.stringify({ body }),
        },
      )

      // Nachricht sofort anzeigen; die GET-Route ist die Quelle der Wahrheit.
      await qc.invalidateQueries({ queryKey: ['clan', 'chat'] })
    } catch (error) {
      const e = error instanceof Error ? error : new Error('Nachricht konnte nicht gesendet werden')
      setSendError(e)
      throw e
    } finally {
      setIsSending(false)
    }
  }, [token, qc])

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!token) throw new Error('Nicht angemeldet')

    await clanChatFetch<{ deleted: boolean }>(
      `/api/v1/clans/chat/${encodeURIComponent(messageId)}`,
      token,
      { method: 'DELETE' },
    )

    await qc.invalidateQueries({ queryKey: ['clan', 'chat'] })
  }, [token, qc])

  // Nach einem Auth-Refresh/Clan-Wechsel keine alten Chatdaten stehen lassen.
  useEffect(() => {
    if (!token) {
      qc.removeQueries({ queryKey: ['clan', 'chat'] })
    }
  }, [token, qc])

  const data = query.data

  return {
    messages: data?.messages ?? [],
    clanId: data?.clanId ?? null,
    role: data?.role ?? null,
    notInClan: !!token && query.isSuccess && data === null,
    isLoading: query.isLoading,
    isSending,
    sendError,
    send,
    deleteMessage,
  }
}
