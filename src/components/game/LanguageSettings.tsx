// src/components/game/LanguageSettings.tsx
// Sprachumschalter fuer das Einstellungs-Sheet.
// Die Wahl wird sofort lokal wirksam (kein Warten auf den Server) und
// parallel im Profil gespeichert, damit sie auf anderen Geraeten gilt
// und Push-Nachrichten in derselben Sprache ankommen.
'use client'
import { useState }     from 'react'
import { useI18n }      from '@/lib/i18n'
import { LANG_LABEL, type Lang } from '@/lib/i18n/dict'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUserStore } from '@/stores/useUserStore'
import { Icon }         from '@/components/ui/Icon'

const LANGS: Lang[] = ['de', 'en']

export function LanguageSettings() {
  const { lang, setLang, t } = useI18n()
  const token       = useAuthStore(s => s.accessToken)
  const patchProfile = useUserStore(s => s.patchProfile)
  const [saving, setSaving] = useState<Lang | null>(null)

  async function choose(next: Lang) {
    if (next === lang || saving) return

    // Sofort umschalten — die Oberflaeche soll nicht auf den Server warten
    setLang(next)
    setSaving(next)
    patchProfile?.({ languagePreference: next } as any)

    try {
      await fetch('/api/v1/users/me', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ language_preference: next }),
      })
    } catch {
      // Speichern fehlgeschlagen: die Wahl bleibt lokal erhalten
      // (localStorage), wird beim naechsten Wechsel erneut versucht.
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="surface-2" style={{ padding: 16 }}>
      <div className="flex items-center" style={{ gap: 12, marginBottom: 13 }}>
        <div className="w-10 h-10 flex items-center justify-center" style={{
          borderRadius: 13,
          background: 'linear-gradient(150deg,rgba(255,255,255,.20),rgba(255,255,255,.05))',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.30), inset 0 0 0 .5px rgba(255,255,255,.10)',
        }}>
          <Icon name="chat" size={18} strokeWidth={1.6} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500 }}>
            {t('settings.language')}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {t('settings.languageSub')}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: 5, borderRadius: 18,
        background: 'linear-gradient(150deg,rgba(255,255,255,.10),rgba(255,255,255,.03))',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.16), inset 0 0 0 .5px rgba(255,255,255,.06)' }}>
        {LANGS.map(l => {
          const active = lang === l
          return (
            <button
              key={l}
              onClick={() => choose(l)}
              disabled={!!saving}
              className="press"
              style={{
                flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 13, border: 'none',
                fontFamily: 'var(--font-display)', fontSize: 12.5,
                fontWeight: active ? 500 : 400,
                color: active ? '#fff' : 'var(--text-secondary)',
                background: active ? 'linear-gradient(135deg,#5B8DFF,#1D4ED8)' : 'transparent',
                boxShadow: active ? '0 6px 16px rgba(37,99,255,.4)' : 'none',
                opacity: saving && !active ? 0.6 : 1,
              }}
            >
              {LANG_LABEL[l]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
