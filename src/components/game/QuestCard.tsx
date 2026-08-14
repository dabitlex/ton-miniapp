// src/components/game/QuestCard.tsx — VEXALGO 2.0
// Die Props sind unveraendert — nur die Darstellung wurde neu gebaut.
'use client'
import { Icon, IconTile, type IconName } from '@/components/ui/Icon'
import { useT } from '@/lib/i18n'
import type { DailyQuest, WeeklyQuest } from '@/types/game'

interface QuestCardProps {
  quest:           DailyQuest | WeeklyQuest
  onComplete:      (id: string, questType: 'daily' | 'weekly') => void
  completing:      boolean
  activeBoostPct?: number
  index?:          number
  // Watch-Modus (fuer die synthetische "Watch Ads"-Tageskarte):
  watchMode?:      boolean
  onWatch?:        () => void
  watching?:       boolean
  watchDisabled?:  boolean
}

/** Schwierigkeit → kleiner Farbpunkt am Icon */
const DIFF_DOT: Record<string, string> = {
  easy:   'var(--emerald)',
  medium: 'var(--blue-2)',
  hard:   'var(--rose)',
}

/** Passendes Linien-Icon aus dem internal_code ableiten */
function iconFor(code: string, watchMode: boolean): IconName {
  if (watchMode || code.includes('ads') || code.includes('watch')) return 'tv'
  if (code.includes('energy'))    return 'bolt'
  if (code.includes('champion'))  return 'crown'
  if (code.includes('login'))     return 'check'
  if (code.includes('referral'))  return 'users'
  if (code.includes('clan'))      return 'clan'
  if (code.includes('xp'))        return 'trophy'
  return 'target'
}

const fd: React.CSSProperties = { fontFamily: 'var(--font-display)' }

/** Energiekosten einer Quest — Blitz plus Zahl, dezent neben dem Fortschritt */
function EnergyCost({ value }: { value: number }) {
  return (
    <span className="flex items-center" style={{ gap: 3, flexShrink: 0 }}>
      <Icon name="bolt" size={11} strokeWidth={1.8} style={{ color: 'var(--blue-3)' }} />
      <span style={{ ...fd, fontSize: 11, color: 'var(--text-secondary)' }}>{value}</span>
    </span>
  )
}

export function QuestCard({
  quest, onComplete, completing, activeBoostPct = 0, index = 0,
  watchMode = false, onWatch, watching = false, watchDisabled = false,
}: QuestCardProps) {
  const t = useT()
  const boostedXp = activeBoostPct > 0
    ? Math.floor(quest.template.xpReward * (1 + activeBoostPct / 100))
    : quest.template.xpReward

  const isDone      = quest.status === 'completed'
  const progress    = quest.progress
  const isCountable = progress?.type === 'countable'
  const isMet       = progress?.isMet ?? false
  const current     = progress?.current ?? 0
  const target      = progress?.target ?? 1
  const canClaim    = !isDone && isMet

  const energyCost = watchMode ? 0 : (quest.template.energyCost ?? 0)
  const dot = DIFF_DOT[quest.template.difficulty] ?? DIFF_DOT.easy
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0

  const handle = () => {
    if (completing || watching) return
    if (watchMode) { if (!watchDisabled) onWatch?.() }
    else if (canClaim) onComplete(quest.id, quest.template.questType === 'weekly' ? 'weekly' : 'daily')
  }

  const active = watchMode ? !watchDisabled : canClaim

  return (
    <div
      className={active ? 'surface animate-rise' : 'surface-2 animate-rise'}
      style={{
        padding: '14px 16px', borderRadius: 20, display: 'flex',
        alignItems: 'center', gap: 12, opacity: isDone && !watchMode ? 0.55 : 1,
        animationDelay: `${Math.min(index, 8) * 55}ms`,
      }}
    >
      {/* Icon mit Schwierigkeits-Punkt */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <IconTile
          name={isDone && !watchMode ? 'check' : iconFor(quest.template.internalCode, watchMode)}
          size={isDone && !watchMode ? 36 : 44}
        />
        {!isDone && (
          <span aria-hidden style={{
            position: 'absolute', top: -2, left: -2, width: 9, height: 9,
            borderRadius: '50%', background: dot, border: '2px solid var(--bg-void)',
          }} />
        )}
      </div>

      {/* Titel + Fortschritt */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{
          ...fd, fontSize: 14.5, fontWeight: 500, letterSpacing: '-0.01em',
          color: isDone && !watchMode ? 'var(--text-secondary)' : 'var(--text-primary)',
        }}>
          {quest.template.title}
        </h2>

        {isDone && !watchMode ? (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {t('quests.completed')}
          </p>
        ) : watchMode ? (
          <div className="flex items-center" style={{ gap: 7, marginTop: 6 }}>
            <div className="flex" style={{ gap: 4 }}>
              {Array.from({ length: target }).map((_, i) => (
                <span key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: i < current
                    ? 'linear-gradient(135deg,#7BA5FF,#2563FF)' : 'rgba(255,255,255,.14)',
                }} />
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{current}/{target}</p>
            {energyCost > 0 && <EnergyCost value={energyCost} />}
          </div>
        ) : isCountable ? (
          <div className="flex items-center" style={{ gap: 8, marginTop: 8 }}>
            <div className="progress-bar" style={{ flex: 1, height: 5 }}>
              <div className="progress-fill" style={{
                width: `${pct}%`,
                ...(isMet ? { background: 'linear-gradient(90deg,#7FE3A8,#22C55E)' } : {}),
              }} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {current}/{target}
            </p>
            {energyCost > 0 && <EnergyCost value={energyCost} />}
          </div>
        ) : (
          <div className="flex items-center" style={{ gap: 8, marginTop: 4 }}>
            <p className="truncate" style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
              {quest.template.description}
            </p>
            {energyCost > 0 && <EnergyCost value={energyCost} />}
          </div>
        )}
      </div>

      {/* Belohnung / Aktion */}
      {isDone && !watchMode ? (
        /* Kein Betrag: bei verdoppelten Quests waere er sonst irrefuehrend
           (xpGranted enthaelt den Bonus nicht immer). */
        <p style={{ ...fd, fontSize: 12.5, color: 'var(--emerald)', whiteSpace: 'nowrap' }}>
          {t('common.done')}
        </p>
      ) : (
        <button
          onClick={handle}
          disabled={!active || completing || watching}
          className={active ? 'btn-primary press' : 'btn-secondary press'}
          style={{
            width: 'auto', height: 35, padding: '0 15px', borderRadius: 12,
            fontSize: 12.5, whiteSpace: 'nowrap', flexShrink: 0,
            ...(active ? {} : { opacity: 0.75 }),
          }}
        >
          {completing || watching
            ? '…'
            : watchMode
              ? (watchDisabled ? t('common.done') : `+${boostedXp} XP`)
              : `+${boostedXp}${canClaim ? ' XP' : ''}`}
        </button>
      )}
    </div>
  )
}
