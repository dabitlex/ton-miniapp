// src/app/(game)/arcade/page.tsx — Spielesammlung "Play for XP" 
//
// Der Schnellzugriff auf Home fuehrt hierher. Von hier aus waehlt der
// Nutzer sein Spiel. Zwei Cover nebeneinander, darunter nur der Name.
'use client'
import { useEffect } from 'react'
import Link          from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery }  from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUIStore }   from '@/stores/useUIStore'
import { authedFetch }  from '@/lib/authedFetch'
import { useI18n }      from '@/lib/i18n'
import { Icon, IconTile } from '@/components/ui/Icon'
import { GameCover, GAME_META, type GameKey } from '@/components/arcade/GameCovers'

const fd: React.CSSProperties = { fontFamily: 'var(--font-display)' }

interface GameRow { game: GameKey; enabled: boolean; runsLeft: number; bestScore: number }

export default function ArcadeHubPage() {
  const router = useRouter()
  const { t, lang } = useI18n()
  const token = useAuthStore(s => s.accessToken)
  const setNavVisible = useUIStore(s => s.setNavVisible)

  // Die Sammlung behaelt die Navigation — nur die Spiele selbst
  // laufen im Vollbild. Falls man aus einem Spiel hierher zurueckkehrt,
  // wird sie hier wieder eingeblendet.
  useEffect(() => { setNavVisible(true) }, [setNavVisible])

  const { data: games, isLoading } = useQuery<GameRow[]>({
    queryKey:  ['arcade-games'],
    enabled:   !!token,
    staleTime: 30_000,
    queryFn: async () => {
      const res  = await authedFetch('/api/v1/arcade/games')
      const json = await res.json().catch(() => null)
      return json?.success ? (json.data?.games ?? []) : []
    },
  })

  const sichtbar = (games ?? []).filter(g => g.enabled)

  return (
    <div className="overflow-y-auto relative z-10" style={{ padding: '22px 20px 24px' }}>

      {/* Kopfzeile */}
      <div className="flex items-center animate-rise" style={{ gap: 12, marginBottom: 20 }}>
        <button onClick={() => router.push('/home')} aria-label={t('common.back')} className="press"
          style={{ width: 38, height: 38, borderRadius: 13, border: 'none', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            background: 'linear-gradient(150deg,rgba(255,255,255,.16),rgba(255,255,255,.05))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)' }}>
          <Icon name="chevronLeft" size={17} strokeWidth={1.8} />
        </button>
        <div>
          <h1 style={{ ...fd, fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em' }}>
            Play for XP
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            {lang === 'de' ? 'Spiele eine Runde und verdiene XP' : 'Play a round and earn XP'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          {[0, 1].map(i => (
            <div key={i}>
              <div className="shimmer" style={{ width: '100%', aspectRatio: '1 / 1.18', borderRadius: 20 }} />
              <div className="shimmer" style={{ height: 12, width: '60%', margin: '10px auto 0', borderRadius: 4 }} />
            </div>
          ))}
        </div>

      ) : sichtbar.length === 0 ? (
        <div className="flex flex-col items-center justify-center" style={{ padding: '60px 20px' }}>
          <IconTile name="gamepad" size={62} />
          <p style={{ ...fd, fontSize: 15, fontWeight: 500, marginTop: 16 }}>
            {lang === 'de' ? 'Bald verfügbar' : 'Coming soon'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
            {lang === 'de' ? 'Hier gibt es bald Spiele.' : 'Games will appear here soon.'}
          </p>
        </div>

      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          {sichtbar.map((g, i) => {
            const meta = GAME_META[g.game]
            if (!meta) return null
            return (
              <Link key={g.game} href={meta.href} className="press animate-rise"
                style={{ display: 'block', textDecoration: 'none', color: 'inherit',
                  animationDelay: `${i * 60}ms` }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1.18',
                  borderRadius: 20, overflow: 'hidden',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.22), inset 0 0 0 .5px rgba(255,255,255,.10), 0 14px 30px rgba(0,0,0,.5)' }}>
                  <GameCover game={g.game} />
                  {g.bestScore === 0 && (
                    <span style={{ position: 'absolute', top: 9, right: 9, zIndex: 3,
                      fontSize: 8.5, fontWeight: 500, letterSpacing: '.1em', ...fd,
                      padding: '3px 8px', borderRadius: 999,
                      background: 'rgba(127,227,168,.20)', color: 'var(--emerald)',
                      boxShadow: 'inset 0 0 0 .5px rgba(127,227,168,.45)' }}>
                      {lang === 'de' ? 'NEU' : 'NEW'}
                    </span>
                  )}
                </div>
                <p style={{ ...fd, fontSize: 13.5, fontWeight: 500, margin: '10px 2px 0',
                  textAlign: 'center' }}>{meta.title}</p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
