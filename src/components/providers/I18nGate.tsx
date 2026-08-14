// src/components/providers/I18nGate.tsx 
// Verbindet den Sprach-Provider mit dem geladenen Profil: sobald das
// Profil da ist, gewinnt die dort gespeicherte Wahl ueber den lokalen
// Startwert. Muss INNERHALB des QueryProviders haengen, weil es den
// Profil-Store liest.
'use client'
import { useUserStore } from '@/stores/useUserStore'
import { I18nProvider } from '@/lib/i18n'

export function I18nGate({ children }: { children: React.ReactNode }) {
  const pref = useUserStore(s => s.profile?.languagePreference ?? null)
  return <I18nProvider serverLang={pref}>{children}</I18nProvider>
}
