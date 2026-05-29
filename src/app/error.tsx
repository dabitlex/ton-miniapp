// src/app/error.tsx
'use client'
import { Button } from '@/components/ui/Button'
import { AlertTriangle } from 'lucide-react'

interface Props { error: Error & { digest?: string }; reset: () => void }

export default function ErrorPage({ error, reset }: Props) {
  return (
    <div className="h-dvh flex flex-col items-center justify-center px-6 text-center gap-5">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20
                      flex items-center justify-center">
        <AlertTriangle size={28} className="text-red-400" />
      </div>
      <div>
        <h1 className="text-lg font-bold text-white mb-1">Something went wrong</h1>
        <p className="text-sm text-white/40 max-w-xs">{error.message || 'An unexpected error occurred'}</p>
        {error.digest && <p className="text-xs text-white/20 mt-1 font-mono">#{error.digest}</p>}
      </div>
      <Button onClick={reset} size="md">Try Again</Button>
    </div>
  )
}
