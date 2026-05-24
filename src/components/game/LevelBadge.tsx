// src/components/game/LevelBadge.tsx
import { cn } from '@/lib/utils'

function styleForLevel(level: number): string {
  if (level <= 5)  return 'bg-amber-900/40  text-amber-400   border-amber-700/30'
  if (level <= 10) return 'bg-slate-500/20  text-slate-300   border-slate-500/30'
  if (level <= 15) return 'bg-yellow-500/20 text-yellow-400  border-yellow-500/30'
  if (level <= 20) return 'bg-cyan-500/20   text-cyan-300    border-cyan-500/30'
  if (level <= 25) return 'bg-blue-500/20   text-blue-300    border-blue-500/30'
  return                  'bg-violet-500/20 text-violet-300  border-violet-500/30'
}

interface LevelBadgeProps {
  level: number
  size?: 'sm' | 'md'
}

export function LevelBadge({ level, size = 'sm' }: LevelBadgeProps) {
  return (
    <div className={cn(
      'inline-flex items-center justify-center font-black border rounded-lg tabular-nums',
      size === 'sm'
        ? 'text-xs px-1.5 py-0.5 min-w-[28px]'
        : 'text-sm px-2.5 py-1 min-w-[36px]',
      styleForLevel(level)
    )}>
      {level}
    </div>
  )
}
