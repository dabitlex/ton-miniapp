// src/components/providers/AuthProvider.tsx
'use client'
import { useEffect, useRef, useCallback } from 'react'
import { useRouter }         from 'next/navigation'
import { useAuthStore }      from '@/stores/useAuthStore'
import { useUserStore }      from '@/stores/useUserStore'
import { useEnergyStore }    from '@/stores/useEnergyStore'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { UserProfile }  from '@/types/game'

interface Props { children: React.ReactNode }

export function AuthProvider({ children }: Props) {
  const router       = useRouter()
  const didInit      = useRef(false)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const auth                   = useAuthStore()
  const { setProfile }         = useUserStore()
  const { hydrate: hydrateEnergy } = useEnergyStore()

  // ── Profil laden ─────────────────────────────────────
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
      const profile = json.data as UserProfile
      setProfile(profile)
      hydrateEnergy(profile.energy)
    } catch (e) {
      console.error('[Auth] Profil laden fehlgeschlagen:', e)
    }
  }, [setProfile, hydrateEnergy])

  // ── Token-Refresh planen ──────────────────────────────
  const scheduleRefresh = useCallback((expiresIn: number) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    const delay = Math.max(0, (expiresIn - 120) * 1000)
    refreshTimer.current = setTimeout(async () => {
      const { refreshToken } = useAuthStore.getState()
      if (!refreshToken) return
      try {
        const res  = await fetch('/api/v1/auth/refresh', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ refreshToken }),
        })
        if (!res.ok) { auth.clearSession(); return }
        const text = await res.text()
        if (!text) return
        const json = JSON.parse(text)
        if (json.success) {
          auth.setSession(json.data)
          scheduleRefresh(json.data.expiresIn)
        } else {
          auth.clearSession()
        }
      } catch {
        auth.clearSession()
      }
    }, delay)
  }, [auth])

  // ── Authentifizierung ─────────────────────────────────
  const authenticate = useCallback(async (initData: string) => {
    auth.setInitializing(true)
    try {
      const res = await fetch('/api/v1/auth/telegram', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ initData }),
      })

      // Leere Response abfangen
      const text = await res.text()
      if (!text) {
        auth.setAuthError('Leere Server-Antwort')
        auth.setInitializing(false)
        return
      }

      let json: any
      try { json = JSON.parse(text) }
      catch {
        auth.setAuthError(`Ungültige Server-Antwort: ${text.slice(0, 100)}`)
        auth.setInitializing(false)
        return
      }

      if (!json.success) {
        auth.setAuthError(json.error ?? 'Authentifizierung fehlgeschlagen')
        auth.setInitializing(false)
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
      console.error('[Auth] Fehler:', e)
    } finally {
      auth.setInitializing(false)
    }
  }, [auth, fetchProfile, scheduleRefresh, router])

  // ── Bootstrap beim Start ──────────────────────────────
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true

    const tg = (window as any).Telegram?.WebApp

    if (tg) {
      tg.ready()
      tg.expand()
      tg.enableClosingConfirmation()
      tg.setBackgroundColor('#0c0c0f')
      tg.setHeaderColor('#0c0c0f')
    }

    const initData = tg?.initData ?? process.env.NEXT_PUBLIC_DEV_INIT_DATA ?? ''

    if (initData) {
      authenticate(initData)
    } else {
      auth.setInitializing(false)
    }

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, []) // eslint-disable-line

  // ── Realtime: User-Änderungen live synchronisieren ────
  useEffect(() => {
    const { userId, accessToken } = auth
    if (!userId || !accessToken) return

    const supabase = createSupabaseBrowserClient()

    const channel = supabase
      .channel(`user-${userId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
        (payload) => {
          const u = payload.new as any
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

    return () => { supabase.removeChannel(channel) }
  }, [auth.userId, auth.accessToken]) // eslint-disable-line

  return <>{children}</>
}
