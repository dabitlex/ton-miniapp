// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { QueryProvider }  from '@/components/providers/QueryProvider'
import { Toaster }        from '@/components/ui/Toaster'
import { XPPopupLayer }   from '@/components/ui/XPPopupLayer'
import './globals.css'

export const metadata: Metadata = {
  title:       'TON MiniApp',
  description: 'Gamified Telegram MiniApp on TON',
}

export const viewport: Viewport = {
  width:          'device-width',
  initialScale:   1,
  maximumScale:   1,
  userScalable:   false,
  viewportFit:    'cover',
  themeColor:     '#0c0c0f',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Telegram WebApp SDK — must load before page JS */}
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body className="bg-[#0c0c0f] text-white antialiased overscroll-none select-none">
        <QueryProvider>
          {children}
          <Toaster />
          <XPPopupLayer />
        </QueryProvider>
      </body>
    </html>
  )
}
