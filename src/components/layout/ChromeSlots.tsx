// src/components/layout/ChromeSlots.tsx
// Kopfzeile und Navigation, die sich selbst ausblenden koennen.
//
// WARUM ZWEI KOMPONENTEN statt einer Huelle:
// Das umgebende Layout ist eine Server-Komponente. Next.js erlaubt es
// nicht, Funktionen (also Render-Props) an Client-Komponenten zu
// uebergeben — der Build bricht beim Erzeugen der statischen Seiten ab.
// Deshalb rendern diese beiden Komponenten ihren Inhalt selbst und
// lesen den Schalter direkt aus dem Store.
'use client'
import { useUIStore } from '@/stores/useUIStore'
import { GameHeader } from '@/components/layout/GameHeader'
import { MobileNav }  from '@/components/layout/MobileNav'

export function HeaderSlot() {
  const sichtbar = useUIStore(s => s.isNavVisible)
  return sichtbar ? <GameHeader /> : null
}

export function NavSlot() {
  const sichtbar = useUIStore(s => s.isNavVisible)
  return sichtbar ? <MobileNav /> : null
}
