// src/app/page.tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { useAuthStore } from '@/stores/useAuthStore'

function SplashContent() {
  const { isAuthenticated, isInitializing, authError } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      router.replace('/home')
    }
  }, [isAuthenticated, isInitializing, router])

  // Fehler anzeigen — jetzt mit dem echten Fehlertext
  if (!isInitializing && authError) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-4xl">⚠️</span>
        <div>
          <p className="text-sm font-bold text-white mb-1">
            Open this app inside Telegram
          </p>
          <p className="text-xs text-white/40 max-w-xs break-words">
            {authError}
          </p>
        </div>
      </div>
    )
  }

  // Ladebildschirm
  return (
    <div className="h-dvh flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-600
                        flex items-center justify-center text-4xl
                        shadow-[0_0_40px_rgba(139,92,246,0.4)]">
          ⚡
        </div>
      </div>
      <div className="text-center space-y-1">
        <h1 className="text-xl font-black text-white">TON MiniApp</h1>
        <p className="text-sm text-white/40">Loading your adventure…</p>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-violet-400/60 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

export default function EntryPage() {
  return (
    <AuthProvider>
      <SplashContent />
    </AuthProvider>
  )
}
