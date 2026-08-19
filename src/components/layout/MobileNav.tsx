// src/components/layout/MobileNav.tsx — VEXALGO 2.0 
// Aktives Ziel: groessere, gefuellte Kachel, die aus der Leiste herausragt. 
// Inaktive Ziele: duenne Linien-Icons ohne Beschriftung.
'use client'
import Link            from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type IconName } from '@/components/ui/Icon'
import { useT, type DictKey } from '@/lib/i18n'

const NAV: { href: string; icon: IconName; label: DictKey }[] = [
  { href: '/home',        icon: 'home',   label: 'nav.home'    },
  { href: '/quests',      icon: 'quest',  label: 'nav.quests'  },
  { href: '/leaderboard', icon: 'rank',   label: 'nav.ranks'   },
  { href: '/clans',       icon: 'clan',   label: 'nav.clans'   },
  { href: '/profile',     icon: 'user',   label: 'nav.profile' },
]

export function MobileNav() {
  const path = usePathname()
  const t = useT()

  return (
    <nav
      className="shrink-0 relative z-20"
      style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'flex-start',
        height: 84,
        paddingTop: 12,
        paddingBottom: 'var(--tg-safe-bottom, 0px)',
        background: 'linear-gradient(180deg, rgba(10,15,26,0.72), rgba(8,13,24,0.96))',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.10)',
      }}
    >
      {NAV.map(({ href, icon, label }) => {
        const active = path.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-label={t(label)}
            aria-current={active ? 'page' : undefined}
            className="press"
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: active ? 56 : 46,
              height: active ? 56 : 46,
              marginTop: active ? -12 : 0,
              borderRadius: active ? 18 : 14,
              color: active ? '#fff' : 'rgba(255,255,255,0.38)',
              background: active
                ? 'linear-gradient(140deg,#7BA5FF 0%,#2563FF 48%,#1035A8 100%)'
                : 'transparent',
              boxShadow: active
                ? '0 12px 28px rgba(37,99,255,0.55), 0 0 0 5px rgba(37,99,255,0.10), inset 0 1.5px 0 rgba(255,255,255,0.45)'
                : 'none',
              transition: 'width .22s var(--spring), height .22s var(--spring), margin-top .22s var(--spring)',
            }}
          >
            <Icon
              name={icon}
              size={active ? 27 : 22}
              strokeWidth={active ? 1.7 : 1.6}
              style={active ? { fill: 'rgba(255,255,255,0.28)' } : undefined}
            />
            {active && (
              <span
                aria-hidden
                style={{
                  position: 'absolute', left: '50%', bottom: -13,
                  transform: 'translateX(-50%)',
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#7BA5FF',
                  boxShadow: '0 0 10px rgba(123,165,255,0.9)',
                }}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
