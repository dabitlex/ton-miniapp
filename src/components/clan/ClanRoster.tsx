// src/components/clan/ClanRoster.tsx
// Roster als Beitrags-Leaderboard. Mitglieder kommen bereits nach
// contributedXp sortiert aus /api/v1/clans/my. Eigene Zeile hervorgehoben.
// ⋯-Management (promote/demote/kick) rollen-adaptiv, wired auf die manage-Route
// über den onManage-Callback der Seite.

'use client'
import { useState } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Crown, ChevronUp, ChevronDown, UserMinus, MoreHorizontal } from 'lucide-react'

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

// Welche Aktionen darf myRole auf target ausführen? (spiegelt manage/route.ts)
function actionsFor(myRole: string, myUserId: string, target: RosterMember): ManageAction[] {
  if (myRole === 'member') return []
  if (target.userId === myUserId) return []
  if (target.role === 'leader') return []
  if (myRole === 'officer') return target.role === 'member' ? ['kick'] : []
  // Leader:
  const acts: ManageAction[] = []
  if (target.role === 'member')  acts.push('promote')
  if (target.role === 'officer') acts.push('demote')
  acts.push('kick')
  return acts
}

export function ClanRoster({ members, myUserId, myRole, onManage, isManaging }: {
  members:    RosterMember[]
  myUserId:   string
  myRole:     'leader' | 'officer' | 'member'
  onManage:   (action: ManageAction, targetUserId: string) => void
  isManaging: boolean
}) {
  const [target, setTarget] = useState<RosterMember | null>(null)

  const maxXp = Math.max(1, ...members.map(m => m.contributedXp || 0))
  const onlineCount = members.filter(m => isOnline(m.lastActiveAt)).length
  const targetActions = target ? actionsFor(myRole, myUserId, target) : []

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
          const canMng  = actionsFor(myRole, myUserId, m).length > 0
          const rankCol = rank === 1 ? '#FBBF24' : rank === 2 ? '#C4B5FD' : rank === 3 ? '#FB923C' : 'var(--text-muted)'
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
                      style={{ background: 'linear-gradient(150deg,#A78BFA,#7C3AED)', color: '#0A0A12' }}>{initials(m)}</div>}
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
                    style={{ color: '#C4B5FD', background: 'rgba(139,92,246,0.28)', fontFamily: 'var(--font-display)' }}>YOU</span>}
                </div>
                <div className="h-[4px] rounded-full mt-1 overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#8B5CF6,#5EEAD4)' }} />
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-display font-extrabold text-[12px]" style={{ color: '#C4B5FD' }}>{(m.contributedXp || 0).toLocaleString()}</div>
                <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>season</div>
              </div>

              {canMng && (
                <button onClick={() => setTarget(m)} className="press p-1 shrink-0" aria-label="Manage member">
                  <MoreHorizontal size={17} style={{ color: 'var(--text-muted)' }} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Management-Sheet pro Mitglied */}
      <BottomSheet open={!!target} onClose={() => setTarget(null)} title={target ? displayName(target) : ''}>
        {target && (
          <div className="space-y-2">
            {targetActions.includes('promote') && (
              <ActionBtn icon={<ChevronUp size={16} />} label="Promote to officer" color="#34D399"
                disabled={isManaging} onClick={() => { onManage('promote', target.userId); setTarget(null) }} />
            )}
            {targetActions.includes('demote') && (
              <ActionBtn icon={<ChevronDown size={16} />} label="Demote to member" color="#93C5FD"
                disabled={isManaging} onClick={() => { onManage('demote', target.userId); setTarget(null) }} />
            )}
            {targetActions.includes('kick') && (
              <ActionBtn icon={<UserMinus size={16} />} label="Remove from clan" color="#FB7185"
                disabled={isManaging} onClick={() => { onManage('kick', target.userId); setTarget(null) }} />
            )}
          </div>
        )}
      </BottomSheet>
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
