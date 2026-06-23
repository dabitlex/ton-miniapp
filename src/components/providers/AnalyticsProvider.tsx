// src/components/providers/AnalyticsProvider.tsx
// Telegram Mini Apps Analytics SDK — Pflicht für die Veröffentlichung im
// Telegram Apps Center. Initialisiert das SDK einmalig, client-seitig, so früh
// wie möglich. Token + appName werden via @DataChief_bot generiert und als
// öffentliche ENV-Variablen gesetzt (das SDK läuft im Client, der Token ist
// dafür vorgesehen).
'use client'

import { useEffect } from 'react'
import telegramAnalytics from '@telegram-apps/analytics'

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const token   = process.env.NEXT_PUBLIC_TGA_TOKEN
    const appName = process.env.NEXT_PUBLIC_TGA_APP_NAME

    if (!token || !appName) {
      console.error(
        '[TG Analytics] NEXT_PUBLIC_TGA_TOKEN / NEXT_PUBLIC_TGA_APP_NAME nicht gesetzt — SDK nicht initialisiert.',
      )
      return
    }

    try {
      telegramAnalytics.init({ token, appName })
    } catch (e) {
      console.error('[TG Analytics] init fehlgeschlagen:', e)
    }
  }, [])

  return <>{children}</>
}
