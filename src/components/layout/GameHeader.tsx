// src/components/layout/GameHeader.tsx — Redesigned (Aurora OS)
'use client'
import Link             from 'next/link'
import { useState }     from 'react'
import { useUserStore } from '@/stores/useUserStore'

export function GameHeader() {
  const profile = useUserStore(s => s.profile)

  return (
    <header className="shrink-0 relative z-20 flex items-center justify-between px-4 h-[56px]"
      style={{
        background: 'linear-gradient(180deg, rgba(8,8,14,0.92) 0%, rgba(8,8,14,0.62) 100%)',
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
      }}>

      {/* Left: Level + Season XP cluster */}
      <div className="flex items-center gap-2.5">
        <Link href="/profile" className="press">
          <div className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full"
            style={{ background: 'var(--surface-2)', boxShadow: 'inset 0 1px 0 var(--edge-light)' }}>
            <span className="flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-extrabold text-white"
              style={{
                fontFamily: 'var(--font-display)',
                background: 'var(--aurora)',
                boxShadow: '0 2px 10px rgba(139,92,246,0.5)',
              }}>
              {profile?.level ?? '—'}
            </span>
            <span className="text-[12px] font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {profile ? profile.seasonXp.toLocaleString() : '—'}
              <span className="text-[10px] font-semibold ml-1" style={{ color: 'var(--text-faint)' }}>XP</span>
            </span>
          </div>
        </Link>
      </div>

      {/* Center: Wordmark */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--violet-bright)', boxShadow: '0 0 8px var(--violet-bright)' }} />
        <span className="display text-[15px] tracking-[0.08em] text-white/95">
          VEX<span className="gradient-text">ALGO</span>
        </span>
      </div>

      {/* Right: Avatar */}
      <Link href="/profile" className="press">
        <div className="rounded-full p-[2px]" style={{ background: 'var(--aurora)' }}>
          <div className="rounded-full p-[1.5px]" style={{ background: 'var(--bg-void)' }}>
            <TelegramAvatar
              photoUrl={profile?.telegramPhotoUrl ?? null}
              firstName={profile?.telegramFirstName ?? '?'}
              size={30}
            />
          </div>
        </div>
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
        style={{ width: size, height: size }} />
    )
  }

  return (
    <div className={`rounded-full flex items-center justify-center font-extrabold text-white ${className}`}
      style={{
        width: size, height: size,
        fontSize: Math.round(size * 0.42),
        fontFamily: 'var(--font-display)',
        background: 'var(--aurora)',
      }}>
      {(firstName[0] ?? '?').toUpperCase()}
    </div>
  )
}
