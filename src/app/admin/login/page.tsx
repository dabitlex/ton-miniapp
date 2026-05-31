// src/app/admin/login/page.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

declare global {
  interface Window {
    onTelegramAuth: (user: any) => void
  }
}

export default function AdminLoginPage() {
  const router  = useRouter()
  const ref     = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

    window.onTelegramAuth = async (user) => {
      setLoading(true)
      setError(null)
      try {
        const res  = await fetch('/api/admin/auth', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(user),
        })
        const json = await res.json()

        if (res.ok && json.success) {
          router.replace('/admin')
        } else {
          setError('Zugriff verweigert')
        }
      } catch {
        setError('Verbindungsfehler')
      } finally {
        setLoading(false)
      }
    }

    // Telegram Login Widget Script laden
    if (ref.current && botUsername) {
      const script       = document.createElement('script')
      script.src         = 'https://telegram.org/js/telegram-widget.js?22'
      script.async       = true
      script.setAttribute('data-telegram-login',   botUsername)
      script.setAttribute('data-size',             'large')
      script.setAttribute('data-onauth',           'onTelegramAuth(user)')
      script.setAttribute('data-request-access',   'write')
      script.setAttribute('data-userpic',          'false')
      ref.current.appendChild(script)
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: '#020207' }}>
      <div className="w-full max-w-sm mx-4">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 style={{
            fontFamily: 'monospace',
            fontSize: 28, fontWeight: 900,
            letterSpacing: '0.1em', color: 'white',
          }}>
            VEX<span style={{ color: '#A855F7' }}>ALGO</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>
            Admin Dashboard
          </p>
        </div>

        {/* Login Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, padding: 24,
        }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
            Mit Telegram anmelden
          </p>

          {/* Telegram Widget Container */}
          <div ref={ref} className="flex justify-center" />

          {loading && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="w-4 h-4 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Prüfe Berechtigung...</span>
            </div>
          )}

          {error && (
            <p style={{
              color: '#F43F5E', fontSize: 12,
              textAlign: 'center', marginTop: 12,
            }}>
              ⚠️ {error}
            </p>
          )}
        </div>

        <p style={{
          color: 'rgba(255,255,255,0.15)', fontSize: 11,
          textAlign: 'center', marginTop: 16,
        }}>
          Zugriff nur für autorisierte Administratoren
        </p>
      </div>
    </div>
  )
}
