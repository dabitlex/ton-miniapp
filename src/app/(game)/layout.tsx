// src/app/(game)/layout.tsx
import { AuthProvider }     from '@/components/providers/AuthProvider'
import { TonProvider }      from '@/components/providers/TonProvider'
import { QueryProvider }    from '@/components/providers/QueryProvider'
import { GameHeader }       from '@/components/layout/GameHeader'
import { AuroraBackground } from '@/components/layout/AuroraBackground'
import { MobileNav }        from '@/components/layout/MobileNav'
import { EnergyTicker }     from '@/components/layout/EnergyTicker'
import { MysteryBoxModal }  from '@/components/game/MysteryBoxModal'
import { QuestRewardPopup } from '@/components/game/QuestRewardPopup'
import { AchievementPopup } from '@/components/game/AchievementPopup'
import { MaintenanceGate }  from '@/components/layout/MaintenanceGate'
import { PlatformGate }     from '@/components/providers/PlatformGate'

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryProvider>
        <TonProvider>
          <PlatformGate>
            <MaintenanceGate>
              <EnergyTicker />
              {/* Animierter Aurora-Hintergrund hinter allem (fixed, z-0) */}
              <AuroraBackground />
              {/* Container transparent, damit der Hintergrund durchscheint */}
              <div className="flex flex-col h-dvh overflow-hidden relative z-10">
                <GameHeader />
                <main className="flex-1 overflow-y-auto overscroll-contain relative z-10
                                 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
                  {children}
                </main>
                <MobileNav />
              </div>
              <MysteryBoxModal />
              <QuestRewardPopup />
              <AchievementPopup />
            </MaintenanceGate>
          </PlatformGate>
        </TonProvider>
      </QueryProvider>
    </AuthProvider>
  )
}
