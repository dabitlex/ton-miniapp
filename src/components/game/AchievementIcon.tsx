// src/components/game/AchievementIcon.tsx
// VEXALGO — Achievement-Icons (runde PNG-Medaillons, Aurora-Stil)
//
// Verwendung (unverändert zur SVG-Version):
//   <AchievementIcon code="streak_7" unlocked />        // farbig (abgeschlossen)
//   <AchievementIcon code="streak_7" />                  // ausgegraut (in Arbeit, Standard)
//   <AchievementIcon code="ref_5" unlocked size={64} />  // eigene Größe
//
// Jedes Icon ist ein fertiges rundes Badge-PNG unter /public/achievements/<code>.png.
// Das PNG bringt Rahmen + Glow selbst mit — kein zusätzlicher Badge-Wrapper nötig.
// Standard: AUSGEGRAUT. Erst wenn `unlocked` true ist, wird das Icon farbig.
'use client'

import type { CSSProperties } from 'react'

/** Alle bekannten Achievement-Codes (= vorhandene PNG-Dateien in /public/achievements). */
const KNOWN_CODES = new Set<string>([
  'streak_3', 'streak_7', 'streak_14', 'streak_30', 'streak_60', 'streak_100',
  'ref_5', 'ref_10', 'ref_25', 'ref_50',
  'lvl_5', 'lvl_25', 'lvl_50',
  'quest_50', 'quest_250', 'quest_1000',
  'ads_100', 'ads_500', 'ads_1000',
  'clan_join', 'clan_mis_25', 'clan_mis_100',
  'box_30', 'box_100', 'box_lucky',
  'boost_first', 'wallet_connect', 'season_top10',
])

interface AchievementIconProps {
  /** Achievement-Code, z.B. "streak_7". */
  code: string
  /** Abgeschlossen? true = farbig, false/undefined = ausgegraut (Standard). */
  unlocked?: boolean
  /** Pixelgröße des Badges. Default 58. */
  size?: number
  className?: string
  style?: CSSProperties
}

export function AchievementIcon({
  code,
  unlocked = false,
  size = 58,
  className,
  style,
}: AchievementIconProps) {
  // Unbekannter Code → neutraler Platzhalter, statt eine fehlende Datei anzufragen.
  if (!KNOWN_CODES.has(code)) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
          ...style,
        }}
        aria-label={`Achievement ${code}`}
      />
    )
  }

  // Locked: entsättigt + abgedunkelt (rein per CSS, keine zweite Grafik nötig).
  // Unlocked: leichter Schlagschatten, damit das Medaillon auf dem Tile „aufliegt".
  const stateStyle: CSSProperties = unlocked
    ? { filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.35))' }
    : { filter: 'grayscale(1) brightness(0.55)', opacity: 0.45 }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/achievements/${code}.png`}
      width={size}
      height={size}
      draggable={false}
      alt={`Achievement ${code}`}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block',
        userSelect: 'none',
        ...stateStyle,
        ...style,
      }}
    />
  )
}

export default AchievementIcon
