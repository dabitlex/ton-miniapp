// src/app/(game)/home/loading.tsx — Redesigned (Aurora OS)
import { Skeleton } from '@/components/ui/Skeleton'
export default function HomeLoading() {
  return (
    <div className="px-5 pt-6 pb-6 flex flex-col items-center">
      <Skeleton className="w-[200px] h-[200px] rounded-full" />
      <Skeleton className="h-7 w-40 mt-5 rounded-xl" />
      <div className="grid grid-cols-2 gap-2.5 w-full mt-6">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-[18px]" />)}
      </div>
      <Skeleton className="h-20 w-full mt-4 rounded-[22px]" />
    </div>
  )
}
