// src/app/(game)/clans/war/page.tsx — Schlachtfeld (Clan-War-Detailscreen)
// Game-Grade V3: großes Wappen-Duell, XL-Beam-Clash, Top-Kämpfer beider 
// Seiten mit Medaillen, Loot-Vorschau. Fällt bei fehlendem Krieg sauber
// auf den Clans-Tab zurück.
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useClanWar } from '@/features/war/hooks'
import { WAR_RULES } from '@/lib/constants/war'
import { WarStyles, Rivets, Crest, VsBadge, BeamClash, WarTimer, Ribbon, Medal } from '@/components/war/WarPrimitives'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatNumber } from '@/lib/utils'
import { ChevronLeft } from 'lucide-react'
import type { WarFighter } from '@/lib/constants/war'

const fd: React.CSSProperties = { fontFamily: 'var(--font-display)', fontWeight: 800 }

export default function BattlefieldPage() {
  const router = useRouter()
  const { war, isLoading } = useClanWar()

  // Kein Live-Krieg → zurück zum Clans-Tab (z.B. Krieg gerade beendet)
  useEffect(() => {
    if (!isLoading && war && war.state !== 'live') router.replace('/clans')
  }, [war, isLoading, router])

  if (isLoading || !war || war.state !== 'live') {
    return <div className="px-4 pt-4"><SkeletonCard lines={5} /></div>
  }

  const lead      = war.myClan.perCapita - war.rival.perCapita
  const leadLabel = lead > 0
    ? `🔥 ${war.myClan.name} führt mit +${formatNumber(lead)}`
    : lead < 0
    ? `⚡ ${war.rival.name} führt mit +${formatNumber(-lead)}`
    : '⚖️ Absolut ausgeglichen'

  return (
    <div className="flex flex-col min-h-full pb-6 relative z-10 px-4">
      <WarStyles />

      {/* Header */}
      <div className="flex items-center justify-between pt-3 pb-1">
        <div className="flex items-center gap-2.5">
          <button onClick={() => router.push('/clans')} className="chip press" style={{ padding: '6px 10px' }}>
            <ChevronLeft size={15} />
          </button>
          <h1 style={{ ...fd, fontSize: 15 }}>SCHLACHTFELD</h1>
        </div>
        <WarTimer endsAt={war.endsAt} compact />
      </div>

      {/* Duell */}
      <div className="flex items-start justify-center gap-4 mt-4 war-rise">
        <div className="text-center">
          <div className="mb-3 flex justify-center">
            <Crest name={war.myClan.name} avatarUrl={war.myClan.avatarUrl}
              level={war.myClan.level} palette="violet" size={78} />
          </div>
          <p style={{ ...fd, fontSize: 30, color: '#C4B5FD',
            textShadow: '0 0 26px rgba(167,139,250,.65)' }}>
            {formatNumber(war.myClan.perCapita)}
          </p>
        </div>
        <div style={{ marginTop: 24 }}><VsBadge size={60} /></div>
        <div className="text-center">
          <div className="mb-3 flex justify-center">
            <Crest name={war.rival.name} avatarUrl={war.rival.avatarUrl}
              level={war.rival.level} palette="crimson" size={78} />
          </div>
          <p style={{ ...fd, fontSize: 30, color: '#FDA4AF' }}>
            {formatNumber(war.rival.perCapita)}
          </p>
        </div>
      </div>
      <p className="text-center mt-1 mb-3" style={{ fontSize: 9, letterSpacing: '.16em',
        color: 'var(--text-muted)' }}>
        XP PRO Mitglied · GESAMT {formatNumber(war.myClan.score)} VS {formatNumber(war.rival.score)}
      </p>

      <BeamClash frontline={war.frontline} height={26} clashSize={48} />
      <div className="text-center my-3">
        <span className="war-gem" style={{ fontSize: 11.5, padding: '6px 14px' }}>{leadLabel}</span>
      </div>

      {/* Top-Kämpfer */}
      <Ribbon>TOP-KÄMPFER</Ribbon>
      <div className="war-plate" style={{ padding: '2px 13px' }}>
        {[0, 1, 2].map(i => (
          <FighterRow key={i} place={(i + 1) as 1 | 2 | 3}
            mine={war.topMine[i]} rival={war.topRival[i]} divider={i > 0} />
        ))}
        {war.topMine.length === 0 && war.topRival.length === 0 && (
          <p className="text-center text-xs py-4" style={{ color: 'var(--text-muted)' }}>
            Noch keine Beiträge — sei der Erste, der die Front verschiebt! ⚔️
          </p>
        )}
      </div>

      {/* Eigener Tagesbeitrag */}
      <div className="war-plate flex items-center gap-3 mt-3" style={{ padding: '12px 15px' }}>
        <span style={{ fontSize: 18 }}>🎯</span>
        <div className="flex-1">
          <p style={{ ...fd, fontSize: 10.5 }}>DEIN BEITRAG HEUTE</p>
          <div style={{ height: 6, borderRadius: 99, background: 'rgba(0,0,0,.45)', marginTop: 6,
            boxShadow: 'inset 0 1.5px 3px rgba(0,0,0,.7)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99,
              width: `${Math.min(100, (war.myContribution.today / war.myContribution.dailyCap) * 100)}%`,
              background: 'linear-gradient(90deg,#6D28D9,#A78BFA)' }} />
          </div>
        </div>
        <span style={{ ...fd, fontSize: 13, color: '#C4B5FD' }}>
          {formatNumber(war.myContribution.today)}<span style={{ fontSize: 9,
            color: 'var(--text-muted)' }}> / {formatNumber(war.myContribution.dailyCap)}</span>
        </span>
      </div>

      {/* Loot-Vorschau */}
      <div className="flex gap-2 mt-3">
        <LootTile icon="🏆" xp={WAR_RULES.rewardWin} label="SIEG" gold />
        <LootTile icon="🤝" xp={WAR_RULES.rewardDraw} label="REMIS" />
        <LootTile icon="🛡" xp={WAR_RULES.rewardLoss} label="NIEDERLAGE" />
      </div>
      <p className="text-center mt-2.5" style={{ fontSize: 9.5, color: 'var(--text-faint)' }}>
        Jede XP zählt automatisch · Cap {formatNumber(WAR_RULES.dailyCap)} XP/Tag · Kein XP-Verlust
      </p>
    </div>
  )
}

function FighterRow({ place, mine, rival, divider }: {
  place: 1 | 2 | 3; mine?: WarFighter; rival?: WarFighter; divider: boolean
}) {
  if (!mine && !rival) return null
  return (
    <>
      {divider && <div className="war-hairline" />}
      <div className="grid items-center gap-1 py-2.5" style={{ gridTemplateColumns: '1fr 34px 1fr' }}>
        <div className="flex items-center gap-2 min-w-0">
          {mine ? (<>
            <Medal place={place} />
            <div className="min-w-0">
              <p className="text-[11.5px] font-extrabold line-clamp-1">
                {mine.firstName}{place === 1 ? ' 👑' : ''}
              </p>
              <p style={{ ...fd, fontSize: 10.5, color: '#C4B5FD' }}>{formatNumber(mine.xp)}</p>
            </div>
          </>) : <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>—</span>}
        </div>
        <span className="text-center" style={{ fontSize: 8, color: 'var(--text-faint)', fontWeight: 800 }}>
          {place === 1 ? 'VS' : ''}
        </span>
        <div className="flex items-center gap-2 flex-row-reverse text-right min-w-0">
          {rival ? (<>
            <Medal place={place} />
            <div className="min-w-0">
              <p className="text-[11.5px] font-bold line-clamp-1">{rival.firstName}</p>
              <p style={{ ...fd, fontSize: 10.5, color: '#FDA4AF' }}>{formatNumber(rival.xp)}</p>
            </div>
          </>) : <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>—</span>}
        </div>
      </div>
    </>
  )
}

function LootTile({ icon, xp, label, gold }: { icon: string; xp: number; label: string; gold?: boolean }) {
  return (
    <div className="war-plate flex-1 text-center" style={{ padding: '11px 6px',
      ...(gold ? { background: 'linear-gradient(180deg,rgba(251,191,36,.10),rgba(255,255,255,.02))' } : {}) }}>
      <p style={{ fontSize: 15 }}>{icon}</p>
      <p style={{ ...fd, fontSize: 14, ...(gold
        ? { background: 'linear-gradient(175deg,#FEF3C7 5%,#FBBF24 45%,#B45309 95%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
        : { color: 'var(--text-secondary)' }) }}>
        +{formatNumber(xp)}
      </p>
      <p style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.1em' }}>{label}</p>
    </div>
  )
}
