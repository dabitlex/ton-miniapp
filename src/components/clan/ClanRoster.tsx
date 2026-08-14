// src/components/clan/ClanRoster.tsx
// Roster als Beitrags-Leaderboard. Mitglieder kommen bereits nach
// contributedXp sortiert aus /api/v1/clans/my. Eigene Zeile hervorgehoben.
// ⋯-Sheet (Leader/Officer): "View info" (zuletzt online / zuletzt für den Clan
// aktiv / beigetreten) + rollen-adaptives Management (promote/demote/kick).

'use client'
import { useState } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Crown, ChevronUp, ChevronDown, UserMinus, MoreHorizontal,
         Info, ChevronLeft, CalendarPlus, Clock, Activity } from 'lucide-react'

export interface RosterMember {
  userId:            string
  role:              'leader' | 'officer' | 'member'
  contributedXp:     number
  telegramFirstName?: string
  telegramUsername?:  string
  telegramPhotoUrl?:  string | null
  level?:            number
  lastActiveAt?:     string | null
}

interface MemberInfo {
  joinedAt:           string | null
  lastOnlineAt:       string | null
  lastClanActivityAt: string | null
}

type ManageAction = 'promote' | 'demote' | 'kick'

const ONLINE_MS = 5 * 60 * 1000 // "online" = in den letzten 5 Minuten aktiv

function isOnline(iso?: string | null) {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() < ONLINE_MS
}
function displayName(m: RosterMember) {
  return m.telegramFirstName || m.telegramUsername || 'Player'
}
function initials(m: RosterMember) {
  return (displayName(m)[0] ?? 'P').toUpperCase()
}
function formatWhen(iso: string | null): { rel: string; abs: string } {
  if (!iso) return { rel: 'Never', abs: '' }
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000), hrs = Math.floor(mins / 60), days = Math.floor(hrs / 24)
  let rel: string
  if (mins < 1)       rel = 'Just now'
  else if (mins < 60) rel = `${mins}m ago`
  else if (hrs < 24)  rel = `${hrs}h ago`
  else if (days < 7)  rel = `${days}d ago`
  else if (days < 30) rel = `${Math.floor(days / 7)}w ago`
  else                rel = `${Math.floor(days / 30)}mo ago`
  const abs = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return { rel, abs }
}

// Welche Aktionen darf myRole auf target ausführen? (spiegelt manage/route.ts)
function actionsFor(myRole: string, myUserId: string, target: RosterMember): ManageAction[] {
  if (myRole === 'member') return []
  if (target.userId === myUserId) return []
  if (target.role === 'leader') return []
  if (myRole === 'officer') return target.role === 'member' ? ['kick'] : []
  const acts: ManageAction[] = []
  if (target.role === 'member')  acts.push('promote')
  if (target.role === 'officer') acts.push('demote')
  acts.push('kick')
  return acts
}

export function ClanRoster({ members, myUserId, myRole, clanId, onManage, isManaging }: {
  members:    RosterMember[]
  myUserId:   string
  myRole:     'leader' | 'officer' | 'member'
  clanId:     string
  onManage:   (action: ManageAction, targetUserId: string) => void
  isManaging: boolean
}) {
  const token = useAuthStore(s => s.accessToken)
  const [target, setTarget]   = useState<RosterMember | null>(null)
  const [mode, setMode]       = useState<'actions' | 'info'>('actions')
  const [info, setInfo]       = useState<MemberInfo | null>(null)
  const [infoLoading, setInfoLoading] = useState(false)

  const canViewInfo = myRole === 'leader' || myRole === 'officer'
  const maxXp = Math.max(1, ...members.map(m => m.contributedXp || 0))
  const onlineCount = members.filter(m => isOnline(m.lastActiveAt)).length
  const targetActions = target ? actionsFor(myRole, myUserId, target) : []

  function openSheet(m: RosterMember) { setTarget(m); setMode('actions'); setInfo(null) }
  function closeSheet() { setTarget(null); setMode('actions'); setInfo(null) }

  async function loadInfo(m: RosterMember) {
    setMode('info'); setInfo(null); setInfoLoading(true)
    try {
      const res  = await fetch(`/api/v1/clans/${clanId}/members/${m.userId}/info`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success) setInfo(json.data as MemberInfo)
    } catch { /* leise */ }
    setInfoLoading(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between px-1 mb-1.5">
        <span className="eyebrow" style={{ color: 'var(--text-muted)' }}>{members.length} members · contribution</span>
        <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          <span className="w-[6px] h-[6px] rounded-full" style={{ background: '#34D399' }} /> {onlineCount} online
        </span>
      </div>

      <div className="space-y-1">
        {members.map((m, i) => {
          const mine    = m.userId === myUserId
          const rank    = i + 1
          const online  = isOnline(m.lastActiveAt)
          const pct     = Math.round(((m.contributedXp || 0) / maxXp) * 100)
          const rankCol = rank === 1 ? 'var(--gold)' : rank === 2 ? 'var(--text-secondary)' : rank === 3 ? '#FFB27A' : 'var(--text-muted)'
          return (
            <div key={m.userId} className="flex items-center gap-2.5 px-2 py-2 rounded-2xl"
              style={mine ? {
                background: 'linear-gradient(155deg, rgba(139,92,246,0.2), rgba(91,141,239,0.06))',
                boxShadow:  'inset 0 1px 0 rgba(167,139,250,0.24)',
              } : {}}>
              <div className="w-5 text-center font-display font-extrabold text-[13px] shrink-0" style={{ color: rankCol }}>{rank}</div>

              <div className="relative shrink-0">
                {m.telegramPhotoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={m.telegramPhotoUrl} alt="" className="w-[34px] h-[34px] rounded-full object-cover" />
                  : <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-display font-bold text-[13px]"
                      style={{ background: 'linear-gradient(140deg,#7BA5FF,#1D4ED8)', color: '#fff', fontWeight: 500 }}>{initials(m)}</div>}
                <span className="absolute bottom-0 right-0 w-[9px] h-[9px] rounded-full"
                  style={{ background: online ? '#34D399' : 'rgba(255,255,255,0.22)', border: '2px solid var(--bg-void)' }} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[13px] truncate" style={{ color: 'var(--text-primary)' }}>{displayName(m)}</span>
                  {m.role === 'leader'  && <Crown size={12} style={{ color: '#FBBF24', flexShrink: 0 }} />}
                  {m.role === 'officer' && <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ color: '#93C5FD', background: 'rgba(91,141,239,0.18)', fontFamily: 'var(--font-display)' }}>OFFICER</span>}
                  {mine && <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ color: '#fff', background: 'rgba(37,99,255,0.55)', fontFamily: 'var(--font-display)', fontWeight: 500 }}>DU</span>}
                </div>
                <div className="h-[4px] rounded-full mt-1 overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#7BA5FF,#2563FF)' }} />
                </div>
              </div>

              <div className="text-right shrink-0">
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 12.5, fontWeight: 500, color: 'var(--blue-2)' }}>{(m.contributedXp || 0).toLocaleString('de-DE')}</div>
                <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>season</div>
              </div>

              {canViewInfo && (
                <button onClick={() => openSheet(m)} className="press p-1 shrink-0" aria-label="Member options">
                  <MoreHorizontal size={17} style={{ color: 'var(--text-muted)' }} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <BottomSheet open={!!target} onClose={closeSheet} title={target ? displayName(target) : ''}>
        {target && mode === 'actions' && (
          <div className="space-y-2">
            {canViewInfo && (
              <ActionBtn icon={<Info size={16} />} label="Infos ansehen" color="var(--text-primary)"
                onClick={() => loadInfo(target)} />
            )}
            {targetActions.includes('promote') && (
              <ActionBtn icon={<ChevronUp size={16} />} label="Zum Officer befördern" color="var(--emerald)"
                disabled={isManaging} onClick={() => { onManage('promote', target.userId); closeSheet() }} />
            )}
            {targetActions.includes('demote') && (
              <ActionBtn icon={<ChevronDown size={16} />} label="Zum Mitglied zurückstufen" color="var(--blue-3)"
                disabled={isManaging} onClick={() => { onManage('demote', target.userId); closeSheet() }} />
            )}
            {targetActions.includes('kick') && (
              <ActionBtn icon={<UserMinus size={16} />} label="Aus dem Clan entfernen" color="var(--rose)"
                disabled={isManaging} onClick={() => { onManage('kick', target.userId); closeSheet() }} />
            )}
          </div>
        )}

        {target && mode === 'info' && (
          <div>
            <button onClick={() => setMode('actions')}
              className="press flex items-center gap-1 mb-3 text-[12px] font-bold"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
              <ChevronLeft size={15} /> Zurück
            </button>
            {infoLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'rgba(255,255,255,0.12)', borderTopColor: 'var(--blue-2)' }} />
              </div>
            ) : (
              <div className="space-y-2">
                <InfoRow icon={<Clock size={15} />}        label="Last online"        iso={info?.lastOnlineAt ?? null} />
                <InfoRow icon={<Activity size={15} />}     label="Last clan activity" iso={info?.lastClanActivityAt ?? null} />
                <InfoRow icon={<CalendarPlus size={15} />} label="Joined clan"        iso={info?.joinedAt ?? null} />
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  )
}

function InfoRow({ icon, label, iso }: { icon: React.ReactNode; label: string; iso: string | null }) {
  const { rel, abs } = formatWhen(iso)
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{ background: 'var(--surface-1)', boxShadow: 'inset 0 1px 0 var(--edge-light)' }}>
      <span style={{ color: 'var(--violet-bright)' }}>{icon}</span>
      <span className="text-[13px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <div className="ml-auto text-right">
        <div className="text-[13px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{rel}</div>
        {abs && <div className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{abs}</div>}
      </div>
    </div>
  )
}

function ActionBtn({ icon, label, color, onClick, disabled }: {
  icon: React.ReactNode; label: string; color: string; onClick: () => void; disabled?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="press w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl disabled:opacity-40"
      style={{ color, background: 'var(--surface-1)', boxShadow: 'inset 0 1px 0 var(--edge-light)',
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13.5 }}>
      {icon} {label}
    </button>
  )
}
