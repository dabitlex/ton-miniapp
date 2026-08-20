// src/components/arcade/GameCovers.tsx
// Cover der Spiele als SVG statt als Bilddatei: auf jedem Bildschirm
// scharf, unter einem Kilobyte, und die Motive stammen direkt aus den
// Spielen — dadurch erkennt man wieder, was einen erwartet.
'use client'

export type GameKey = 'xp_rush' | 'defender'

/** XP Rush — fallende Kugeln und eine Niete */
function XpRushCover() {
  return (
    <svg viewBox="0 0 200 236" preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <linearGradient id="xr-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#101A2E" /><stop offset="100%" stopColor="#050A16" />
        </linearGradient>
        <radialGradient id="xr-glow" cx="50%" cy="18%" r="70%">
          <stop offset="0%" stopColor="#2563FF" stopOpacity=".55" />
          <stop offset="100%" stopColor="#2563FF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="xr-orb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#BFD4FF" /><stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="xr-dud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFC9D4" /><stop offset="100%" stopColor="#9F1239" />
        </linearGradient>
      </defs>
      <rect width="200" height="236" fill="url(#xr-bg)" />
      <rect width="200" height="236" fill="url(#xr-glow)" />
      <g opacity=".22" stroke="#8FB4FF" strokeWidth="1">
        <path d="M40 0v236M100 0v236M160 0v236" />
      </g>
      <circle cx="52" cy="52" r="21" fill="url(#xr-orb)" />
      <text x="52" y="58" fontFamily="Poppins, sans-serif" fontSize="13" fontWeight="600"
        fill="#fff" textAnchor="middle">+10</text>
      <circle cx="140" cy="104" r="24" fill="url(#xr-orb)" />
      <text x="140" y="111" fontFamily="Poppins, sans-serif" fontSize="14" fontWeight="600"
        fill="#fff" textAnchor="middle">+10</text>
      <circle cx="66" cy="152" r="17" fill="url(#xr-orb)" opacity=".85" />
      <rect x="112" y="168" width="40" height="40" rx="12" fill="url(#xr-dud)" />
      <path d="M124 180l16 16M140 180l-16 16" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** Vex Defender — Drohnenformation, Schiff und Schuss */
function DefenderCover() {
  return (
    <svg viewBox="0 0 200 236" preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <linearGradient id="vd-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0B1226" /><stop offset="100%" stopColor="#04070F" />
        </linearGradient>
        <radialGradient id="vd-glow" cx="70%" cy="22%" r="80%">
          <stop offset="0%" stopColor="#6D28D9" stopOpacity=".45" />
          <stop offset="100%" stopColor="#6D28D9" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="vd-ship" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DCE8FF" /><stop offset="55%" stopColor="#7BA5FF" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="vd-hex" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFC9D4" /><stop offset="100%" stopColor="#9F1239" />
        </linearGradient>
        <linearGradient id="vd-hex2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DDD6FE" /><stop offset="100%" stopColor="#5B21B6" />
        </linearGradient>
      </defs>
      <rect width="200" height="236" fill="url(#vd-bg)" />
      <rect width="200" height="236" fill="url(#vd-glow)" />
      <g fill="#fff">
        <circle cx="24" cy="30" r="1.3" opacity=".7" /><circle cx="168" cy="46" r="1.6" opacity=".8" />
        <circle cx="60" cy="12" r="1" opacity=".5" /><circle cx="118" cy="70" r="1.2" opacity=".6" />
        <circle cx="36" cy="118" r="1.4" opacity=".65" /><circle cx="180" cy="140" r="1.1" opacity=".5" />
        <circle cx="88" cy="196" r="1.3" opacity=".6" />
      </g>
      <g>
        <polygon points="52,34 63,40 63,53 52,59 41,53 41,40" fill="url(#vd-hex2)" />
        <polygon points="100,28 111,34 111,47 100,53 89,47 89,34" fill="url(#vd-hex)" />
        <polygon points="148,34 159,40 159,53 148,59 137,53 137,40" fill="url(#vd-hex2)" />
        <polygon points="76,74 87,80 87,93 76,99 65,93 65,80" fill="url(#vd-hex)" />
        <polygon points="124,74 135,80 135,93 124,99 113,93 113,80" fill="url(#vd-hex)" />
      </g>
      <g stroke="#EAF1FF" strokeWidth="3" strokeLinecap="round">
        <path d="M100 150v-22" opacity=".95" />
        <path d="M100 118v-10" opacity=".45" />
      </g>
      <polygon points="100,166 114,196 100,190 86,196" fill="url(#vd-ship)" />
      <path d="M94 198h12l-6 14z" fill="#BFD4FF" opacity=".75" />
    </svg>
  )
}

export function GameCover({ game }: { game: GameKey }) {
  return game === 'defender' ? <DefenderCover /> : <XpRushCover />
}

/** Anzeigename und Pfad je Spiel — eine Stelle für beides */
export const GAME_META: Record<GameKey, { title: string; href: string }> = {
  xp_rush:  { title: 'XP Rush',      href: '/arcade/xp-rush'  },
  defender: { title: 'Vex Defender', href: '/arcade/defender' },
}
