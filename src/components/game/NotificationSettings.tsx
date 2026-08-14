// src/components/game/NotificationSettings.tsx
'use client'
import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'

export function NotificationSettings() {
  const token = useAuthStore(s => s.accessToken)
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    if (!token) return
    fetch('/api/v1/users/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.success) setEnabled(j.data.notificationsEnabled) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  async function toggle() {
    const next = !enabled
    setEnabled(next)  // optimistic
    setSaving(true)
    try {
      // Haptic
      try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('light') } catch {}
      await fetch('/api/v1/users/settings', {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ notificationsEnabled: next }),
      })
    } catch {
      setEnabled(!next)  // rollback bei Fehler
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="surface-2 p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 flex items-center justify-center"
          style={{ borderRadius: 13,
            background: 'linear-gradient(150deg,rgba(255,255,255,.20),rgba(255,255,255,.05))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.30), inset 0 0 0 .5px rgba(255,255,255,.10)' }}>
          <Bell size={18} style={{ color: 'var(--text-primary)' }} strokeWidth={1.6} />
        </div>
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500,
            color: 'var(--text-primary)' }}>Benachrichtigungen</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Streak, Clan Wars und Season-Updates
          </p>
        </div>
      </div>

      {/* Toggle */}
      <button
        onClick={toggle}
        disabled={loading || saving}
        className="relative rounded-full transition-all press"
        style={{
          width: 48, height: 28,
          background: enabled ? 'linear-gradient(135deg,#5B8DFF,#1D4ED8)' : 'rgba(255,255,255,0.12)',
          opacity: loading ? 0.5 : 1,
        }}>
        <span className="absolute rounded-full bg-white transition-all"
          style={{
            width: 22, height: 22, top: 3,
            left: enabled ? 23 : 3,
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          }} />
      </button>
    </div>
  )
}
