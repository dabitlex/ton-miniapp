// src/components/providers/QueryProvider.tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime:           60_000,
        gcTime:              300_000,
        retry:               2,
        refetchOnWindowFocus:false,   // Telegram WebView focus changes are noisy
        refetchOnReconnect:  true,
      },
      mutations: { retry: 0 },
    },
  }))
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}