// src/components/providers/QueryProvider.tsx
'use client'
import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { getQueryClient } from '@/lib/queryClient'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Singleton statt pro Mount neu — Cache überlebt Splash → /home Navigation.
  const [client] = useState(getQueryClient)
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
