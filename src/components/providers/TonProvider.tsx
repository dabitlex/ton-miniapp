// src/components/providers/TonProvider.tsx
'use client'
import { TonConnectUIProvider } from '@tonconnect/ui-react'

const manifestUrl =
  process.env.NEXT_PUBLIC_TON_MANIFEST_URL ??
  `${process.env.NEXT_PUBLIC_APP_URL}/tonconnect-manifest.json`

// twaReturnUrl MUSS eine t.me/ URL sein
// damit die Wallet-App nach Bestätigung zur MiniApp zurückleitet
const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? ''
const twaReturnUrl = `https://t.me/${botUsername}` as `${string}://${string}`

export function TonProvider({ children }: { children: React.ReactNode }) {
  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      actionsConfiguration={{
        // t.me/BOT_USERNAME — Telegram öffnet die MiniApp nach Wallet-Bestätigung
        twaReturnUrl,
        returnStrategy: 'back',
        modals:         ['before', 'success', 'error'],
        notifications:  ['before', 'success', 'error'],
      }}
    >
      {children}
    </TonConnectUIProvider>
  )
}
