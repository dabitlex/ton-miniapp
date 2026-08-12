// src/components/ui/Icon.tsx
// Linien-Icon-Set fuer das Redesign 2.0.
// Ein einziger Satz, damit alle Screens dieselbe Strichstaerke und 
// Rundung teilen — ersetzt die bisher gemischten Emojis und lucide-Icons.
'use client'

export type IconName =
  | 'home' | 'quest' | 'rank' | 'clan' | 'user'
  | 'flame' | 'bolt' | 'lock' | 'swords' | 'target' | 'check'
  | 'tv' | 'crown' | 'chat' | 'trophy' | 'clock' | 'wallet'
  | 'users' | 'gear' | 'chevronRight' | 'chevronLeft' | 'ticket'
  | 'gem' | 'box' | 'search' | 'info' | 'send' | 'close' | 'plus'

const P: Record<IconName, React.ReactNode> = {
  home:   <path d="M3 10.2 12 3.2l9 7v10.6H3z" />,
  quest:  <><path d="M9 11.5l2.5 2.5L21 4.5" /><path d="M20.5 12v7.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h10" /></>,
  rank:   <path d="M8.5 21h7M12 17.5V21M17 3.5H7v5a5 5 0 0 0 10 0zM17 4.5h3a2 2 0 0 1-2 4M7 4.5H4a2 2 0 0 0 2 4" />,
  clan:   <path d="M12 3.2l7.5 2.8v5.6c0 4.7-3.3 7.5-7.5 8.4-4.2-.9-7.5-3.7-7.5-8.4V6z" />,
  user:   <><circle cx="12" cy="8.2" r="3.7" /><path d="M4.6 20.6c1.4-3.7 4.7-5.6 7.4-5.6s6 1.9 7.4 5.6" /></>,
  flame:  <><path d="M12 3s4.5 4 4.5 8.2A4.5 4.5 0 0 1 12 15.7a4.5 4.5 0 0 1-4.5-4.5C7.5 7 12 3 12 3z" /><path d="M12 21a6 6 0 0 0 6-6c0-1-.3-2-.8-2.8A6 6 0 0 1 12 21a6 6 0 0 1-5.2-8.8C6.3 13 6 14 6 15a6 6 0 0 0 6 6z" /></>,
  bolt:   <path d="M13.5 2.5 4.8 13.4h6l-.3 8.1 8.7-10.9h-6z" />,
  lock:   <><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" /></>,
  swords: <path d="M14.5 14.5 20.5 20.5M17.5 17.5 15 20l-1.5-1.5M20.5 3.5 12 12l-2 2-2-2 2-2 8.5-8.5zM3.5 3.5 12 12M6.5 17.5 9 20l1.5-1.5M9.5 14.5 3.5 20.5" />,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></>,
  check:  <path d="M5 12.5 10 17.5 19.5 7" />,
  tv:     <><rect x="3" y="6.5" width="18" height="12" rx="2.5" /><path d="M8.5 3.5 12 6.5l3.5-3" /></>,
  crown:  <path d="M3.5 7.5l3.5 3 5-5.5 5 5.5 3.5-3-1.5 11h-14z" />,
  chat:   <path d="M20.5 12.5c0 4-3.8 7-8.5 7-1 0-2-.2-2.9-.4L4 21l1.3-3.5C4.1 16.2 3.5 14.4 3.5 12.5c0-4 3.8-7 8.5-7s8.5 3 8.5 7z" />,
  trophy: <path d="M8.5 20.5h7M12 16.5v4M17 4H7v5a5 5 0 0 0 10 0zM17 5h3a2 2 0 0 1-2 4M7 5H4a2 2 0 0 0 2 4" />,
  clock:  <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  wallet: <><path d="M3.5 8.5A2.5 2.5 0 0 1 6 6h11.5a2 2 0 0 1 2 2v9a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5z" /><path d="M16.5 12.5H20v3h-3.5a1.5 1.5 0 0 1 0-3z" /></>,
  users:  <><circle cx="9" cy="8.5" r="3.3" /><path d="M2.8 20c1.2-3.2 3.7-4.8 6.2-4.8s5 1.6 6.2 4.8M16.5 6.2a3.3 3.3 0 0 1 0 6.2M18 15.5c2 .7 3.4 2.2 4.2 4.5" /></>,
  gear:   <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.4M12 18.8v2.4M4.5 7.5l2 1.2M17.5 15.3l2 1.2M4.5 16.5l2-1.2M17.5 8.7l2-1.2" /></>,
  chevronRight: <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  chevronLeft:  <path d="M14.5 5.5 8 12l6.5 6.5" />,
  ticket: <><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v2a2 2 0 0 0 0 4v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2 2 0 0 0 0-4z" /><path d="M13 7v10" /></>,
  gem:    <><path d="M6 3.5h12l3.5 5.5L12 20.5 2.5 9z" /><path d="M2.5 9h19M9 3.5 12 20.5 15 3.5" /></>,
  box:    <><path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z" /><path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5 21 21" /></>,
  info:   <><circle cx="12" cy="12" r="8.5" /><path d="M12 16v-4.5M12 8.2h.01" /></>,
  send:   <path d="M21.5 12 3.5 4.5l3 7.5-3 7.5z" />,
  close:  <path d="M6 6l12 12M18 6 6 18" />,
  plus:   <path d="M12 5v14M5 12h14" />,
}

export function Icon({
  name, size = 20, className, style, strokeWidth = 1.6,
}: {
  name: IconName
  size?: number
  className?: string
  style?: React.CSSProperties
  strokeWidth?: number
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden
    >
      {P[name]}
    </svg>
  )
}

/**
 * Icon in einer Glas- oder Akzent-Kachel — das wiederkehrende Muster
 * in Listen, Karten und der Navigation.
 */
export function IconTile({
  name, size = 44, active = false, tone, iconSize, style,
}: {
  name: IconName
  size?: number
  active?: boolean
  /** Faerbt nur das Icon (z.B. Gold fuer Belohnungen) */
  tone?: string
  iconSize?: number
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: Math.round(size * 0.32),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        color: active ? '#fff' : (tone ?? 'rgba(255,255,255,0.92)'),
        background: active
          ? 'linear-gradient(140deg,#7BA5FF,#1D4ED8)'
          : 'linear-gradient(150deg,rgba(255,255,255,0.20),rgba(255,255,255,0.05))',
        boxShadow: active
          ? 'inset 0 1px 0 rgba(255,255,255,0.40), 0 8px 20px rgba(37,99,255,0.45)'
          : 'inset 0 1px 0 rgba(255,255,255,0.30), inset 0 0 0 0.5px rgba(255,255,255,0.10)',
        ...style,
      }}
    >
      <Icon name={name} size={iconSize ?? Math.round(size * 0.43)} />
    </div>
  )
}
