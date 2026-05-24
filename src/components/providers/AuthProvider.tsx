// src/components/providers/AuthProvider.tsx
'use client'
import { useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname }         from 'next/navigation'
import { useAuthStore }   from '@/stores/useAuthStore'
import { useUserStore }   from '@/stores/useUserStore'
import { useEnergyStore } from '@/stores/useEnergyStore'
import { useUIStore }     from '@/stores/useUIStore'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { UserProfile }            from '@/types/game'

interface Props { children: React.ReactNode }

export function AuthProvider({ children }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const didInit  = useRef(false)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const auth    = useAuthStore()
  const { setProfile } = useUserStore()
  const { hydrate: hydrateEnergy } = useEnergyStore()

  // ── Authenticate via Telegram initData ───────────────────────────
  const authenticate = useCallback(async (initData: string) => {
    auth.setInitializing(true)
    try {
      const res  = await fetch('/api/v1/auth/telegram', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ initData }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      const { accessToken, refreshToken, userId, expiresIn, isNewUser } = json.data
      auth.setSession({ accessToken, refreshToken, userId, expiresIn })

      await fetchProfile(accessToken)
      scheduleRefresh(expiresIn)

      if (isNewUser && pathname !== '/onboarding') {
        router.replace('/onboarding')
      } else if (pathname === '/' || pathname === '') {
        router.replace('/home')
      }
    } catch (e: any) {
      auth.setAuthError(e.message)
      console.error('[Auth] Failed:', e.message)
    } finally {
      auth.setInitializing(false)
    }
  }, []) // eslint-disable-line

  // ── Fetch full user profile ───────────────────────────────────────
  const fetchProfile = useCallback(async (token: string) => {
    try {
      const res  = await fetch('/api/v1/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      const profile = json.data as UserProfile
      setProfile(profile)

      // Hydrate energy store from server state
      hydrateEnergy(profile.energy)
    } catch (e: any) {
      console.error('[Auth] Profile fetch failed:', e.message)
    }
  }, [setProfile, hydrateEnergy])

  // ── Schedule proactive token refresh ─────────────────────────────
  const scheduleRefresh = useCallback((expiresIn: number) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    const delay = Math.max(0, (expiresIn - 120) * 1000) // refresh 2 min before expiry
    refreshTimer.current = setTimeout(async () => {
      const { refreshToken } = useAuthStore.getState()
      if (!refreshToken) return
      try {
        const res  = await fetch('/api/v1/auth/refresh', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ refreshToken }),
        })
        const json = await res.json()
        if (json.success) {
          auth.setSession(json.data)
          scheduleRefresh(json.data.expiresIn)
        } else {
          auth.clearSession()
          router.replace('/')
        }
      } catch {
        auth.clearSession()
        router.replace('/')
      }
    }, delay)
  }, [auth, router])

  // ── Bootstrap on mount ───────────────────────────────────────────
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
      // In dev without initData, redirect to mock login or show error
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Auth] No initData — running in dev mode without auth')
        auth.setInitializing(false)
      }
    }

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, []) // eslint-disable-line

  // ── Realtime: subscribe to user XP changes ────────────────────────
  useEffect(() => {
    const { userId, accessToken } = auth
    if (!userId || !accessToken) return

    const supabase = createSupabaseBrowserClient()

    const channel = supabase
      .channel(`user:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
        (payload) => {
          const u = payload.new as any
          // Re-sync profile when XP or level changes server-side
          useUserStore.getState().patchProfile({
            level:      u.level,
            xpTotal:    u.xp_total,
            xpCurrentLevel: u.xp_current_level,
            league:     u.league,
            seasonXp:   u.season_xp,
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leaderboard_cache' },
        () => {
          // Leaderboard refreshed — invalidate React Query cache
          // (React Query will re-fetch on next access)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [auth.userId, auth.accessToken]) // eslint-disable-line

  return <>{children}</>
}