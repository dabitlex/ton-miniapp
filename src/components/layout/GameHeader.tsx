// src/components/layout/GameHeader.tsx
'use client'
import Link             from 'next/link'
import { useState }     from 'react'
import { useUserStore } from '@/stores/useUserStore'
import { LevelBadge }   from '@/components/game/LevelBadge'
import { formatNumber } from '@/lib/utils'
import { Bell }         from 'lucide-react'
import { useUIStore }   from '@/stores/useUIStore'

export function GameHeader() {
  const profile       = useUserStore(s => s.profile)
  const notifications = useUIStore(s => s.notifications)
  const unread        = notifications.length

  return (
    <header className="shrink-0 flex items-center justify-between px-4 h-[52px]
                       border-b border-white/[0.04] bg-[#0c0c0f]">
      <div className="flex items-center gap-2">
        {profile && <LevelBadge level={profile.level} />}
        <span className="text-xs text-white/30 font-medium">
          {profile ? `${formatNumber(profile.seasonXp)} XP` : '…'}
        </span>
      </div>

      <span className="text-sm font-black text-white/70 tracking-tight">
        TON<span className="text-violet-400">APP</span>
      </span>

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
          <TelegramAvatar
            photoUrl={profile?.telegramPhotoUrl ?? null}
            firstName={profile?.telegramFirstName ?? '?'}
            size={28}
          />
        </Link>
      </div>
    </header>
  )
}

// ── TelegramAvatar ────────────────────────────────────────
// Exportiert damit Profile-Seite es nutzen kann
interface AvatarProps {
  photoUrl:   string | null
  firstName:  string
  size?:      number
  className?: string
}

export function TelegramAvatar({
  photoUrl, firstName, size = 32, className = ''
}: AvatarProps) {
  const [imgError, setImgError] = useState(false)

  if (photoUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={firstName}
        width={size}
        height={size}
        onError={() => setImgError(true)}
        className={`rounded-full object-cover ring-1 ring-white/10 ${className}`}
        style={{ width: size, height: size }}
        // KEIN referrerPolicy="no-referrer" — Telegram braucht den Referrer!
        crossOrigin="anonymous"
      />
    )
  }

  return (
    <div
      className={`rounded-full bg-violet-500/30 flex items-center justify-center
                  text-violet-300 font-bold ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {(firstName[0] ?? '?').toUpperCase()}
    </div>
  )
}
