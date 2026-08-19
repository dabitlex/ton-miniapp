// src/components/layout/ChromeGate.tsx
// Blendet Kopfzeile und Navigation aus, wenn ein Screen den vollen
// Bildschirm braucht — aktuell XP Rush waehrend einer Runde.
//
// Als Render-Prop gebaut, weil das umgebende Layout serverseitig
// gerendert wird und den Store nicht selbst lesen kann.
'use client'
import { useUIStore } from '@/stores/useUIStore'

export function ChromeGate({ children }: { children: (navVisible: boolean) => React.ReactNode }) {
  const isNavVisible = useUIStore(s => s.isNavVisible)
  return <>{children(isNavVisible)}</>
}
