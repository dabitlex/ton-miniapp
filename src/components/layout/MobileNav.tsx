// src/components/layout/MobileNav.tsx
'use client'
import Link            from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Swords, Trophy, User, Sparkles, Shield } from 'lucide-react'
import { cn }          from '@/lib/utils'

const NAV = [
  { href: '/home',        icon: Home,     label: 'Home'    },
  { href: '/quests',      icon: Swords,   label: 'Quests'  },
  { href: '/leaderboard', icon: Trophy,   label: 'Ranks'   },
  { href: '/clans',       icon: Shield,   label: 'Clans'   },
  { href: '/ecosystem',   icon: Sparkles, label: 'Boost'   },
  { href: '/profile',     icon: User,     label: 'Profile' },
] as const

export function MobileNav() {
  const path = usePathname()
  return (
    <nav className="shrink-0 border-t border-white/[0.05] bg-[#0c0c0f]/95 backdrop-blur-xl
                    pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-[56px] px-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = path.startsWith(href)
          return (
            <Link key={href} href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-[3px] w-12 h-12 rounded-xl',
                'transition-all duration-150 active:scale-90',
                active ? 'text-violet-400' : 'text-white/25'
              )}>
              <div className={cn('p-1 rounded-xl transition-all', active && 'bg-violet-500/15')}>
                <Icon size={17} strokeWidth={active ? 2.5 : 1.8} />
              </div>
              <span className={cn('text-[9px] font-semibold leading-none',
                active ? 'text-violet-300' : 'text-white/20')}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
