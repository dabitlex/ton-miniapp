// src/lib/telegram-fullscreen.ts
'use client'

/**
 * Aktiviert den Telegram-Fullscreen-Modus (Bot API 8.0+) und schreibt die
 * Safe-Area-Werte als CSS-Variablen, damit der App-Inhalt nicht unter der
 * Statusleiste oder den schwebenden Telegram-Buttons liegt.
 *
 * Gesetzte Variablen (auf :root):
 *   --tg-safe-area-top   Geräte-Statusleiste / Notch (safeAreaInset.top)
 *   --tg-content-top     Band der Telegram-Buttons (contentSafeAreaInset.top)
 *   --tg-safe-bottom     Unterer Sicherheitsabstand (Home-Indikator etc.)
 *
 * Lauscht auf safeAreaChanged / contentSafeAreaChanged / fullscreenChanged,
 * sodass sich die Werte bei Rotation oder Moduswechsel automatisch anpassen.
 */
export function initTelegramFullscreen(): void {
  const tg = (window as any).Telegram?.WebApp
  if (!tg) return

  const root = document.documentElement

  const applyInsets = () => {
    const sa = tg.safeAreaInset        ?? { top: 0, bottom: 0, left: 0, right: 0 }
    const ca = tg.contentSafeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 }

    const statusTop  = Math.max(sa.top ?? 0, 0)
    // Höhe des Telegram-Button-Bands; Fallback 48px wenn nicht im Fullscreen
    const contentTop = ca.top && ca.top > 0 ? ca.top : 48
    const safeBottom = Math.max((sa.bottom ?? 0) + (ca.bottom ?? 0), 0)

    root.style.setProperty('--tg-safe-area-top', `${statusTop}px`)
    root.style.setProperty('--tg-content-top',   `${contentTop}px`)
    root.style.setProperty('--tg-safe-bottom',    `${safeBottom}px`)
  }

  // Fullscreen NUR auf mobilen Clients anfordern. Auf Desktop/Web würde
  // requestFullscreen() die App über den kompletten Bildschirm legen.
  const platform: string | undefined = tg.platform
  const isMobile =
    platform === 'android' || platform === 'android_x' || platform === 'ios'

  if (isMobile) {
    try {
      const supportsFullscreen =
        typeof tg.requestFullscreen === 'function' &&
        (typeof tg.isVersionAtLeast !== 'function' || tg.isVersionAtLeast('8.0'))

      if (supportsFullscreen && !tg.isFullscreen) {
        tg.requestFullscreen()
      }
      // Verhindert versehentliches Schließen durch Wischen im Fullscreen
      tg.disableVerticalSwipes?.()

      // Hochformat festhalten: Die App ist durchgehend fuer Portrait
      // gebaut; ein versehentliches Drehen wuerde Layouts zerreissen.
      // lockOrientation() gibt es ab Bot API 8.0 — aeltere Clients
      // ignorieren den Aufruf einfach.
      if (typeof tg.lockOrientation === 'function' &&
          (typeof tg.isVersionAtLeast !== 'function' || tg.isVersionAtLeast('8.0'))) {
        tg.lockOrientation()
      }
    } catch { /* ältere Clients ignorieren */ }
  }

  // Rueckfalloption fuer Clients ohne lockOrientation (z.B. aeltere
  // Telegram-Versionen oder Browser-Vorschau). Funktioniert nur, wenn der
  // Browser es zulaesst; schlaegt es fehl, bleibt alles wie bisher.
  try {
    const so = (screen as any)?.orientation
    if (so && typeof so.lock === 'function') {
      so.lock('portrait').catch(() => { /* vom Browser abgelehnt */ })
    }
  } catch { /* ignore */ }

  applyInsets()

  try {
    tg.onEvent?.('safeAreaChanged',        applyInsets)
    tg.onEvent?.('contentSafeAreaChanged', applyInsets)
    tg.onEvent?.('fullscreenChanged',      applyInsets)
  } catch { /* ignore */ }
}
