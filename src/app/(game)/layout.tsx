// src/app/(game)/layout.tsx
import { AuthProvider }    from '@/components/providers/AuthProvider'
import { TonProvider }     from '@/components/providers/TonProvider'
import { QueryProvider }   from '@/components/providers/QueryProvider'
import { GameHeader }      from '@/components/layout/GameHeader'
import { EnergyStrip }     from '@/components/layout/EnergyStrip'
import { MobileNav }       from '@/components/layout/MobileNav'
import { EnergyTicker }    from '@/components/layout/EnergyTicker'

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryProvider>
        <TonProvider>
          <EnergyTicker />
          <div className="flex flex-col h-dvh overflow-hidden" style={{ background: 'var(--bg-void)' }}>
            <GameHeader />
            <EnergyStrip />
            <main className="flex-1 overflow-y-auto overscroll-contain relative z-10
                             [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
              {children}
            </main>
            <MobileNav />
          </div>
        </TonProvider>
      </QueryProvider>
    </AuthProvider>
  )
}
