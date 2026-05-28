// src/components/providers/AuthProvider.tsx
'use client'
import { useEffect, useRef, useCallback } from 'react'
import { useRouter }         from 'next/navigation'
import { useAuthStore }      from '@/stores/useAuthStore'
import { useUserStore }      from '@/stores/useUserStore'
import { useEnergyStore }    from '@/stores/useEnergyStore'
import type { UserProfile }  from '@/types/game'

interface Props { children: React.ReactNode }

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

  const authenticate = useCallback(async (initData: string, photoUrl: string | null) => {
    auth.setInitializing(true)
    try {
      const res = await fetch('/api/v1/auth/telegram', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        // photo_url direkt vom Client mitschicken — das ist die zuverlässige Quelle
        body: JSON.stringify({ initData, photoUrl }),
      })

      const text = await res.text()
      if (!text) {
        auth.setAuthError('Leere Server-Antwort')
        return
      }

      let json: any
      try { json = JSON.parse(text) }
      catch {
        auth.setAuthError(`Server-Fehler: ${text.slice(0, 150)}`)
        return
      }

      if (!json.success) {
        auth.setAuthError(json.error ?? 'Authentifizierung fehlgeschlagen')
        return
      }

      const { accessToken, refreshToken, userId, expiresIn, isNewUser } = json.data

      auth.setSession({ accessToken, refreshToken, userId, expiresIn: expiresIn ?? 3600 })
      await fetchProfile(accessToken)
      scheduleRefresh(expiresIn ?? 3600)

      if (isNewUser) {
        router.replace('/onboarding')
      } else {
        router.replace('/home')
      }
    } catch (e: any) {
      auth.setAuthError(e?.message ?? 'Netzwerkfehler')
    } finally {
      auth.setInitializing(false)
    }
  }, [auth, fetchProfile, scheduleRefresh, router])

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
      } catch { /* ignore */ }
    }

    const initData = tg?.initData ?? process.env.NEXT_PUBLIC_DEV_INIT_DATA ?? ''

    // photo_url direkt aus initDataUnsafe lesen — das ist die korrekte Quelle
    // NIEMALS selbst aus IDs oder Hashes zusammenbauen
    const photoUrl = tg?.initDataUnsafe?.user?.photo_url ?? null

    if (process.env.NODE_ENV === 'development') {
      console.log('[Auth] Telegram user:', tg?.initDataUnsafe?.user)
      console.log('[Auth] photo_url:', photoUrl)
    }

    if (initData) {
      authenticate(initData, photoUrl)
    } else {
      auth.setInitializing(false)
    }

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, []) // eslint-disable-line

  // Realtime
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
