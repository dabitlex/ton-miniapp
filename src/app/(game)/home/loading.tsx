// src/app/(game)/home/loading.tsx
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
export default function HomeLoading() {
  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-14 h-14 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
        <Skeleton className="h-1.5 w-full" />
      </div>
      <SkeletonCard lines={1} />
      {[1,2].map(i => <SkeletonCard key={i} lines={1} />)}
    </div>
  )
} 
