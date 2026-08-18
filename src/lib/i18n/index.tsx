// src/lib/i18n/index.tsx
// Sprachsystem der App. Bewusst ohne externe Bibliothek — die App braucht
// genau zwei Sprachen und keine Pluralregeln fremder Sprachfamilien.
//
// Aufbau:
//   dict.ts   — alle Texte, nach Bereichen gruppiert
//   hier      — Provider, Hook t(), Persistenz
//
// Reihenfolge beim Ermitteln der Sprache (erste Quelle gewinnt):
//   1. Bewusste Wahl des Nutzers (Server, folgt auf andere Geraete)
//   2. Zwischenspeicher im Browser (sofort beim Start verfuegbar)
//   3. Geraetesprache aus Telegram
//   4. Englisch
'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { DICT, type Lang, type DictKey } from './dict'

const STORAGE_KEY = 'vex_lang'

interface I18nValue {
  lang: Lang
  /** Uebersetzt einen Schluessel; {platzhalter} werden ersetzt. */
  t: (key: DictKey, vars?: Record<string, string | number>) => string
  setLang: (l: Lang) => void
  /** true, solange die Serverwahl noch geladen wird */
  isLoading: boolean
}

const I18nContext = createContext<I18nValue | null>(null)

/** Startsprache ohne Serverabfrage — verhindert Aufblitzen der falschen Sprache */
function initialLang(): Lang {
  if (typeof window === 'undefined') return 'en'

  const stored = window.localStorage?.getItem(STORAGE_KEY)
  if (stored === 'de' || stored === 'en') return stored

  const tgLang = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.language_code
  if (typeof tgLang === 'string' && tgLang.toLowerCase().startsWith('de')) return 'de'

  const nav = window.navigator?.language
  if (typeof nav === 'string' && nav.toLowerCase().startsWith('de')) return 'de'

  return 'en'
}

export function I18nProvider({
  children,
  serverLang,
}: {
  children: React.ReactNode
  /** Vom Server geladene Wahl; ueberschreibt den lokalen Startwert */
  serverLang?: Lang | null
}) {
  const [lang, setLangState] = useState<Lang>('en')
  const [isLoading, setLoading] = useState(true)

  // Startwert erst im Browser bestimmen (kein Mismatch beim Server-Rendern)
  useEffect(() => {
    setLangState(initialLang())
    setLoading(false)
  }, [])

  // Serverwahl hat Vorrang, sobald sie eintrifft
  useEffect(() => {
    if (serverLang === 'de' || serverLang === 'en') {
      setLangState(serverLang)
      try { window.localStorage?.setItem(STORAGE_KEY, serverLang) } catch { /* ignore */ }
    }
  }, [serverLang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { window.localStorage?.setItem(STORAGE_KEY, l) } catch { /* ignore */ }
    try { document.documentElement.lang = l } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try { document.documentElement.lang = lang } catch { /* ignore */ }
  }, [lang])

  const t = useCallback((key: DictKey, vars?: Record<string, string | number>) => {
    // Fehlt ein Text in der gewaehlten Sprache, faellt er auf Englisch
    // zurueck; fehlt er ganz, wird der Schluessel selbst angezeigt —
    // das macht Luecken im Test sichtbar statt sie zu verstecken.
    const raw = DICT[lang]?.[key] ?? DICT.en?.[key] ?? key
    if (!vars) return raw
    return raw.replace(/\{(\w+)\}/g, (m, name) =>
      vars[name] != null ? String(vars[name]) : m)
  }, [lang])

  const value = useMemo<I18nValue>(() => ({ lang, t, setLang, isLoading }),
    [lang, t, setLang, isLoading])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    // Ausserhalb des Providers (z.B. in Tests): Englisch ohne Persistenz
    return {
      lang: 'en',
      t: (k: DictKey, vars?: Record<string, string | number>) => {
        const raw = DICT.en?.[k] ?? k
        return vars ? raw.replace(/\{(\w+)\}/g, (m, n) => vars[n] != null ? String(vars[n]) : m) : raw
      },
      setLang: () => {},
      isLoading: false,
    }
  }
  return ctx
}

/** Kurzform fuer Komponenten, die nur Texte brauchen */
export function useT() {
  return useI18n().t
}

/** Zahlen im Format der gewaehlten Sprache (1.234 vs 1,234) */
export function useNumberFormat() {
  const { lang } = useI18n()
  return useCallback((n: number) =>
    new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US').format(n), [lang])
}

/**
 * Uebersetzung AUSSERHALB von React — fuer Fehlermeldungen in fetch-Helfern,
 * Toasts aus Mutationen und aehnliches, wo kein Hook verfuegbar ist.
 * Liest dieselbe Quelle wie der Provider (localStorage), damit beide
 * garantiert dieselbe Sprache verwenden.
 */
export function tStatic(key: DictKey, vars?: Record<string, string | number>): string {
  let lang: Lang = 'en'
  try {
    const stored = window.localStorage?.getItem(STORAGE_KEY)
    if (stored === 'de' || stored === 'en') lang = stored
    else {
      const tg = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.language_code
      if (typeof tg === 'string' && tg.toLowerCase().startsWith('de')) lang = 'de'
    }
  } catch { /* SSR oder kein Storage */ }

  const raw = DICT[lang]?.[key] ?? DICT.en?.[key] ?? key
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (m, n) => vars[n] != null ? String(vars[n]) : m)
}

export type { Lang, DictKey }
