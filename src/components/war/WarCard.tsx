// src/components/war/WarCard.tsx
// Hero-Karte des Wars-Untertabs im Clan-Screen.
// Zustände: live (Duell + Beam + eigener Cap + CTA), idle (Countdown bis
// Montag + Regeln), plus Kriegs-Historie darunter. 
'use client'
import { useRouter } from 'next/navigation'
import { useClanWar, useWarHistory } from '@/features/war/hooks'
import { WAR_RULES } from '@/lib/constants/war'
import { WarStyles, Rivets, Crest, VsBadge, BeamClash, WarTimer, GameButton, Medal } from './WarPrimitives'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatNumber } from '@/lib/utils'
import { Icon } from '@/components/ui/Icon'

const fd: React.CSSProperties = { fontFamily: 'var(--font-display)', fontWeight: 800 }

export function WarCard() {
  const router = useRouter()
  const { war, isLoading } = useClanWar()
  const { history } = useWarHistory()

  if (isLoading && !war) return <SkeletonCard lines={4} />
  if (!war || war.state === 'no_clan') return null

  return (
    <div className="space-y-3">
      <WarStyles />

      {/* ── LIVE ─────────────────────────────────────────────── */}
      {war.state === 'live' && (
        <>
          <div className="war-plate war-rise" style={{ padding: '16px 16px 18px',
            background: 'linear-gradient(150deg,rgba(255,255,255,.16) 0%,rgba(255,255,255,.06) 42%,rgba(255,255,255,.035) 100%)' }}>
            <Rivets />

            <div className="flex items-center justify-between mb-3">
              <span style={{ ...fd, fontSize: 10, letterSpacing: '.22em', color: 'var(--violet-bright)' }}>
                Clan War · Live
              </span>
              <WarTimer endsAt={war.endsAt} compact />
            </div>

            {/* Duell */}
            <div className="flex items-center justify-between mb-3" style={{ padding: '0 2px' }}>
              <div className="flex flex-col items-center gap-2" style={{ width: 118 }}>
                <Crest name={war.myClan.name} avatarUrl={war.myClan.avatarUrl}
                  level={war.myClan.level} palette="violet" size={62} />
                <span style={{ ...fd, fontSize: 11.5, marginTop: 4 }} className="text-center line-clamp-1">
                  {war.myClan.name}
                </span>
                <span style={{ ...fd, fontSize: 23, color: 'var(--blue-2)' }}>
                  {formatNumber(war.myClan.perCapita)}
                </span>
              </div>
              <VsBadge size={54} />
              <div className="flex flex-col items-center gap-2" style={{ width: 118 }}>
                <Crest name={war.rival.name} avatarUrl={war.rival.avatarUrl}
                  level={war.rival.level} palette="crimson" size={62} />
                <span style={{ ...fd, fontSize: 11.5, marginTop: 4 }} className="text-center line-clamp-1">
                  {war.rival.name}
                </span>
                <span style={{ ...fd, fontSize: 23, color: '#FDA4AF' }}>
                  {formatNumber(war.rival.perCapita)}
                </span>
              </div>
            </div>
            <p className="text-center mb-3" style={{ fontSize: 9, letterSpacing: '.16em',
              color: 'var(--text-muted)' }}>
              XP pro Mitglied · {war.myClan.memberCount} vs {war.rival.memberCount}
            </p>

            <BeamClash frontline={war.frontline} />
            <div className="flex justify-between" style={{ ...fd, fontSize: 10.5, padding: '7px 10px 0' }}>
              <span style={{ color: 'var(--blue-2)' }}>{Math.round(war.frontline * 100)} %</span>
              <span style={{ color: '#FDA4AF' }}>{Math.round((1 - war.frontline) * 100)} %</span>
            </div>

            <GameButton style={{ marginTop: 14 }} onClick={() => router.push('/clans/war')}>
              Zum Schlachtfeld
            </GameButton>
          </div>

          {/* Eigener Tagesbeitrag */}
          <div className="war-plate flex items-center gap-3" style={{ padding: '13px 16px' }}>
            <Icon name="target" size={17} style={{ color: 'var(--blue-2)' }} />
            <div className="flex-1">
              <p style={{ ...fd, fontSize: 11 }}>Dein Beitrag heute</p>
              <div style={{ height: 7, borderRadius: 99, background: 'rgba(0,0,0,.45)', marginTop: 7,
                boxShadow: 'inset 0 1.5px 3px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.05)',
                overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99,
                  width: `${Math.min(100, (war.myContribution.today / war.myContribution.dailyCap) * 100)}%`,
                  background: 'linear-gradient(90deg,#7BA5FF,#2563FF)',
                  boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,.4)',
                  transition: 'width .6s cubic-bezier(0.22,1,0.36,1)' }} />
              </div>
            </div>
            <div className="text-right">
              <p style={{ ...fd, fontSize: 15, color: 'var(--blue-2)' }}>{formatNumber(war.myContribution.today)}</p>
              <p style={{ fontSize: 8.5, color: 'var(--text-muted)', fontWeight: 700 }}>
                / {formatNumber(war.myContribution.dailyCap)} XP
              </p>
            </div>
          </div>

          {!war.myContribution.isParticipant && (
            <div className="surface-quiet px-3.5 py-3">
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Du bist diesem Clan nach Kriegsbeginn beigetreten — dein Beitrag zählt ab dem nächsten Krieg (Montag).
              </p>
            </div>
          )}
        </>
      )}

      {/* ── IDLE ─────────────────────────────────────────────── */}
      {war.state === 'idle' && (
        <div className="war-plate war-rise text-center" style={{ padding: '22px 18px' }}>
          <Rivets />
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: 'var(--surface-2)', boxShadow: 'inset 0 1px 0 var(--edge-light)' }}>
            <Icon name="swords" size={26} style={{ color: 'var(--violet-bright)' }} />
          </div>
          <p style={{ ...fd, fontSize: 15 }}>Nächster Clan War</p>
          <p className="text-[11px] mt-1 mb-3" style={{ color: 'var(--text-secondary)' }}>
            Matchmaking startet Montag — Gegner mit ähnlicher Stärke.
          </p>
          <div className="flex justify-center mb-4"><WarTimer endsAt={war.nextWarAt} /></div>
          <div className="flex gap-2 justify-center flex-wrap">
            <span className="war-gem gold">Sieg +{formatNumber(WAR_RULES.rewardWin)} XP</span>
            <span className="war-gem">Kein XP-Verlust</span>
            <span className="war-gem">Cap {formatNumber(WAR_RULES.dailyCap)}/Tag</span>
          </div>
        </div>
      )}

      {/* ── Historie ─────────────────────────────────────────── */}
      {history.length > 0 && (
        <>
          <p className="eyebrow" style={{ margin: '14px 4px 4px' }}>⚑ Kriegs-Historie</p>
          <div className="war-plate" style={{ padding: '4px 14px' }}>
            {history.slice(0, 5).map((h, i) => (
              <div key={h.warId}>
                {i > 0 && <div className="war-hairline" />}
                <div className="flex items-center gap-3 py-2.5">
                  <Medal place={h.outcome === 'win' ? 'win' : h.outcome === 'draw' ? 2 : 'loss'}>
                    {h.outcome === 'win' ? '✓' : h.outcome === 'draw' ? '=' : '✕'}
                  </Medal>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold line-clamp-1">vs. {h.rival.name}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {formatNumber(h.myPerCapita)} : {formatNumber(h.rivalPerCapita)} XP/Mitglied
                    </p>
                  </div>
                  <span className={`war-gem${h.outcome === 'win' ? ' gold' : ''}`}>
                    +{formatNumber(h.myRewardXp)} XP
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
