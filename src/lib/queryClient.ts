// src/lib/queryClient.ts
'use client'
import { QueryClient } from '@tanstack/react-query'

// EIN gemeinsamer QueryClient für die ganze App (Splash + Game).
// Vorher wurde pro QueryProvider-Mount ein neuer Client erstellt → beim Wechsel
// Splash → /home ging der vorgeladene Cache verloren. Als Singleton bleibt der
// im Splash vorgeladene Cache erhalten, sodass die Tabs ohne Laden öffnen.
let client: QueryClient | null = null

export function getQueryClient(): QueryClient {
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime:            60_000,
          gcTime:               300_000,
          retry:                2,
          refetchOnWindowFocus: false,
          refetchOnReconnect:   true,
        },
        mutations: { retry: 0 },
      },
    })
  }
  return client
}
