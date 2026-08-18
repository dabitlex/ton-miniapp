// src/components/game/SeasonKickoffModal.tsx 
// Einmaliges Auftakt-Modal beim ersten Öffnen nach einem Season-Start
// (Design: V1-Stil — Aurora-Lichtkuppel, ruhige Feature-Zeilen).
// Gemerkt wird pro Season-Nummer in localStorage (vex_season_intro_<n>).
// Zeigt sich erst NACH einem evtl. offenen Season-Reward-Popup: kleiner
// Delay + Verzicht, solange ein anderes Overlay (SeasonRewardModal /
// WarResultModal) sichtbar sein könnte, regelt die Mount-Reihenfolge im
// Layout plus der 1,2s-Delay hier.
// Global gemountet in src/app/(game)/layout.tsx.
'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useUserStore } from '@/stores/useUserStore'
import { useUIStore } from '@/stores/useUIStore'
import { GameButton, WarStyles } from '@/components/war/WarPrimitives'
import { useT, type DictKey } from '@/lib/i18n'
import { Icon, type IconName } from '@/components/ui/Icon'

const fd: React.CSSProperties = { fontFamily: 'var(--font-display)', fontWeight: 800 }

// Season-Metadaten fürs Intro (Fallback, falls DB nur "Season N" liefert)
// Nur Schluessel — die Uebersetzung passiert in der Komponente, weil
// Konstanten auf Modulebene keinen Zugriff auf den Sprach-Hook haben.
const SEASON_META: Record<number, { name: string; taglineKey: DictKey }> = {
  2: { name: 'Ascension', taglineKey: 'season.ascentBegins' },
}

interface FeatureRow { icon: IconName; titleKey: DictKey; isNew?: boolean; textKey: DictKey }
const FEATURES: FeatureRow[] = [
  { icon: 'swords', titleKey: 'war.title',        isNew: true, textKey: 'season.warsBody' },
  { icon: 'rank',   titleKey: 'ranks.title',      isNew: true, textKey: 'season.leaguesBody' },
  { icon: 'gem',    titleKey: 'season.xpReset',                textKey: 'season.xpResetBody' },
]

export function SeasonKickoffModal() {
  const t = useT()
  const profile = useUserStore(s => s.profile)
  const { haptic } = useUIStore()
  const [open, setOpen] = useState(false)

  const seasonNumber = profile?.season?.number ?? null
  const storageKey   = seasonNumber != null ? `vex_season_intro_${seasonNumber}` : null

  useEffect(() => {
    if (!storageKey || seasonNumber == null || seasonNumber < 2) return
    let seen = false
    try { seen = localStorage.getItem(storageKey) === '1' } catch { /* WebView ohne Storage */ }
    if (seen) return
    // Delay: Season-Reward-Popup (aus der Vorsaison) zuerst zeigen lassen
    const t = setTimeout(() => setOpen(true), 1200)
    return () => clearTimeout(t)
  }, [storageKey, seasonNumber])

  if (!open || seasonNumber == null || typeof document === 'undefined') return null

  const meta = SEASON_META[seasonNumber]
    ?? { name: `Season ${seasonNumber}`, taglineKey: 'season.newEra' as DictKey }

  const close = () => {
    haptic('medium')
    try { if (storageKey) localStorage.setItem(storageKey, '1') } catch { /* ignore */ }
    setOpen(false)
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 85,
      background: 'rgba(4,4,9,.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
      <WarStyles />
      <div className="war-rise" style={{ width: '100%', maxWidth: 380, maxHeight: '88%', overflowY: 'auto',
        borderRadius: 28, overflow: 'hidden', background: '#0A0A12',
        boxShadow: 'inset 0 1px 0 rgba(196,181,253,.3), 0 30px 80px rgba(0,0,0,.7), 0 0 100px rgba(139,92,246,.22)' }}>

        {/* Aurora-Lichtkuppel */}
        <div style={{ position: 'relative', padding: '34px 24px 22px', textAlign: 'center',
          background: 'radial-gradient(130% 100% at 50% -20%,rgba(139,92,246,.35) 0%,rgba(91,141,239,.14) 45%,transparent 75%)' }}>
          <p className="eyebrow" style={{ color: 'var(--blue-2)' }}>{t(meta.taglineKey)}</p>
          <h2 style={{ ...fd, fontSize: 34, margin: '10px 0 4px', letterSpacing: '-0.03em',
            background: 'linear-gradient(120deg,#FFFFFF,#BFD4FF 60%,#8FB4FF)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            SEASON {seasonNumber}
          </h2>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14,
            color: 'var(--text-secondary)' }}>
            {meta.name} · 42 Tage
          </p>
          {/* dezente Sterne */}
          {[[14, 34, 3], [24, 70, 2], [76, 44, 3], [66, 88, 2]].map(([l, t, s], i) => (
            <span key={i} aria-hidden style={{ position: 'absolute', left: `${l}%`, top: t,
              width: s, height: s, borderRadius: '50%', background: '#E9D5FF',
              animation: `warTwinkle 3.5s ease-in-out ${i * 0.6}s infinite` }} />
          ))}
        </div>

        {/* Feature-Zeilen */}
        <div style={{ padding: '6px 22px 22px' }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="flex gap-3 items-center" style={{ padding: '13px 15px',
              marginBottom: i === FEATURES.length - 1 ? 16 : 9, borderRadius: 18,
              background: 'var(--surface-press)', boxShadow: 'inset 0 1px 0 0 var(--edge-soft)' }}>
              <Icon name={f.icon} size={18} />
              <div className="flex-1">
                <p style={{ fontSize: 12.5, fontWeight: 700 }}>
                  {t(f.titleKey)}
                  {f.isNew && (
                    <span style={{ display: 'inline-block', fontFamily: 'var(--font-display)',
                      fontSize: 9, fontWeight: 800, letterSpacing: '.14em', color: '#0b0b12',
                      background: 'linear-gradient(120deg,#7BA5FF,#2563FF)', borderRadius: 6,
                      padding: '3px 7px', verticalAlign: '1px', marginLeft: 8 }}>NEU</span>
                  )}
                </p>
                <p style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>{t(f.textKey)}</p>
              </div>
            </div>
          ))}
          <GameButton onClick={close}>🚀 SEASON {seasonNumber} STARTEN</GameButton>
        </div>
      </div>
    </div>,
    document.body
  )
}
