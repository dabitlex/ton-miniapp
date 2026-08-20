// src/app/(game)/layout.tsx  
import { AuthProvider }     from '@/components/providers/AuthProvider'
import { I18nGate }         from '@/components/providers/I18nGate'
import { TonProvider }      from '@/components/providers/TonProvider'
import { QueryProvider }    from '@/components/providers/QueryProvider'
import { AuroraBackground } from '@/components/layout/AuroraBackground'
import { HeaderSlot, NavSlot } from '@/components/layout/ChromeSlots'
import { EnergyTicker }     from '@/components/layout/EnergyTicker'
import { MysteryBoxModal }  from '@/components/game/MysteryBoxModal'
import { QuestRewardPopup } from '@/components/game/QuestRewardPopup'
import { MysteryBoxSideButton } from '@/components/game/MysteryBoxSideButton'
import { AchievementPopup } from '@/components/game/AchievementPopup'
import { MaintenanceGate }  from '@/components/layout/MaintenanceGate'
import { WarResultModal }   from '@/components/war/WarResultModal'
import { SeasonKickoffModal } from '@/components/game/SeasonKickoffModal'
import { VaultWinModal }    from '@/components/game/VaultWinModal'
import { PlatformGate }     from '@/components/providers/PlatformGate'

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryProvider>
        <TonProvider>
          <I18nGate>
          <PlatformGate>
            <MaintenanceGate>
              <EnergyTicker />
              {/* Animierter Aurora-Hintergrund hinter allem (fixed, z-0) */}
              <AuroraBackground />
              {/* Container transparent, damit der Hintergrund durchscheint */}
              <div className="flex flex-col h-dvh overflow-hidden relative z-10">
                <HeaderSlot />
                <main className="flex-1 overflow-y-auto overscroll-contain relative z-10
                                 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
                  {children}
                </main>
                <NavSlot />
              </div>
              <MysteryBoxModal />
              <QuestRewardPopup />
              <VaultWinModal />
              <MysteryBoxSideButton />
              <AchievementPopup />
              {/* Clan-Wars-Ergebnis (So-Auswertung) + Season-Auftakt (einmalig) */}
              <WarResultModal />
              <SeasonKickoffModal />
            </MaintenanceGate>
          </PlatformGate>
          </I18nGate>
        </TonProvider>
      </QueryProvider>
    </AuthProvider>
  )
}
