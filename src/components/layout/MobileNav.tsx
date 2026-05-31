// src/components/layout/MobileNav.tsx
'use client'
import Link            from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Swords, Trophy, User, Sparkles, Shield } from 'lucide-react'

const NAV = [
  { href: '/home',        icon: Home,     label: 'Home'   },
  { href: '/quests',      icon: Swords,   label: 'Quests' },
  { href: '/leaderboard', icon: Trophy,   label: 'Ranks'  },
  { href: '/clans',       icon: Shield,   label: 'Clans'  },
  { href: '/ecosystem',   icon: Sparkles, label: 'Boost'  },
  { href: '/profile',     icon: User,     label: 'Profile'},
] as const

export function MobileNav() {
  const path = usePathname()

  return (
    <nav className="shrink-0 relative z-20 safe-bottom"
      style={{
        background: 'rgba(6,6,16,0.97)',
        backdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>

      {/* Top glow line */}
      <div className="absolute top-0 left-1/4 right-1/4 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)' }} />

      <div className="flex items-center justify-around h-16 px-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = path.startsWith(href)
          return (
            <Link key={href} href={href}
              className="flex flex-col items-center justify-center gap-1 w-12 h-12
                         rounded-xl transition-all duration-200 active:scale-90"
              style={{
                background: active ? 'rgba(124,58,237,0.12)' : 'transparent',
              }}>
              <div className="relative">
                <Icon
                  size={18}
                  strokeWidth={active ? 2.5 : 1.8}
                  style={{
                    color: active ? '#A855F7' : 'rgba(255,255,255,0.28)',
                    filter: active ? 'drop-shadow(0 0 6px rgba(168,85,247,0.7))' : 'none',
                  }}
                />
                {/* Active dot */}
                {active && (
                  <span className="nav-active-dot absolute -bottom-1 left-1/2 -translate-x-1/2
                                   w-1 h-1 rounded-full"
                    style={{ background: '#A855F7',
                      boxShadow: '0 0 6px rgba(168,85,247,0.8)' }} />
                )}
              </div>
              <span className="text-[9px] font-semibold tracking-wide transition-colors"
                style={{ color: active ? 'rgba(168,85,247,0.9)' : 'rgba(255,255,255,0.22)' }}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
