// src/app/(game)/clans/page.tsx — Redesigned (Aurora OS · Social Hub)
'use client'
import { useState, useEffect }                          from 'react'
import { useQuery, useMutation, useQueryClient }        from '@tanstack/react-query'
import { useAuthStore }   from '@/stores/useAuthStore'
import { useUserStore }   from '@/stores/useUserStore'
import { useUIStore }     from '@/stores/useUIStore'
import { useEnergyStore } from '@/stores/useEnergyStore'
import { Button }         from '@/components/ui/Button'
import { SkeletonCard }   from '@/components/ui/Skeleton'
import { ClanChatCard }   from '@/components/clan/ClanChatCard'
import { ClanJoinRequests }    from '@/components/clan/ClanJoinRequests'
import { PendingRequestBanner } from '@/components/clan/PendingRequestBanner'
import { ClanPolicyToggle }     from '@/components/clan/ClanPolicyToggle'
import { ClanEditSheet }        from '@/components/clan/ClanEditSheet'
import { cn, formatNumber } from '@/lib/utils'
import { GAME_CONSTANTS } from '@/lib/constants/game'
import { Users, Search, Shield, LogOut, Swords, Zap, Star, Crown, Sword, ChevronRight, Pencil } from 'lucide-react'
import type { UserProfile } from '@/types/game'
import { v4 as uuidv4 }  from 'uuid'

type Tab = 'browse' | 'mine' | 'missions' | 'create'

export default function ClansPage() {
  const [view, setView]     = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('tab')
      if (t === 'mine' || t === 'browse' || t === 'missions' || t === 'create') return t
    }
    return 'browse'
  })
  const [editOpen, setEditOpen] = useState(false)

  // Fallback: beim Mounten den ?tab=-Parameter anwenden (z.B. Rücknavigation
  // aus dem Clan-Chat -> /clans?tab=mine). Greift auch, falls der State-
  // Initializer das Timing der URL-Aktualisierung verpasst.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t === 'mine' || t === 'browse' || t === 'missions' || t === 'create') {
      setView(t as Tab)
    }
  }, [])
  const [search, setSearch] = useState('')
  const token               = useAuthStore(s => s.accessToken)
  const profile             = useUserStore(s => s.profile)
  const { setProfile }      = useUserStore()
  const { toast, haptic }   = useUIStore()
  const qc                  = useQueryClient()
  const headers             = { Authorization: `Bearer ${token}` }

  const refreshProfile = async () => {
    if (!token) return
    try {
      const res  = await fetch('/api/v1/users/me', { headers })
      const json = await res.json()
      if (json.success) setProfile(json.data as UserProfile)
    } catch { /* silent */ }
  }

  const { data: myMembership, isLoading: loadingMembership } = useQuery({
    queryKey: ['my-membership'],
    enabled:  !!token,
    staleTime: 30_000,
    queryFn:  async () => {
      const res  = await fetch('/api/v1/clans/my', { headers })
      const json = await res.json()
      return json.success ? json.data : null
    },
  })

  const { data: clansData, isLoading: loadingClans } = useQuery({
    queryKey: ['clans', search],
    enabled:  !!token,
    staleTime: 60_000,
    queryFn:  async () => {
      const params = new URLSearchParams({ limit: '20' })
      if (search) params.set('q', search)
      const res  = await fetch(`/api/v1/clans?${params}`, { headers })
      const json = await res.json()
      return json.success ? json.data : []
    },
  })

  const { data: missions, isLoading: loadingMissions } = useQuery({
    queryKey: ['clan-missions', myMembership?.clan?.id],
    enabled:  !!token && !!myMembership?.clan?.id && view === 'missions',
    staleTime: 60_000,
    queryFn:  async () => {
      const res  = await fetch(`/api/v1/clans/${myMembership.clan.id}/missions`, { headers })
      const json = await res.json()
      return json.success ? json.data : []
    },
  })

  function formatLastActive(lastActiveAt: string | null): string {
    if (!lastActiveAt) return 'Never'
    const diff = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 86400000)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    if (diff < 7)   return `${diff}d ago`
    if (diff < 30)  return `${Math.floor(diff / 7)}w ago`
    return `${Math.floor(diff / 30)}mo ago`
  }

  function isInactive(lastActiveAt: string | null): boolean {
    if (!lastActiveAt) return true
    return (Date.now() - new Date(lastActiveAt).getTime()) > 7 * 86400000
  }

  const hasClan   = !!myMembership?.clan
  const myRole    = myMembership?.role ?? 'member'
  const isLeader  = myRole === 'leader'
  const isOfficer = myRole === 'officer'
  const canManage = isLeader || isOfficer

  const { mutate: manageMember, isPending: isManaging } = useMutation({
    mutationFn: async ({ action, targetUserId }: {
      action: 'kick' | 'promote' | 'demote'
      targetUserId: string
    }) => {
      const res = await fetch(`/api/v1/clans/${myMembership!.clan.id}/manage`, {
        method:  'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action, targetUserId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: (_, { action }) => {
      const msgs = {
        kick:    '✅ Member removed',
        promote: '✅ Promoted to Officer',
        demote:  '✅ Demoted to Member',
      }
      toast('success', msgs[action])
      qc.invalidateQueries({ queryKey: ['my-membership'] })
    },
    onError: (e: Error) => toast('error', e.message),
  })

  const canCreate = (profile?.level ?? 0) >= GAME_CONSTANTS.CLAN_UNLOCK_LEVEL

  const invalidateAll = async () => {
    await refreshProfile()
    qc.invalidateQueries({ queryKey: ['my-membership'] })
    qc.invalidateQueries({ queryKey: ['clans'] })
    qc.invalidateQueries({ queryKey: ['my-request'] })
  }

  // Eigene offene Beitrittsanfrage (für "Requested"-Zustand in Discover).
  const { data: myRequestData } = useQuery({
    queryKey: ['my-request'],
    enabled:  !!token,
    staleTime: 20_000,
    queryFn: async () => {
      const res  = await fetch('/api/v1/clans/my-request', { headers })
      const json = await res.json()
      return json.success ? json.data : { request: null }
    },
  })
  const myRequestClanId: string | null = myRequestData?.request?.clanId ?? null

  const { mutate: joinClan, isPending: joining } = useMutation({
    mutationFn: async (clanId: string) => {
      const res  = await fetch(`/api/v1/clans/${clanId}/join`, { method: 'POST', headers })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: async (data: any) => {
      if (data?.requested) {
        toast(data.alreadyPending ? 'info' : 'success',
          data.alreadyPending ? 'Request already pending' : 'Request sent')
        haptic('light')
        await invalidateAll()
        return
      }
      toast('success', '🎉 Joined clan!')
      haptic('success')
      await invalidateAll()
      setView('mine')
    },
    onError: (e: Error) => { toast('error', e.message); haptic('error') },
  })

  const { mutate: leaveClan, isPending: leaving } = useMutation({
    mutationFn: async (clanId: string) => {
      const res  = await fetch(`/api/v1/clans/${clanId}/leave`, { method: 'POST', headers })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: async () => {
      toast('info', 'Left clan')
      await invalidateAll()
      setView('browse')
    },
    onError: (e: Error) => { toast('error', e.message) },
  })

  const { mutate: completeMission, isPending: completing, variables: completingId } = useMutation({
    mutationFn: async (missionId: string) => {
      const res  = await fetch(`/api/v1/clans/${myMembership.clan.id}/missions`, {
        method:  'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ missionId, nonce: uuidv4() }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: (data) => {
      toast('success', `+${data.xpGranted} XP · Clan +${data.xpClanReward} XP`)
      haptic('success')
      if (data.energyAfter !== undefined) {
        useEnergyStore.setState(s => ({ ...s, current: data.energyAfter }))
      }
      qc.invalidateQueries({ queryKey: ['clan-missions'] })
      qc.invalidateQueries({ queryKey: ['my-membership'] })
    },
    onError: (e: Error) => { toast('error', e.message); haptic('error') },
  })

  const TABS = [
    { key: 'browse',   label: 'Discover',   icon: Search },
    { key: 'mine',     label: 'My Clan',    icon: Shield },
    ...(hasClan ? [{ key: 'missions' as Tab, label: 'Missions', icon: Swords }] : []),
    { key: 'create',   label: 'Create',     icon: null },
  ] as const

  function clanInitials(name: string) {
    return (name?.trim()?.slice(0, 2) ?? '🛡').toUpperCase()
  }

  return (
    <div className="flex flex-col h-full relative z-10">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pt-4 pb-3 animate-rise">
        <h1 className="display-xl text-[24px] text-white leading-none">Clans</h1>
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>Team up · earn together</p>
      </div>

      {/* ── Segmented tabs ─────────────────────────────────────── */}
      <div className="shrink-0 px-5 pb-3 animate-rise" style={{ animationDelay: '50ms' }}>
        <div className="flex p-1 rounded-2xl gap-1" style={{ background: 'var(--surface-press)' }}>
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = view === key
            return (
              <button key={key} onClick={() => setView(key as Tab)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl press transition-all"
                style={{
                  background: active ? 'var(--surface-2)' : 'transparent',
                  boxShadow: active ? 'inset 0 1px 0 var(--edge-light), var(--shadow-sm)' : 'none',
                }}>
                {Icon && <Icon size={13} style={{ color: active ? 'var(--violet-bright)' : 'var(--text-faint)' }} />}
                <span className="text-[12px] font-bold" style={{ color: active ? 'white' : 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-3">

        {/* ── DISCOVER ─────────────────────────────────────────── */}
        {view === 'browse' && (
          <>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search clans…"
                className="w-full rounded-2xl pl-10 pr-3 py-3 text-sm text-white placeholder-white/25 focus:outline-none"
                style={{ background: 'var(--surface-1)', boxShadow: 'inset 0 1px 0 var(--edge-light)' }} />
            </div>

            {loadingClans
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={1} />)
              : (clansData ?? []).length === 0
              ? (
                <div className="text-center py-12 space-y-2">
                  <p className="text-4xl">🏰</p>
                  <p className="display text-sm" style={{ color: 'var(--text-secondary)' }}>No clans yet</p>
                  <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Be the first to forge one</p>
                </div>
              )
              : (clansData ?? []).map((clan: any, i: number) => (
                <div key={clan.id} className="surface p-3.5 flex items-center gap-3.5 animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="flex items-center justify-center w-12 h-12 rounded-2xl shrink-0 overflow-hidden display text-base text-white"
                    style={{ background: 'var(--aurora)', boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }}>
                    {clan.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={clan.avatar_url} alt="" className="w-full h-full object-cover" />
                      : clanInitials(clan.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white text-sm truncate">{clan.name}</p>
                      <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded-md" style={{ color: 'var(--violet-bright)', background: 'rgba(139,92,246,0.14)', fontFamily: 'var(--font-display)' }}>Lv {clan.level}</span>
                    </div>
                    {clan.description && <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{clan.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                      <span className="flex items-center gap-1"><Users size={11} /> {clan.member_count}/20</span>
                      <span>⭐ {formatNumber(clan.season_xp)}</span>
                    </div>
                  </div>
                  {!hasClan
                    ? (myRequestClanId === clan.id
                        ? <span className="text-[10px] font-extrabold px-2.5 py-1.5 rounded-xl shrink-0" style={{ color: 'var(--gold)', background: 'var(--gold-dim)', fontFamily: 'var(--font-display)' }}>REQUESTED</span>
                        : <Button size="sm" loading={joining} onClick={() => joinClan(clan.id)} className="h-9 text-xs px-4 shrink-0">
                            {clan.join_policy === 'request' ? 'Request' : 'Join'}
                          </Button>)
                    : myMembership?.clan?.id === clan.id &&
                      <span className="text-[10px] font-extrabold px-2.5 py-1.5 rounded-xl shrink-0" style={{ color: 'var(--violet-bright)', background: 'rgba(139,92,246,0.14)', fontFamily: 'var(--font-display)' }}>YOURS</span>
                  }
                </div>
              ))
            }
          </>
        )}

        {/* ── MY CLAN ──────────────────────────────────────────── */}
        {view === 'mine' && (
          <>
            {loadingMembership ? <SkeletonCard lines={3} />
             : !hasClan ? (
              <>
                <PendingRequestBanner />
                <div className="text-center py-12 space-y-3">
                  <Shield size={48} className="mx-auto" style={{ color: 'var(--text-ultra)' }} />
                  <p className="display text-sm" style={{ color: 'var(--text-secondary)' }}>You're not in a clan yet</p>
                  <div className="flex gap-2 justify-center pt-1">
                    <Button size="sm" variant="secondary" onClick={() => setView('browse')}>Discover</Button>
                    {canCreate && <Button size="sm" onClick={() => setView('create')}>Create</Button>}
                  </div>
                </div>
              </>
             ) : myMembership && (
              <>
                {/* Clan banner */}
                <div className="surface-accent relative overflow-hidden p-5 animate-rise">
                  <div className="absolute -top-10 -right-8 w-40 h-40 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.28), transparent 70%)' }} />
                  {isLeader && (
                    <button onClick={() => setEditOpen(true)} aria-label="Edit clan"
                      className="press absolute top-3 right-3 z-10 w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: 'var(--surface-2)', boxShadow: 'inset 0 1px 0 var(--edge-light)' }}>
                      <Pencil size={15} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                  )}
                  <div className="relative flex items-start gap-4">
                    <div className="flex items-center justify-center w-16 h-16 rounded-3xl shrink-0 overflow-hidden display-xl text-xl text-white"
                      style={{ background: 'var(--aurora)', boxShadow: '0 8px 24px rgba(124,58,237,0.4)' }}>
                      {myMembership.clan.avatarUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={myMembership.clan.avatarUrl} alt="" className="w-full h-full object-cover" />
                        : clanInitials(myMembership.clan.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="display text-[18px] text-white truncate">{myMembership.clan.name}</p>
                        <span className="text-[10px] font-bold shrink-0" style={{ color: 'var(--violet-bright)' }}>
                          {myMembership.role === 'leader' ? '👑' : myMembership.role === 'officer' ? '⚔️' : '🎮'}
                        </span>
                      </div>
                      {myMembership.clan.description && (
                        <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{myMembership.clan.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="relative grid grid-cols-3 gap-2 mt-4">
                    {[
                      { label: 'Season XP', value: formatNumber(myMembership.clan.seasonXp), tint: '#A78BFA' },
                      { label: 'Members',   value: `${myMembership.clan.memberCount}/20`,     tint: '#5B8DEF' },
                      { label: 'Wins',      value: `${myMembership.clan.wins}`,               tint: '#FBBF24' },
                    ].map(s => (
                      <div key={s.label} className="rounded-2xl px-2 py-2.5 text-center" style={{ background: 'var(--surface-press)' }}>
                        <p className="display text-[15px] tabular-nums" style={{ color: s.tint }}>{s.value}</p>
                        <p className="text-[9px] font-semibold mt-0.5" style={{ color: 'var(--text-faint)' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Clan Chat shortcut */}
                <ClanChatCard />

                {/* Missions shortcut */}
                <button onClick={() => setView('missions')}
                  className="surface w-full flex items-center gap-3 px-4 py-3.5 press">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0" style={{ background: 'rgba(139,92,246,0.14)' }}>
                    <Swords size={17} style={{ color: 'var(--violet-bright)' }} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-white">Clan Missions</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>3 daily · 15⚡ · earns Clan XP</p>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--text-faint)' }} />
                </button>

                {/* Join policy (Leader) + Beitrittsanfragen (Leader/Officer) */}
                {isLeader  && <ClanPolicyToggle  clanId={myMembership.clan.id} />}
                {canManage && <ClanJoinRequests  clanId={myMembership.clan.id} />}
                {isLeader  && <ClanEditSheet clanId={myMembership.clan.id} open={editOpen} onClose={() => setEditOpen(false)} />}

                {/* Members */}
                <div className="space-y-2">
                  <h3 className="eyebrow">Roster · {(myMembership.members ?? []).length}</h3>

                  {(myMembership.members ?? []).map((m: any) => {
                    const isMe           = m.userId === profile?.id
                    const isTargetLeader = m.role === 'leader'
                    const canKick        = canManage && !isMe && !isTargetLeader && (isLeader || m.role === 'member')
                    const canPromote     = isLeader && !isMe && m.role === 'member'
                    const canDemote      = isLeader && !isMe && m.role === 'officer'
                    const inactive       = isInactive(m.lastActiveAt ?? null)

                    return (
                      <div key={m.userId} className="surface flex items-center gap-3 px-3.5 py-3">
                        {m.telegramPhotoUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={m.telegramPhotoUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                          : <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: 'var(--aurora)' }}>
                              {m.telegramFirstName?.[0] ?? '?'}
                            </div>
                        }
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{m.telegramFirstName}</p>
                            {isMe && <span className="text-[8px] font-extrabold shrink-0" style={{ color: 'var(--violet-bright)' }}>YOU</span>}
                            {m.role === 'leader'  && <Crown size={11} className="shrink-0" style={{ color: '#FBBF24' }} />}
                            {m.role === 'officer' && <Sword size={11} className="shrink-0" style={{ color: 'var(--violet-bright)' }} />}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>Lv.{m.level} · ⭐ {formatNumber(m.contributedXp ?? 0)}</p>
                            <span className="text-[10px]" style={{ color: inactive ? '#FB7185' : 'var(--text-faint)' }}>· {formatLastActive(m.lastActiveAt ?? null)}</span>
                          </div>
                        </div>
                        {(canKick || canPromote || canDemote) && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {canPromote && (
                              <button onClick={() => manageMember({ action: 'promote', targetUserId: m.userId })} disabled={isManaging}
                                title="Promote to Officer" className="w-7 h-7 rounded-lg flex items-center justify-center press disabled:opacity-40"
                                style={{ background: 'rgba(139,92,246,0.15)', boxShadow: 'inset 0 0 0 1px rgba(139,92,246,0.3)' }}>
                                <Sword size={12} style={{ color: 'var(--violet-bright)' }} />
                              </button>
                            )}
                            {canDemote && (
                              <button onClick={() => manageMember({ action: 'demote', targetUserId: m.userId })} disabled={isManaging}
                                title="Demote to Member" className="w-7 h-7 rounded-lg flex items-center justify-center press disabled:opacity-40"
                                style={{ background: 'rgba(245,158,11,0.12)', boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.25)' }}>
                                <span className="text-[11px]">🎮</span>
                              </button>
                            )}
                            {canKick && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Remove ${m.telegramFirstName} from the clan?`)) {
                                    manageMember({ action: 'kick', targetUserId: m.userId })
                                  }
                                }}
                                disabled={isManaging} title="Kick member"
                                className="w-7 h-7 rounded-lg flex items-center justify-center press disabled:opacity-40"
                                style={{ background: 'rgba(244,63,94,0.12)', boxShadow: 'inset 0 0 0 1px rgba(244,63,94,0.25)' }}>
                                <span className="text-[12px] font-bold" style={{ color: '#FB7185' }}>✕</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <Button variant="destructive" fullWidth loading={leaving}
                  onClick={() => { if (window.confirm('Leave this clan?')) leaveClan(myMembership.clan.id) }}>
                  <LogOut size={14} /> Leave Clan
                </Button>
              </>
            )}
          </>
        )}

        {/* ── MISSIONS ─────────────────────────────────────────── */}
        {view === 'missions' && hasClan && (
          <>
            <div className="surface-quiet px-3.5 py-3" style={{ background: 'rgba(139,92,246,0.06)' }}>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                🛡️ Complete clan missions to support your clan with XP. Cost: <span style={{ color: '#FBBF24' }}>15⚡</span> each.
              </p>
            </div>

            {loadingMissions
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={1} />)
              : (missions ?? []).length === 0
              ? (
                <div className="text-center py-12">
                  <Swords size={40} className="mx-auto mb-2" style={{ color: 'var(--text-ultra)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No missions available</p>
                </div>
              )
              : (missions ?? []).map((m: any) => (
                <div key={m.id} className="surface p-4" style={{ opacity: m.status === 'completed' ? 0.6 : 1 }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ background: m.status === 'completed' ? 'rgba(52,211,153,0.12)' : 'var(--surface-2)' }}>
                      {m.status === 'completed' ? '✓' : (m.template.iconKey ?? '⚔️')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.template.title}</p>
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{m.template.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-faint)' }}>
                        <span className="flex items-center gap-1"><Zap size={10} style={{ color: '#FBBF24' }} fill="currentColor" />{m.energyCost}</span>
                        <span className="flex items-center gap-1"><Star size={10} style={{ color: 'var(--violet-bright)' }} fill="currentColor" />+{m.xpReward}</span>
                        <span className="flex items-center gap-1"><Shield size={10} style={{ color: '#5B8DEF' }} />Clan +{m.xpClanReward}</span>
                      </div>
                    </div>
                  </div>

                  {m.status !== 'completed' ? (
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" loading={completing && completingId === m.id} onClick={() => completeMission(m.id)} className="h-8 text-[11px] px-4">
                        Complete
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 text-right text-xs" style={{ color: 'var(--emerald)' }}>✓ Completed</p>
                  )}
                </div>
              ))
            }
          </>
        )}

        {/* ── CREATE ───────────────────────────────────────────── */}
        {view === 'create' && (
          <CreateClanForm
            canCreate={canCreate}
            hasClan={hasClan}
            userLevel={profile?.level ?? 1}
            token={token ?? ''}
            onCreated={async () => { await invalidateAll(); setView('mine') }}
          />
        )}
      </div>
    </div>
  )
}

// ── Create Clan Form ──────────────────────────────────────────
function CreateClanForm({ canCreate, hasClan, userLevel, token, onCreated }: {
  canCreate: boolean
  hasClan:   boolean
  userLevel: number
  token:     string
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const { toast, haptic } = useUIStore()

  const { mutate: create, isPending } = useMutation({
    mutationFn: async () => {
      const res  = await fetch('/api/v1/clans', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), description: desc.trim() }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: () => {
      toast('success', '🛡️ Clan created!')
      haptic('heavy')
      onCreated()
    },
    onError: (e: Error) => { toast('error', e.message); haptic('error') },
  })

  if (hasClan) return (
    <div className="text-center py-12 space-y-2">
      <Shield size={48} className="mx-auto" style={{ color: 'var(--text-ultra)' }} />
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>You're already in a clan</p>
    </div>
  )

  if (!canCreate) return (
    <div className="surface p-6 text-center space-y-2">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl mx-auto text-2xl"
        style={{ background: 'var(--surface-2)' }}>🔒</div>
      <p className="display text-sm text-white">Level {GAME_CONSTANTS.CLAN_UNLOCK_LEVEL} required</p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {GAME_CONSTANTS.CLAN_UNLOCK_LEVEL - userLevel} more level{GAME_CONSTANTS.CLAN_UNLOCK_LEVEL - userLevel === 1 ? '' : 's'} to go
      </p>
    </div>
  )

  return (
    <div className="space-y-4 animate-rise">
      <div className="surface-accent p-5 text-center">
        <div className="flex items-center justify-center w-14 h-14 rounded-3xl mx-auto display-xl text-xl text-white"
          style={{ background: 'var(--aurora)', boxShadow: '0 8px 24px rgba(124,58,237,0.4)' }}>
          {clanCrest(name)}
        </div>
        <p className="display text-sm text-white mt-3">Forge your clan</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Recruit up to 20 members and climb together</p>
      </div>

      <div className="space-y-1.5">
        <label className="eyebrow">Clan Name *</label>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Crypto Warriors" maxLength={32}
          className="w-full rounded-2xl px-3.5 py-3 text-sm text-white placeholder-white/25 focus:outline-none"
          style={{ background: 'var(--surface-1)', boxShadow: 'inset 0 1px 0 var(--edge-light)' }} />
        <p className="text-[10px] text-right" style={{ color: 'var(--text-faint)' }}>{name.length}/32</p>
      </div>

      <div className="space-y-1.5">
        <label className="eyebrow">Description</label>
        <textarea value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="What does your clan stand for?" maxLength={200} rows={3}
          className="w-full rounded-2xl px-3.5 py-3 text-sm text-white placeholder-white/25 focus:outline-none resize-none"
          style={{ background: 'var(--surface-1)', boxShadow: 'inset 0 1px 0 var(--edge-light)' }} />
      </div>

      <Button fullWidth size="lg" loading={isPending} disabled={name.trim().length < 3} onClick={() => create()}>
        <Shield size={16} /> Create Clan
      </Button>
    </div>
  )
}

function clanCrest(name: string) {
  const t = name.trim()
  return t ? t.slice(0, 2).toUpperCase() : '🛡'
}
