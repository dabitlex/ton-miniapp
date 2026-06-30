// src/lib/authedFetch.ts
// fetch mit automatischem Auth-Header und reaktivem Token-Refresh.
// Bei einer 401 wird das Token EINMAL über /api/v1/auth/refresh erneuert und der
// Request wiederholt. Behebt das "Token mitten in der Session abgelaufen"-Problem
// (z.B. wenn der proaktive setTimeout-Refresh im mobilen WebView gedrosselt wurde),
// das sowohl das fehlende ×2 als auch die 401 bei Clans/Leaderboard verursacht hat.
'use client'
import { useAuthStore } from '@/stores/useAuthStore'

// Mehrere gleichzeitige 401 (z.B. beim Tab-Öffnen) lösen nur EINEN Refresh aus.
// Verhindert einen Refresh-Sturm und Probleme durch rotierende Refresh-Tokens.
let refreshing: Promise<string | null> | null = null

async function doRefresh(): Promise<string | null> {
  const cur = useAuthStore.getState()
  if (!cur.refreshToken) return null
  try {
    const res = await fetch('/api/v1/auth/refresh', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken: cur.refreshToken }),
    })
    if (!res.ok) return null
    const json = await res.json()
    if (!json.success) return null
    const d = json.data
    useAuthStore.getState().setSession({
      accessToken:  d.accessToken,
      refreshToken: d.refreshToken,
      expiresIn:    d.expiresIn ?? 3600,
      userId:       d.userId ?? cur.userId ?? '',   // userId aus Store erhalten (Refresh liefert keine)
    })
    return d.accessToken as string
  } catch {
    return null
  }
}

function refreshOnce(): Promise<string | null> {
  if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null })
  return refreshing
}

/**
 * Wie fetch(), aber hängt den Bearer-Token an und erneuert ihn bei 401 automatisch
 * (einmaliger Retry). Ersetzt manuelles `fetch(url, { headers: { Authorization } })`.
 */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const build = (t: string | null): RequestInit => ({
    ...init,
    headers: { ...(init.headers || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  })

  const token = useAuthStore.getState().accessToken
  let res = await fetch(input, build(token))

  if (res.status === 401) {
    const fresh = await refreshOnce()
    if (fresh) res = await fetch(input, build(fresh))
  }
  return res
}
