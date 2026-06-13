// src/components/providers/AuthProvider.tsx
'use client'
import { useEffect, useRef, useCallback } from 'react'
import { useRouter }         from 'next/navigation'
import { useAuthStore }      from '@/stores/useAuthStore'
import { useUserStore }      from '@/stores/useUserStore'
import { useEnergyStore }    from '@/stores/useEnergyStore'
import type { UserProfile }  from '@/types/game'
import { prefetchAppData }   from '@/lib/prefetch'
import { getQueryClient }    from '@/lib/queryClient'
import { initTelegramFullscreen } from '@/lib/telegram-fullscreen'

interface Props { children: React.ReactNode }

// Fragt den Nutzer um Schreibrechte für den Bot und reiht — bei Erlaubnis —
// die Willkommensnachricht ein (Bot landet dadurch im Chat-Verlauf des Nutzers,
// damit er die App leicht wiederfindet). Fire-and-forget, blockiert nichts.
function requestWriteAccessAndWelcome(accessToken: string) {
  try {
    const tg = (window as any).Telegram?.WebApp
    if (typeof tg?.requestWriteAccess === 'function') {
      tg.requestWriteAccess((granted: boolean) => {
        if (granted) {
          fetch('/api/v1/me/welcome', {
            method:  'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
          }).catch(() => { /* ignore */ })
        }
      })
    }
  } catch { /* ignore */ }
}

export function AuthProvider({ children }: Props) {
  const router       = useRouter()
  const didInit      = useRef(false)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const auth           = useAuthStore()
  const { setProfile } = useUserStore()
  const { hydrate }    = useEnergyStore()

  const fetchProfile = useCallback(async (token: string) => {
    try {
      const res  = await fetch('/api/v1/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const text = await res.text()
      if (!text) return
      const json = JSON.parse(text)
      if (!json.success) return
      setProfile(json.data as UserProfile)
      hydrate((json.data as UserProfile).energy)
    } catch (e) {
      console.error('[Auth] fetchProfile failed:', e)
    }
  }, [setProfile, hydrate])

  const scheduleRefresh = useCallback((expiresIn: number) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    const delay = Math.max(30_000, (expiresIn - 120) * 1000)
    refreshTimer.current = setTimeout(async () => {
      const { refreshToken } = useAuthStore.getState()
      if (!refreshToken) return
      try {
        const res  = await fetch('/api/v1/auth/refresh', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ refreshToken }),
        })
        if (!res.ok) return
        const text = await res.text()
        if (!text) return
        const json = JSON.parse(text)
        if (json.success) {
          auth.setSession(json.data)
          scheduleRefresh(json.data.expiresIn ?? 3600)
        }
      } catch { /* silent */ }
    }, delay)
  }, [auth])

  const authenticate = useCallback(async (
    initData: string,
    photoUrl:   string | null,
    startParam: string | null   // ← Referral-Code aus Telegram Deep Link
  ) => {
    auth.setInitializing(true)
    try {
      const res = await fetch('/api/v1/auth/telegram', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ initData, photoUrl, startParam }),
      })

      const text = await res.text()
      if (!text) { auth.setAuthError('Leere Server-Antwort'); return }

      let json: any
      try { json = JSON.parse(text) }
      catch { auth.setAuthError(`Server error: ${text.slice(0, 150)}`); return }

      if (!json.success) {
        auth.setAuthError(json.error ?? 'Authentifizierung fehlgeschlagen')
        return
      }

      const { accessToken, refreshToken, userId, expiresIn, isNewUser } = json.data

      auth.setSession({ accessToken, refreshToken, userId, expiresIn: expiresIn ?? 3600 })
      await fetchProfile(accessToken)
      scheduleRefresh(expiresIn ?? 3600)

      if (isNewUser) {
        // Schreibrechte anfragen → bei Erlaubnis Willkommensnachricht senden
        // (Bot erscheint im Chat-Verlauf, App ist danach leicht wiederzufinden)
        requestWriteAccessAndWelcome(accessToken)
        router.replace('/onboarding')
      } else {
        // Alle Tab-Daten vorladen, solange der Splash noch sichtbar ist
        // (isInitializing bleibt true bis hier). Danach öffnen die Tabs ohne Laden.
        await prefetchAppData(accessToken)
        router.replace('/home')
      }
    } catch (e: any) {
      auth.setAuthError(e?.message ?? 'Netzwerkfehler')
    } finally {
      auth.setInitializing(false)
    }
  }, [auth, fetchProfile, scheduleRefresh, router])

  // ── Hintergrund → Vordergrund: Token + Daten auffrischen ─────────────────
  // Wenn die App aus dem Hintergrund zurückkommt (Telegram minimiert, anderer
  // Tab, Akku-Sparmodus), werden:
  //   1. Token geprüft → wenn abgelaufen oder in <5 Min ablaufend → sofort erneuert
  //   2. Alle React-Query-Daten als veraltet markiert → werden beim nächsten
  //      Render automatisch neu geladen (Quests, XP, Leaderboard, Clans …)
  // Supabase-Realtime reconnectet sich vom SDK selbst.
  useEffect(() => {
    let hiddenAt: number | null = null

    const onVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }

      // App kommt zurück — war sie länger als 30 Sekunden weg?
      const wasAway = hiddenAt !== null && Date.now() - hiddenAt > 30_000
      hiddenAt = null
      if (!wasAway) return

      const { accessToken, refreshToken, expiresAt, isAuthenticated } = useAuthStore.getState()
      if (!isAuthenticated || !accessToken) return

      // Token prüft: noch > 5 Minuten gültig? Falls nicht → sofort erneuern
      const now = Math.floor(Date.now() / 1000)
      const needsRefresh = !expiresAt || expiresAt - now < 300

      if (needsRefresh) {
        let refreshed = false

        // Versuch 1: Refresh-Token nutzen (funktioniert bis zu 60 Tage)
        if (refreshToken) {
          try {
            const res = await fetch('/api/v1/auth/refresh', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ refreshToken }),
            })
            if (res.ok) {
              const json = await res.json()
              if (json.success) {
                auth.setSession(json.data)
                scheduleRefresh(json.data.expiresIn ?? 3600)
                refreshed = true
              }
            }
          } catch { /* weiter zu Versuch 2 */ }
        }

        // Versuch 2: Komplette Neu-Authentifizierung über Telegram
        // (Fallback wenn Refresh scheitert — z.B. kein Netz beim ersten Versuch
        //  oder nach sehr langer Inaktivität). initData ist noch verfügbar,
        //  solange die Mini-App offen ist.
        if (!refreshed) {
          const tg = (window as any).Telegram?.WebApp
          const initData = tg?.initData
          if (initData) {
            const photoUrl   = tg?.initDataUnsafe?.user?.photo_url ?? null
            const startParam = tg?.initDataUnsafe?.start_param ?? null
            await authenticate(initData, photoUrl, startParam)
            return // authenticate() invalidiert selbst, hier fertig
          }
        }
      }

      // Cache für alle Queries als veraltet markieren → Tabs laden frisch
      // beim nächsten Render, ohne dass der Nutzer neu starten muss.
      getQueryClient().invalidateQueries()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [auth, scheduleRefresh, authenticate])

  // ── Initiale Authentifizierung (einmalig beim App-Start) ──────────────────
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true

    const tg = (window as any).Telegram?.WebApp

    if (tg) {
      try {
        tg.ready()
        tg.expand()
        tg.enableClosingConfirmation()
        tg.setBackgroundColor('#0c0c0f')
        tg.setHeaderColor('#0c0c0f')
        // Fullscreen anfordern + Safe-Area-Variablen setzen/überwachen
        initTelegramFullscreen()
      } catch { /* ignore */ }
    }

    const initData  = tg?.initData ?? process.env.NEXT_PUBLIC_DEV_INIT_DATA ?? ''
    const photoUrl  = tg?.initDataUnsafe?.user?.photo_url ?? null
    // start_param enthält den Referral-Code wenn App über Deep Link geöffnet
    const startParam = tg?.initDataUnsafe?.start_param ?? null

    if (process.env.NODE_ENV === 'development') {
      console.log('[Auth] start_param (Referral):', startParam)
    }

    if (initData) {
      authenticate(initData, photoUrl, startParam)
    } else {
      auth.setInitializing(false)
    }

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, []) // eslint-disable-line

  useEffect(() => {
    const { userId, accessToken } = auth
    if (!userId || !accessToken) return

    let channel: any = null

    import('@/lib/supabase/client').then(({ createSupabaseBrowserClient }) => {
      try {
        const supabase = createSupabaseBrowserClient()
        channel = supabase
          .channel(`user-${userId}`)
          .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
            (payload: any) => {
              const u = payload.new
              useUserStore.getState().patchProfile({
                level:          u.level,
                xpTotal:        u.xp_total,
                xpCurrentLevel: u.xp_current_level,
                league:         u.league,
                seasonXp:       u.season_xp,
              })
            }
          )
          .subscribe()
      } catch { /* Realtime optional */ }
    })

    return () => {
      if (channel) {
        import('@/lib/supabase/client').then(({ createSupabaseBrowserClient }) => {
          createSupabaseBrowserClient().removeChannel(channel)
        }).catch(() => {})
      }
    }
  }, [auth.userId, auth.accessToken]) // eslint-disable-line

  return <>{children}</>
}
