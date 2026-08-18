// src/components/game/XpHistorySheet.tsx
// XP-Verlauf im You-Tab. BottomSheet, nach Tagen gruppiert, paginiert.
// LIVE: Supabase Realtime auf xp_logs (INSERT, gefiltert auf user_id) ->
// neue Einträge erscheinen sofort oben mit kurzem Highlight.
// POPUP: Daily/Weekly Quests und Achievements sind antippbar -> Detail-Fenster
// (Titel + Beschreibung) wird beim Tippen lazy aufgelöst.

'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '@/lib/i18n'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUserStore } from '@/stores/useUserStore'
import { BottomSheet } from '@/components/ui/BottomSheet'
import {
  Target, CalendarCheck, Gift, Shield, Swords, Flame, UserPlus, Medal,
  Play, Crown, Sparkles, RefreshCw, Loader2, ChevronRight, X, type LucideIcon,
} from 'lucide-react'

interface XpEntry {
  id: string; createdAt: string; source: string
  xp: number; boostPercent: number; level: number | null; leveledUp: boolean
  doubled?: boolean
}
type Cat = 'all' | 'quests' | 'clan' | 'bonuses'

const SRC: Record<string, { label: Record<'de'|'en', string>; cat: Cat; color: string; bg: string; Icon: LucideIcon }> = {
  quest_daily:    { label: { de: 'Daily Quest', en: 'Daily quest' },    cat: 'quests',  color: '#C4B5FD', bg: 'rgba(139,92,246,.16)', Icon: Target },
  quest_weekly:   { label: { de: 'Weekly Quest', en: 'Weekly quest' },   cat: 'quests',  color: '#C4B5FD', bg: 'rgba(139,92,246,.16)', Icon: CalendarCheck },
  quest_special:  { label: { de: 'Mystery Box', en: 'Mystery box' },    cat: 'quests',  color: 'var(--gold)', bg: 'rgba(251,191,36,.16)', Icon: Gift },
  clan_mission:   { label: { de: 'Clan Mission', en: 'Clan mission' },   cat: 'clan',    color: '#9CC0FF', bg: 'rgba(91,141,239,.16)', Icon: Shield },
  clan_war_win:   { label: { de: 'Clan War', en: 'Clan war' },       cat: 'clan',    color: '#9CC0FF', bg: 'rgba(91,141,239,.16)', Icon: Swords },
  streak_bonus:   { label: { de: 'Streak Bonus', en: 'Streak bonus' },   cat: 'bonuses', color: '#FFB27A', bg: 'rgba(251,146,60,.16)', Icon: Flame },
  referral_bonus: { label: { de: 'Referral Bonus', en: 'Referral bonus' }, cat: 'bonuses', color: 'var(--emerald)', bg: 'rgba(52,211,153,.16)', Icon: UserPlus },
  achievement:    { label: { de: 'Achievement', en: 'Achievement' },    cat: 'bonuses', color: 'var(--gold)', bg: 'rgba(251,191,36,.16)', Icon: Medal },
  ad_reward:      { label: { de: 'Ad Reward', en: 'Ad reward' },      cat: 'bonuses', color: '#7FE3E0', bg: 'rgba(94,234,212,.16)', Icon: Play },
  season_bonus:   { label: { de: 'Season-Bonus', en: 'Season bonus' },   cat: 'bonuses', color: 'var(--gold)', bg: 'rgba(251,191,36,.16)', Icon: Crown },
  vault_win:      { label: { de: 'Weekly Vault', en: 'Weekly Vault' },   cat: 'bonuses', color: 'var(--gold)', bg: 'rgba(251,191,36,.16)', Icon: Gift },
  pvp_win:        { label: { de: 'PvP-Sieg', en: 'PvP win' },       cat: 'bonuses', color: 'var(--rose)', bg: 'rgba(251,113,133,.16)', Icon: Swords },
  admin_grant:    { label: { de: 'Bonus', en: 'Bonus' },          cat: 'bonuses', color: '#9CC0FF', bg: 'rgba(91,141,239,.16)', Icon: Sparkles },
  correction:     { label: { de: 'Korrektur', en: 'Correction' },      cat: 'bonuses', color: 'rgba(255,255,255,.6)', bg: 'rgba(255,255,255,.08)', Icon: RefreshCw },
}
const FALLBACK = { label: { de: 'XP', en: 'XP' }, cat: 'bonuses' as Cat, color: '#ffffff', bg: 'rgba(255,255,255,.08)', Icon: Sparkles }
const meta = (s: string) => SRC[s] ?? FALLBACK

// Welche Quellen ein Detail-Popup haben (auflösbar via source_ref_id)
const DETAILABLE = new Set(['quest_daily', 'quest_weekly', 'achievement'])

const CHIPS: { id: Cat; label: Record<'de'|'en', string> }[] = [
  { id: 'all', label: { de: 'Alle', en: 'All' } },
  { id: 'quests', label: { de: 'Quests', en: 'Quests' } },
  { id: 'clan', label: { de: 'Clan', en: 'Clan' } },
  { id: 'bonuses', label: { de: 'Boni', en: 'Bonuses' } },
]

function rel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7)  return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return `${Math.floor(d / 30)}mo ago`
}
function fullWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
       + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function dayLabel(iso: string): string {
  const d = new Date(iso), now = new Date()
  if (sameDay(d, now)) return 'Today'
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (sameDay(d, y)) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface DetailState {
  open: boolean; loading: boolean; entry: XpEntry | null
  title: string | null; description: string | null
}

export function XpHistorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useI18n()
  const token  = useAuthStore(s => s.accessToken)
  const userId = useUserStore(s => s.profile?.id)

  const [entries, setEntries]       = useState<XpEntry[]>([])
  const [cursor, setCursor]         = useState<string | null>(null)
  const [hasMore, setHasMore]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter, setFilter]         = useState<Cat>('all')
  const [fresh, setFresh]           = useState<Set<string>>(new Set())
  const [detail, setDetail]         = useState<DetailState>({ open: false, loading: false, entry: null, title: null, description: null })
  const seen = useRef<Set<string>>(new Set())

  const fetchPage = useCallback(async (before: string | null) => {
    if (!token) return
    const qs = new URLSearchParams({ limit: '30' })
    if (before) qs.set('before', before)
    const res  = await fetch(`/api/v1/users/xp-history?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
    const json = await res.json()
    if (!json.success) return
    const next: XpEntry[] = json.data.entries
    next.forEach(e => seen.current.add(e.id))
    setEntries(prev => before ? [...prev, ...next] : next)
    setCursor(json.data.nextCursor)
    setHasMore(!!json.data.nextCursor)
  }, [token])

  // Beim Öffnen: frisch laden
  useEffect(() => {
    if (!open || !token) return
    seen.current = new Set()
    setEntries([]); setCursor(null); setHasMore(false); setLoading(true)
    fetchPage(null).finally(() => setLoading(false))
  }, [open, token, fetchPage])

  // LIVE: Realtime auf xp_logs INSERT (eigene user_id)
  useEffect(() => {
    if (!open || !userId) return
    let channel: any = null
    let cancelled = false

    import('@/lib/supabase/client').then(({ createSupabaseBrowserClient }) => {
      if (cancelled) return
      try {
        const supabase = createSupabaseBrowserClient()
        channel = supabase
          .channel(`xp-history-${userId}`)
          .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'xp_logs', filter: `user_id=eq.${userId}` },
            (payload: any) => {
              const r = payload.new
              if (!r?.id || seen.current.has(r.id)) return
              seen.current.add(r.id)
              const e: XpEntry = {
                id: r.id, createdAt: r.created_at, source: r.source_type,
                xp: r.xp_granted, boostPercent: r.boost_percent ?? 0,
                level: r.leveled_up ? r.level_after : null, leveledUp: r.leveled_up,
                doubled: false,
              }
              setEntries(prev => [e, ...prev])
              setFresh(prev => new Set(prev).add(e.id))
              setTimeout(() => setFresh(prev => {
                const n = new Set(prev); n.delete(e.id); return n
              }), 1600)
            }
          )
          .subscribe()
      } catch { /* Realtime optional */ }
    })

    return () => {
      cancelled = true
      if (channel) {
        import('@/lib/supabase/client')
          .then(({ createSupabaseBrowserClient }) => createSupabaseBrowserClient().removeChannel(channel))
          .catch(() => {})
      }
    }
  }, [open, userId])

  async function loadMore() {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    await fetchPage(cursor)
    setLoadingMore(false)
  }

  async function openDetail(e: XpEntry) {
    setDetail({ open: true, loading: true, entry: e, title: null, description: null })
    try {
      const res  = await fetch(`/api/v1/users/xp-history/${e.id}`, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (json.success) setDetail(d => ({ ...d, loading: false, title: json.data.title, description: json.data.description }))
      else setDetail(d => ({ ...d, loading: false }))
    } catch { setDetail(d => ({ ...d, loading: false })) }
  }
  const closeDetail = () => setDetail(d => ({ ...d, open: false }))

  // Filtern + nach Tagen gruppieren
  const visible = filter === 'all' ? entries : entries.filter(e => meta(e.source).cat === filter)
  const groups: { label: string; items: XpEntry[] }[] = []
  for (const e of visible) {
    const lbl = dayLabel(e.createdAt)
    const g = groups[groups.length - 1]
    if (g && g.label === lbl) g.items.push(e)
    else groups.push({ label: lbl, items: [e] })
  }

  // Tagessumme und 14-Tage-Verlauf — beides aus den bereits geladenen
  // Eintraegen berechnet, kein zusaetzlicher Server-Aufruf.
  const todayKey  = new Date().toISOString().slice(0, 10)
  const todayXp   = entries
    .filter(e => e.createdAt.slice(0, 10) === todayKey)
    .reduce((sum, e) => sum + (e.xp > 0 ? e.xp : 0), 0)

  const trend = (() => {
    const days = 14
    const now = new Date()
    const buckets = new Map<string, number>()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setUTCDate(d.getUTCDate() - i)
      buckets.set(d.toISOString().slice(0, 10), 0)
    }
    for (const e of entries) {
      const k = e.createdAt.slice(0, 10)
      if (buckets.has(k) && e.xp > 0) buckets.set(k, (buckets.get(k) ?? 0) + e.xp)
    }
    return Array.from(buckets.values())
  })()
  const trendMax  = Math.max(...trend, 1)
  const hasTrend  = trend.some(v => v > 0)

  const dm = detail.entry ? meta(detail.entry.source) : null

  return (
    <BottomSheet open={open} onClose={onClose} title="XP-Verlauf">
      <style>{`@keyframes xpPop{0%{opacity:0;transform:translateY(-10px) scale(.97)}100%{opacity:1;transform:none}}@keyframes xpPopIn{0%{opacity:0;transform:scale(.9) translateY(10px)}100%{opacity:1;transform:none}}`}</style>

      {/* Zusammenfassung: heute verdient + 14-Tage-Verlauf */}
      {!loading && (todayXp > 0 || hasTrend) && (
        <div className="surface-2" style={{ padding: 16, borderRadius: 20, marginBottom: 14 }}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Heute verdient</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, marginTop: 3 }}>
                {todayXp.toLocaleString('de-DE')} XP
              </p>
            </div>
            {hasTrend && (
              <div className="flex items-end" style={{ gap: 2.5, height: 28 }}>
                {trend.map((v, i) => (
                  <span key={i} style={{
                    width: 5, borderRadius: 2,
                    height: `${Math.max(8, (v / trendMax) * 100)}%`,
                    background: 'linear-gradient(180deg,#7BA5FF,rgba(37,99,255,0.25))',
                  }} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 mb-3 overflow-x-auto [scrollbar-width:none]"
        style={{ WebkitOverflowScrolling: 'touch', paddingRight: 26,
          maskImage: 'linear-gradient(90deg,#000 0,#000 88%,transparent 100%)',
          WebkitMaskImage: 'linear-gradient(90deg,#000 0,#000 88%,transparent 100%)' }}>
        {CHIPS.map(c => {
          const on = filter === c.id
          return (
            <button key={c.id} onClick={() => setFilter(c.id)}
              className="press shrink-0"
              style={{
                borderRadius: 999, fontSize: 11.5, padding: '8px 14px',
                fontFamily: 'var(--font-display)', fontWeight: on ? 500 : 400,
                ...(on
                  ? { color: '#fff', background: 'linear-gradient(135deg,#5B8DFF,#1D4ED8)',
                      boxShadow: '0 6px 16px rgba(37,99,255,.35)' }
                  : { color: 'var(--text-secondary)',
                      background: 'linear-gradient(150deg,rgba(255,255,255,.13),rgba(255,255,255,.04))',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.20), inset 0 0 0 .5px rgba(255,255,255,.07)' }),
              }}>
              {c.label[lang]}
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[58px] rounded-2xl shimmer" />)}
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="text-center py-10">
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500,
            color: 'var(--text-secondary)' }}>{t('xp.empty')}</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>
            {t('xp.emptySub')}</p>
        </div>
      )}

      {!loading && groups.map(g => (
        <div key={g.label[lang]}>
          <div className="sticky top-0 z-[1] py-2 px-1.5 eyebrow"
            style={{ color: 'var(--text-muted)', background: 'linear-gradient(180deg, #0B1220 70%, transparent)' }}>
            {g.label[lang]}
          </div>
          <div className="space-y-1.5">
            {g.items.map(e => {
              const m = meta(e.source); const Icon = m.Icon
              const isFresh = fresh.has(e.id); const tappable = DETAILABLE.has(e.source)
              return (
                <div key={e.id} onClick={tappable ? () => openDetail(e) : undefined}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
                  style={{
                    cursor: tappable ? 'pointer' : 'default',
                    background: isFresh
                      ? 'linear-gradient(150deg,rgba(91,141,255,.30),rgba(37,99,255,.14))'
                      : 'linear-gradient(150deg,rgba(255,255,255,.10),rgba(255,255,255,.03))',
                    boxShadow: isFresh
                      ? 'inset 0 1px 0 rgba(255,255,255,.28), inset 0 0 0 .5px rgba(143,180,255,.40), 0 8px 20px rgba(37,99,255,.30)'
                      : 'inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 0 .5px rgba(255,255,255,.06)',
                    transition: 'background 1.4s ease, box-shadow 1.4s ease',
                    animation: isFresh ? 'xpPop .45s cubic-bezier(.2,.9,.2,1)' : undefined,
                  }}>
                  <div className="w-10 h-10 shrink-0 flex items-center justify-center"
                    style={{ borderRadius: 13, background: m.bg, color: m.color,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.22), inset 0 0 0 .5px rgba(255,255,255,.07)' }}>
                    <Icon size={18} strokeWidth={1.6} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="leading-tight" style={{ fontSize: 13.5, fontWeight: 500,
                      color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{m.label[lang]}</p>
                    <p className="text-[11px] mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                      {rel(e.createdAt)}
                      {e.doubled && (
                        <span className="text-[9px] font-extrabold px-1.5 py-px rounded-full"
                          style={{ color: 'var(--emerald)', background: 'rgba(52,211,153,.16)',
                            fontFamily: 'var(--font-display)', fontWeight: 500 }}>
                          ×2
                        </span>
                      )}
                      {e.leveledUp && e.level != null && (
                        <span className="text-[9px] font-extrabold px-1.5 py-px rounded-full"
                          style={{ color: 'var(--blue-2)', background: 'rgba(37,99,255,.20)',
                            fontFamily: 'var(--font-display)', fontWeight: 500 }}>
                          → Level {e.level}
                        </span>
                      )}
                    </p>
                  </div>
                  {tappable && <ChevronRight size={15} className="shrink-0" style={{ color: 'var(--text-faint)' }} />}
                  <div className="text-right shrink-0">
                    <div className="tabular-nums" style={{ fontSize: 14.5, fontWeight: 500,
                      color: e.xp < 0 ? 'var(--rose)' : 'var(--emerald)', fontFamily: 'var(--font-display)' }}>
                      {e.xp < 0 ? '' : '+'}{e.xp.toLocaleString('de-DE')}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {!loading && hasMore && filter === 'all' && (
        <button onClick={loadMore} disabled={loadingMore}
          className="press w-full mt-3 rounded-2xl py-3 text-[12px] font-bold flex items-center justify-center gap-2"
          style={{ color: 'var(--blue-2)', fontFamily: 'var(--font-display)', fontWeight: 500,
            background: 'linear-gradient(150deg,rgba(255,255,255,.10),rgba(255,255,255,.03))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.16), inset 0 0 0 .5px rgba(255,255,255,.06)' }}>
          {loadingMore ? <><Loader2 size={14} className="animate-spin" /> Lädt…</> : 'Mehr laden'}
        </button>
      )}

      {/* Detail popup — portal to body, above the sheet */}
      {detail.open && detail.entry && dm && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6" role="dialog" aria-modal="true">
          <div className="absolute inset-0" onClick={closeDetail}
            style={{ background: 'rgba(3,2,8,.7)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }} />
          <div className="relative w-full max-w-[320px] rounded-3xl p-6 text-center"
            style={{ background: 'linear-gradient(180deg,rgba(17,26,46,.97),rgba(11,18,32,.97))',
              boxShadow: '0 30px 70px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.1)',
              animation: 'xpPopIn .3s cubic-bezier(.2,1.2,.4,1)' }}>
            <button onClick={closeDetail} aria-label="Close"
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-xl flex items-center justify-center press"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}><X size={15} /></button>

            <div className="w-[60px] h-[60px] rounded-[18px] mx-auto mb-3.5 flex items-center justify-center"
              style={{ background: dm.bg, color: dm.color, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.2)' }}>
              <dm.Icon size={28} strokeWidth={1.9} />
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="eyebrow" style={{ color: 'var(--text-faint)' }}>{dm.label[lang]}</div>
              {detail.entry.doubled && (
                <span className="text-[9px] font-extrabold px-1.5 py-px rounded-full"
                  style={{ color: '#6EE7B7', background: 'rgba(52,211,153,.16)', fontFamily: 'var(--font-display)' }}>×2</span>
              )}
            </div>

            {detail.loading ? (
              <div className="flex justify-center py-5">
                <Loader2 size={20} className="animate-spin" style={{ color: dm.color }} />
              </div>
            ) : (
              <>
                <h3 className="display text-[19px] mt-1.5" style={{ color: 'var(--text-primary)' }}>
                  {detail.title ?? dm.label[lang]}
                </h3>
                <p className="text-[12.5px] mt-2.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {detail.description
                    ?? (detail.entry.source === 'achievement'
                        ? 'Unlocked before detailed tracking was enabled.'
                        : 'No description available for this entry.')}
                </p>
                <div className="flex gap-2.5 mt-4">
                  <div className="flex-1 rounded-2xl py-2.5 px-3" style={{ background: 'rgba(255,255,255,.04)', boxShadow: 'inset 0 1px 0 var(--edge-soft)' }}>
                    <div className="text-[9.5px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-faint)' }}>Reward</div>
                    <div className="display text-[14px] mt-0.5" style={{ color: '#34D399' }}>+{detail.entry.xp.toLocaleString('en-US')} XP</div>
                  </div>
                  <div className="flex-1 rounded-2xl py-2.5 px-3" style={{ background: 'rgba(255,255,255,.04)', boxShadow: 'inset 0 1px 0 var(--edge-soft)' }}>
                    <div className="text-[9.5px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-faint)' }}>When</div>
                    <div className="display text-[12.5px] mt-0.5" style={{ color: 'var(--text-primary)' }}>{fullWhen(detail.entry.createdAt)}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </BottomSheet>
  )
}
