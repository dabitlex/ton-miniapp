// src/stores/useAuthStore.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface AuthState {
  accessToken:     string | null
  refreshToken:    string | null
  userId:          string | null
  expiresAt:       number | null  // unix timestamp
  isAuthenticated: boolean
  isInitializing:  boolean
  authError:       string | null

  setSession: (p: { accessToken: string; refreshToken: string; userId: string; expiresIn: number }) => void
  clearSession:    () => void
  setInitializing: (v: boolean) => void
  setAuthError:    (msg: string | null) => void
  isTokenExpired:  () => boolean
  getAuthHeaders:  () => Record<string, string>
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      accessToken:     null,
      refreshToken:    null,
      userId:          null,
      expiresAt:       null,
      isAuthenticated: false,
      isInitializing:  true,
      authError:       null,

      setSession({ accessToken, refreshToken, userId, expiresIn }) {
        set({
          accessToken,
          refreshToken,
          userId,
          expiresAt:       Math.floor(Date.now() / 1000) + expiresIn,
          isAuthenticated: true,
          authError:       null,
        })
      },

      clearSession() {
        set({
          accessToken:     null,
          refreshToken:    null,
          userId:          null,
          expiresAt:       null,
          isAuthenticated: false,
        })
      },

      setInitializing: (isInitializing) => set({ isInitializing }),
      setAuthError:    (authError)       => set({ authError }),

      isTokenExpired() {
        const { expiresAt } = get()
        if (!expiresAt) return true
        return Math.floor(Date.now() / 1000) >= expiresAt - 60 // 60s buffer
      },

      getAuthHeaders() {
        const { accessToken } = get()
        return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
      },
    }),
    { name: 'auth-store' }
  )
)