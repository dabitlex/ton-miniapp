// src/components/providers/TonProvider.tsx
'use client'
import { TonConnectUIProvider } from '@tonconnect/ui-react'

export function TonProvider({ children }: { children: React.ReactNode }) {
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const botUsername= process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? ''

  // Manifest über API-Route laden (mit CORS-Headern)
  const manifestUrl = `${appUrl}/api/tonconnect-manifest.json`

  // twaReturnUrl: MUSS https://t.me/... sein
  // Ohne korrekten Bot-Username kann Telegram nicht zurückleiten
  if (!botUsername) {
    console.error('[TON Connect] NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ist nicht gesetzt!')
  }

  const twaReturnUrl = `https://t.me/${botUsername}` as `${string}://${string}`

  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      actionsConfiguration={{
        twaReturnUrl,
        // 'back': funktioniert auf Android korrekt (automatische Rückkehr).
        // Auf iOS ist returnStrategy irrelevant wenn twaReturnUrl gesetzt ist
        // (twaReturnUrl hat Priorität in TWA-Kontext).
        // Der iOS-"Link öffnen?"-Dialog wird über skipRedirectToWallet: 'ios'
        // beim sendTransaction-Aufruf verhindert, nicht hier.
        returnStrategy:  'back',
        modals:         ['before', 'success', 'error'],
        notifications:  ['before', 'success', 'error'],
      }}
      uiPreferences={{
        theme: 'DARK',
      }}
    >
      {children}
    </TonConnectUIProvider>
  )
}
