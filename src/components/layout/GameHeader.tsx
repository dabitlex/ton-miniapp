// src/components/layout/GameHeader.tsx
'use client'
import Link           from 'next/link'
import { useUserStore }from '@/stores/useUserStore'
import { LevelBadge } from '@/components/game/LevelBadge'
import { formatNumber }from '@/lib/utils'
import { Bell }       from 'lucide-react'
import { useUIStore } from '@/stores/useUIStore'

export function GameHeader() {
  const profile      = useUserStore(s => s.profile)
  const notifications= useUIStore(s => s.notifications)
  const unread       = notifications.length

  return (
    <header className="shrink-0 flex items-center justify-between px-4 h-[52px]
                       border-b border-white/[0.04] bg-[#0c0c0f]">
      {/* Left: level */}
      <div className="flex items-center gap-2">
        {profile && <LevelBadge level={profile.level} />}
        <span className="text-xs text-white/30 font-medium">
          {profile ? `${formatNumber(profile.seasonXp)} XP` : '…'}
        </span>
      </div>

      {/* Center: app name */}
      <span className="text-sm font-black text-white/70 tracking-tight">
        TON<span className="text-violet-400">APP</span>
      </span>

      {/* Right: notifications + avatar */}
      <div className="flex items-center gap-2">
        <button className="relative p-1.5">
          <Bell size={18} className="text-white/30" />
          {unread > 0 && (
            <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full
                             bg-violet-500 text-[9px] font-black text-white
                             flex items-center justify-center">
              {Math.min(unread, 9)}
            </span>
          )}
        </button>
        <Link href="/profile" className="active:scale-90 transition-transform">
          {profile?.telegramPhotoUrl ? (
            <img src={profile.telegramPhotoUrl} alt=""
              className="w-7 h-7 rounded-full ring-1 ring-white/10" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-violet-500/30
                            flex items-center justify-center text-xs font-bold text-violet-300">
              {profile?.telegramFirstName[0] ?? '?'}
            </div>
          )}
        </Link>
      </div>
    </header>
  )
}