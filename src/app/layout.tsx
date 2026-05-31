// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title:       'VEXALGO',
  description: 'Earn · Level · Dominate — The premium Web3 Telegram Mini App',
  icons: {
    icon:  '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#020207" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* KEIN async — Telegram SDK muss synchron geladen sein bevor React mounted */}
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
