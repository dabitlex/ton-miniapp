// src/components/layout/GameHeader.tsx
'use client'
import Link             from 'next/link'
import { useState }     from 'react'
import { useUserStore } from '@/stores/useUserStore'
import { formatNumber } from '@/lib/utils'

export function GameHeader() {
  const profile = useUserStore(s => s.profile)

  return (
    <header className="shrink-0 relative z-20 flex items-center justify-between
                       px-4 h-[52px] border-b border-white/[0.05]"
      style={{ background: 'rgba(6,6,16,0.95)', backdropFilter: 'blur(20px)' }}>

      {/* Left: Level + XP */}
      <div className="flex items-center gap-2.5">
        {profile && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
            <span className="font-display text-[10px] font-bold text-violet-300 tracking-wider">
              LV
            </span>
            <span className="font-display text-sm font-black text-white">
              {profile.level}
            </span>
          </div>
        )}
        <span className="text-[11px] font-semibold"
          style={{ color: 'rgba(168,85,247,0.8)' }}>
          {profile ? `${profile.seasonXp.toLocaleString()} XP` : '—'}
        </span>
      </div>

      {/* Center: Brand */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <span className="font-display text-sm font-black tracking-[0.15em] text-white/90">
          VEX<span style={{
            background: 'linear-gradient(135deg, #A855F7, #3B82F6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>ALGO</span>
        </span>
      </div>

      {/* Right: Avatar */}
      <Link href="/profile" className="active:scale-90 transition-transform">
        <TelegramAvatar
          photoUrl={profile?.telegramPhotoUrl ?? null}
          firstName={profile?.telegramFirstName ?? '?'}
          size={30}
        />
      </Link>
    </header>
  )
}

interface AvatarProps {
  photoUrl:   string | null
  firstName:  string
  size?:      number
  className?: string
}

export function TelegramAvatar({ photoUrl, firstName, size = 32, className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false)

  if (photoUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt={firstName} width={size} height={size}
        onError={() => setImgError(true)}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size,
          boxShadow: '0 0 0 2px rgba(124,58,237,0.4)' }} />
    )
  }

  return (
    <div className={`rounded-full flex items-center justify-center font-black ${className}`}
      style={{
        width: size, height: size,
        fontSize: Math.round(size * 0.42),
        background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
        boxShadow: '0 0 12px rgba(124,58,237,0.5)',
      }}>
      {(firstName[0] ?? '?').toUpperCase()}
    </div>
  )
}
