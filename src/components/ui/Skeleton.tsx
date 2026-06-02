// src/components/ui/Skeleton.tsx — Redesigned (Aurora OS)
import { cn } from '@/lib/utils'
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('rounded-2xl shimmer', className)} />
}
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="surface p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-11 h-11 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => <Skeleton key={i} className="h-3 w-full" />)}
    </div>
  )
}
