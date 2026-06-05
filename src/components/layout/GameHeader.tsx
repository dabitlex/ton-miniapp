// src/components/layout/GameHeader.tsx — Fullscreen (zentrierter Titel)
'use client'
import { useState } from 'react'

/**
 * Fullscreen-Header: nur der zentrierte VEXALGO-Schriftzug. Sitzt im Band der
 * schwebenden Telegram-Buttons (✕ links, Menü rechts), damit es wie eine
 * native Titelleiste wirkt. Level / Season XP / Profil stehen im Inhalt darunter
 * bzw. im "You"-Tab.
 *
 * Vertikale Position:
 *   paddingTop = --tg-safe-area-top  (unter der Geräte-Statusleiste)
 *   Höhe       = --tg-content-top    (Band der Telegram-Buttons; Titel zentriert)
 */
export function GameHeader() {
  return (
    <header
      className="shrink-0 relative z-20"
      style={{ paddingTop: 'var(--tg-safe-area-top, 0px)' }}
    >
      <div
        className="flex items-center justify-center"
        style={{ height: 'var(--tg-content-top, 48px)' }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: 'var(--violet-bright)', boxShadow: '0 0 8px var(--violet-bright)' }}
          />
          <span className="display text-[16px] tracking-[0.08em] text-white/95">
            VEX<span className="gradient-text">ALGO</span>
          </span>
        </div>
      </div>
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
