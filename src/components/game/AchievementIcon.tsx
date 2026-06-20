// src/components/game/AchievementIcon.tsx
// VEXALGO — Achievement-Icons (Aurora-Stil)
//
// Verwendung:
//   <AchievementIcon code="streak_7" unlocked />        // farbig (abgeschlossen)
//   <AchievementIcon code="streak_7" />                  // ausgegraut (in Arbeit, Standard)
//   <AchievementIcon code="ref_5" unlocked size={64} />  // eigene Größe
//
// Standard: AUSGEGRAUT. Erst wenn `unlocked` true ist, wird das Icon farbig.
'use client'

import type { CSSProperties } from 'react'

/** Kategorie-Farbpaletten (Aurora). [hell, dunkel] für den Badge-Verlauf. */
const PALETTES = {
  violet: ['#A78BFA', '#6D28D9'],
  cyan:   ['#67E8F9', '#0891B2'],
  gold:   ['#FDE68A', '#D97706'],
  em:     ['#6EE7B7', '#059669'],
  rose:   ['#FDA4AF', '#E11D48'],
  blue:   ['#93C5FD', '#2563EB'],
} as const

type PaletteKey = keyof typeof PALETTES

/** Inneres SVG-Pfad-Markup je Icon (auf 24×24 viewBox gezeichnet). */
const PATHS: Record<string, string> = {
  // 🔥 Streak (Feuer)
  flame:        '<path d="M12 2c0 5-5 6-5 11a5 5 0 0010 0c0-3-1.5-4.5-1.5-4.5C16 12 13 12 13 9c0-2.5-1-5-1-7z"/>',
  // 🤝 Community (Personen)
  users:        '<circle cx="9" cy="7" r="3.2"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5z"/><circle cx="17" cy="9" r="2.4"/><path d="M15 14.5c2.5 0 5 1.5 5 4.5h-4"/>',
  usersCrown:   '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5z"/><circle cx="17" cy="10" r="2.4"/><path d="M15 15.5c2.5 0 5 1.5 5 4.5h-4"/><path d="M6 3l1.5 2L9 3l1.5 2L12 3v3H6z"/>',
  // ⭐ Progression
  rocket:       '<path d="M12 2c3 1.5 5 5 5 9l-2.5 2.5h-5L7 11c0-4 2-7.5 5-9z"/><circle cx="12" cy="9" r="1.6" fill="rgba(0,0,0,0.35)"/><path d="M9 16l-2 4 3.5-1.5M15 16l2 4-3.5-1.5"/>',
  rankStar:     '<path d="M12 2l3 6 6.5.5-5 4.5L18 20l-6-3.5L6 20l1.5-7L2.5 8.5 9 8z"/>',
  diamondRank:  '<path d="M6 3h12l3 5-9 13L3 8z"/><path d="M3 8h18M9 3l3 18M15 3l-3 18" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>',
  // 🎯 Quests (Schriftrolle)
  scroll:       '<path d="M5 3h11l3 3v15H5z"/><path d="M9 9h7M9 13h7M9 17h4" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1.5" stroke-linecap="round"/>',
  scrollCheck:  '<path d="M5 3h11l3 3v15H5z"/><path d="M8.5 12l2 2 4-4" fill="none" stroke="rgba(0,0,0,0.4)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  scrollGold:   '<path d="M5 3h11l3 3v15H5z"/><path d="M9 8h7M9 12h7M9 16h5" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1.5" stroke-linecap="round"/><circle cx="17" cy="18" r="3"/>',
  // 📺 Ads
  play:         '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M10 9l5 3-5 3z" fill="rgba(0,0,0,0.4)"/>',
  monitor:      '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M10 8l5 2.5-5 2.5z" fill="rgba(0,0,0,0.4)"/><path d="M8 21h8M12 17v4"/>',
  multiScreen:  '<rect x="4" y="3" width="16" height="11" rx="2"/><path d="M10 6l5 2.5-5 2.5z" fill="rgba(0,0,0,0.4)"/><rect x="2" y="16" width="8" height="5" rx="1.2"/><rect x="14" y="16" width="8" height="5" rx="1.2"/>',
  // 🛡️ Clan
  shield:       '<path d="M12 2l8 3.5v5.5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5.5z"/>',
  shieldCheck:  '<path d="M12 2l8 3.5v5.5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5.5z"/><path d="M8.5 11.5l2.5 2.5 4.5-4.5" fill="none" stroke="rgba(0,0,0,0.4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  shieldSwords: '<path d="M12 2l8 3.5v5.5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5.5z"/><path d="M9 9l6 6M15 9l-6 6" fill="none" stroke="rgba(0,0,0,0.4)" stroke-width="1.6" stroke-linecap="round"/>',
  // 🎁 Mystery Box
  gift:         '<rect x="3" y="8" width="18" height="13" rx="1.5"/><path d="M3 12h18M12 8v13" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1.4"/><path d="M12 8S9 3 6.5 4.5 9 8 12 8zM12 8s3-5 5.5-3.5S15 8 12 8z"/>',
  chest:        '<path d="M4 9a8 8 0 0116 0v10H4z"/><path d="M4 13h16" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1.4"/><rect x="10.5" y="11" width="3" height="4" rx="1" fill="rgba(0,0,0,0.4)"/>',
  clover:       '<path d="M12 12c-1-3-5-3-5 0s4 2 5 0zm0 0c1-3 5-3 5 0s-4 2-5 0zm0 0c-3-1-3-5 0-5s2 4 0 5zm0 0c3 1 3 5 0 5s-2-4 0-5z"/><path d="M12 12v8" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="1.4"/>',
  // 💎 Support / Prestige
  diamond:      '<path d="M6 3h12l3 5-9 13L3 8z"/><path d="M3 8h18M9 3l3 5 3-5M3 8l9 13 9-13" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>',
  crown:        '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/><circle cx="3" cy="8" r="1.4"/><circle cx="21" cy="8" r="1.4"/><circle cx="12" cy="4" r="1.4"/>',
  wallet:       '<rect x="3" y="6" width="18" height="13" rx="2.5"/><circle cx="16.5" cy="12.5" r="1.6" fill="rgba(0,0,0,0.4)"/>',
}

/** Achievement-Code → { icon, palette }. Erweiterbar, sobald die finale Liste steht. */
const REGISTRY: Record<string, { icon: keyof typeof PATHS; palette: PaletteKey }> = {
  // 🔥 Streak (Werte 1:1 aus bestehenden Streak-Milestones)
  streak_3:   { icon: 'flame', palette: 'em'     },
  streak_7:   { icon: 'flame', palette: 'em'     },
  streak_14:  { icon: 'flame', palette: 'violet' },
  streak_30:  { icon: 'flame', palette: 'violet' },
  streak_60:  { icon: 'flame', palette: 'rose'   },
  streak_100: { icon: 'flame', palette: 'gold'   },
  // 🤝 Community (Werte 1:1 aus bestehenden Referral-Milestones)
  ref_5:   { icon: 'users',      palette: 'violet' },
  ref_10:  { icon: 'users',      palette: 'violet' },
  ref_25:  { icon: 'users',      palette: 'violet' },
  ref_50:  { icon: 'usersCrown', palette: 'gold'   },
  // ⭐ Progression
  lvl_5:   { icon: 'rocket',      palette: 'blue' },
  lvl_25:  { icon: 'rankStar',    palette: 'blue' },
  lvl_50:  { icon: 'diamondRank', palette: 'blue' },
  // 🎯 Quests
  quest_50:   { icon: 'scroll',      palette: 'em' },
  quest_250:  { icon: 'scrollCheck', palette: 'em' },
  quest_1000: { icon: 'scrollGold',  palette: 'gold' },
  // 📺 Ads
  ads_100:  { icon: 'play',        palette: 'cyan' },
  ads_500:  { icon: 'monitor',     palette: 'cyan' },
  ads_1000: { icon: 'multiScreen', palette: 'cyan' },
  // 🛡️ Clan
  clan_join:    { icon: 'shield',       palette: 'gold' },
  clan_mis_25:  { icon: 'shieldCheck',  palette: 'gold' },
  clan_mis_100: { icon: 'shieldSwords', palette: 'gold' },
  // 🎁 Mystery Box
  box_30:    { icon: 'gift',   palette: 'rose' },
  box_100:   { icon: 'chest',  palette: 'rose' },
  box_lucky: { icon: 'clover', palette: 'rose' },
  // 💎 Support / Prestige
  boost_first:    { icon: 'diamond', palette: 'gold' },
  wallet_connect: { icon: 'wallet',  palette: 'em'   },
  season_top10:   { icon: 'crown',   palette: 'gold' },
}

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
  const entry = REGISTRY[code]

  // Unbekannter Code → neutraler Platzhalter, statt zu crashen.
  if (!entry) {
    return (
      <div
        className={className}
        style={{
          width: size, height: size, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
          ...style,
        }}
        aria-label={`Achievement ${code}`}
      />
    )
  }

  const [c1, c2] = PALETTES[entry.palette]
  const iconSize = Math.round(size * 0.55)

  const badgeStyle: CSSProperties = unlocked
    ? {
        background: `radial-gradient(circle at 50% 30%, ${c1}, ${c2})`,
        boxShadow: `0 4px 14px ${c1}73, inset 0 2px 6px rgba(255,255,255,0.4), inset 0 -3px 8px rgba(0,0,0,0.3)`,
      }
    : {
        // Ausgegraut: entsättigt + abgedunkelt
        background: 'radial-gradient(circle at 50% 30%, #4A4A58, #2A2A36)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -2px 6px rgba(0,0,0,0.35)',
        filter: 'grayscale(0.3)',
      }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...badgeStyle,
        ...style,
      }}
      aria-label={`Achievement ${code}`}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        style={{ fill: unlocked ? '#fff' : 'rgba(255,255,255,0.55)' }}
        dangerouslySetInnerHTML={{ __html: PATHS[entry.icon] }}
      />
    </div>
  )
}

export default AchievementIcon
