// src/app/admin/login/page.tsx
'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router   = useRouter()
  const ref      = useRef<HTMLDivElement>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  const handleAuth = useCallback(async (user: Record<string, any>) => {
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
        setError(json.error ?? 'Access denied')
        setLoading(false)
      }
    } catch {
      setError('Connection error')
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !ref.current) return

    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
    if (!botUsername) return

    // Callback ZUERST setzen bevor Script lädt
    ;(window as any).onTelegramAuth = handleAuth

    // Container leeren (für Re-renders)
    ref.current.innerHTML = ''

    // Script frisch laden mit Timestamp gegen Cache
    const script = document.createElement('script')
    script.src   = `https://telegram.org/js/telegram-widget.js?22&_=${Date.now()}`
    script.setAttribute('data-telegram-login',  botUsername)
    script.setAttribute('data-size',            'large')
    script.setAttribute('data-onauth',          'onTelegramAuth(user)')
    script.setAttribute('data-request-access',  'write')
    script.setAttribute('data-userpic',         'false')
    script.setAttribute('data-lang',            'de')

    ref.current.appendChild(script)

    return () => {
      // Cleanup
      delete (window as any).onTelegramAuth
    }
  }, [mounted, handleAuth])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#020207',
    }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 16px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontFamily: 'monospace', fontSize: 28,
            fontWeight: 900, letterSpacing: '0.1em', color: 'white', margin: 0,
          }}>
            VEX<span style={{ color: '#A855F7' }}>ALGO</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6 }}>
            Admin Dashboard
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, padding: 28,
        }}>
          <p style={{
            color: 'rgba(255,255,255,0.5)', fontSize: 13,
            textAlign: 'center', marginBottom: 20, marginTop: 0,
          }}>
            Sign in with Telegram
          </p>

          {/* Widget Container */}
          {mounted && (
            <div ref={ref} style={{ display: 'flex', justifyContent: 'center', minHeight: 40 }} />
          )}

          {loading && (
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8, marginTop: 16,
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '2px solid rgba(168,85,247,0.3)',
                borderTopColor: '#A855F7',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                Checking authorization...
              </span>
            </div>
          )}

          {error && (
            <p style={{
              color: '#F43F5E', fontSize: 12,
              textAlign: 'center', marginTop: 14, marginBottom: 0,
            }}>
              ⚠️ {error}
            </p>
          )}
        </div>

        <p style={{
          color: 'rgba(255,255,255,0.15)', fontSize: 11,
          textAlign: 'center', marginTop: 16,
        }}>
          Access restricted to authorized administrators
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
