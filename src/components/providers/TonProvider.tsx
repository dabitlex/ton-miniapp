// src/components/providers/TonProvider.tsx
'use client'
import { TonConnectUIProvider } from '@tonconnect/ui-react'

const manifestUrl =
  process.env.NEXT_PUBLIC_TON_MANIFEST_URL ??
  `${process.env.NEXT_PUBLIC_APP_URL}/tonconnect-manifest.json`

export function TonProvider({ children }: { children: React.ReactNode }) {
  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      actionsConfiguration={{
        // Kehrt nach der Wallet-Bestätigung zur MiniApp zurück
        twaReturnUrl: process.env.NEXT_PUBLIC_APP_URL as `${string}://${string}`,
        returnStrategy: 'back',
      }}
      walletsListConfiguration={{
        includeWallets: [
          {
            appName: 'telegram-wallet',
            name: 'Wallet',
            imageUrl: 'https://wallet.tg/images/logo-288.png',
            tondns: 'wallet.ton',
            aboutUrl: 'https://wallet.tg',
            universalLink: 'https://t.me/wallet?attach=wallet',
            bridgeUrl: 'https://bridge.tonapi.io/bridge',
            platforms: ['ios','android','macos','windows','linux'],
          },
        ],
      }}
    >
      {children}
    </TonConnectUIProvider>
  )
}
