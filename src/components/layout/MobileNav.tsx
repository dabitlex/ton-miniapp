// src/components/layout/MobileNav.tsx — Redesigned (Aurora OS · floating bar) 
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
  { href: '/profile',     icon: User,     label: 'You'    },
] as const

export function MobileNav() {
  const path = usePathname()

  return (
    <nav className="shrink-0 relative z-20 px-3 pt-2"
      style={{
        paddingBottom: 'calc(0.5rem + var(--tg-safe-bottom, 0px))',
        background: 'linear-gradient(0deg, rgba(8,8,14,0.96) 30%, rgba(8,8,14,0.6) 100%)',
        backdropFilter: 'blur(26px)',
        WebkitBackdropFilter: 'blur(26px)',
      }}>

      <div className="flex items-center justify-between rounded-[20px] px-2 py-2"
        style={{
          background: 'var(--surface-2)',
          boxShadow: 'inset 0 1px 0 var(--edge-light), 0 12px 32px rgba(0,0,0,0.5)',
        }}>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = path.startsWith(href)
          return (
            <Link key={href} href={href}
              className="relative flex flex-col items-center justify-center gap-1 flex-1 h-[46px] rounded-2xl press">

              {/* Active pill background */}
              {active && (
                <span className="absolute inset-x-1 inset-y-0 rounded-2xl nav-pill"
                  style={{
                    background: 'linear-gradient(160deg, rgba(139,92,246,0.22), rgba(91,141,239,0.10))',
                    boxShadow: 'inset 0 1px 0 rgba(167,139,250,0.3)',
                  }} />
              )}

              <span className="relative z-10">
                <Icon
                  size={19}
                  strokeWidth={active ? 2.4 : 1.9}
                  style={{
                    color: active ? '#C4B5FD' : 'rgba(255,255,255,0.34)',
                    filter: active ? 'drop-shadow(0 0 7px rgba(167,139,250,0.65))' : 'none',
                    transition: 'all 0.25s var(--spring)',
                  }}
                />
              </span>
              <span className="relative z-10 text-[9px] font-bold tracking-wide"
                style={{
                  color: active ? 'rgba(196,181,253,0.95)' : 'rgba(255,255,255,0.26)',
                  fontFamily: 'var(--font-display)',
                }}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
