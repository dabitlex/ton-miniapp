// src/app/(game)/clans/page.tsx
'use client'
import { useState }                                     from 'react'
import { useQuery, useMutation, useQueryClient }        from '@tanstack/react-query'
import { useAuthStore }   from '@/stores/useAuthStore'
import { useUserStore }   from '@/stores/useUserStore'
import { useUIStore }     from '@/stores/useUIStore'
import { useEnergyStore } from '@/stores/useEnergyStore'
import { Button }         from '@/components/ui/Button'
import { SkeletonCard }   from '@/components/ui/Skeleton'
import { cn, formatNumber } from '@/lib/utils'
import { GAME_CONSTANTS } from '@/lib/constants/game'
import { Users, Search, Shield, LogOut, Swords, Zap, Star } from 'lucide-react'
import type { UserProfile } from '@/types/game'
import { v4 as uuidv4 }  from 'uuid'

type Tab = 'browse' | 'mine' | 'missions' | 'create'

export default function ClansPage() {
  const [view, setView]     = useState<Tab>('browse')
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
    staleTime:30_000,
    queryFn:  async () => {
      const res  = await fetch('/api/v1/clans/my', { headers })
      const json = await res.json()
      return json.success ? json.data : null
    },
  })

  const { data: clansData, isLoading: loadingClans } = useQuery({
    queryKey: ['clans', search],
    enabled:  !!token,
    staleTime:60_000,
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
    staleTime:60_000,
    queryFn:  async () => {
      const res  = await fetch(`/api/v1/clans/${myMembership.clan.id}/missions`, { headers })
      const json = await res.json()
      return json.success ? json.data : []
    },
  })

  const hasClan   = !!myMembership?.clan
  const canCreate = (profile?.level ?? 0) >= GAME_CONSTANTS.CLAN_UNLOCK_LEVEL

  const invalidateAll = async () => {
    await refreshProfile()
    qc.invalidateQueries({ queryKey: ['my-membership'] })
    qc.invalidateQueries({ queryKey: ['clans'] })
  }

  const { mutate: joinClan, isPending: joining } = useMutation({
    mutationFn: async (clanId: string) => {
      const res  = await fetch(`/api/v1/clans/${clanId}/join`, { method: 'POST', headers })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: async () => {
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
      // Immediately update energy in store
      if (data.energyAfter !== undefined) {
        useEnergyStore.setState(s => ({ ...s, current: data.energyAfter }))
      }
      qc.invalidateQueries({ queryKey: ['clan-missions'] })
      qc.invalidateQueries({ queryKey: ['my-membership'] })
    },
    onError: (e: Error) => { toast('error', e.message); haptic('error') },
  })

  const TABS = [
    { key: 'browse',   label: 'Discover', icon: Search  },
    { key: 'mine',     label: 'My Clan', icon: Shield  },
    ...(hasClan ? [{ key: 'missions', label: 'Missions', icon: Swords }] : []),
    { key: 'create',   label: '+',         icon: null    },
  ] as const

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-white/[0.06] shrink-0 px-4">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setView(key as Tab)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-3',
              'text-xs font-semibold transition-colors relative',
              view === key ? 'text-violet-300' : 'text-white/35'
            )}>
            {Icon && <Icon size={12} />}
            {label}
            {view === key && (
              <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-violet-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6 space-y-3">

        {/* ── ENTDECKEN ────────────────────────────── */}
        {view === 'browse' && (
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search clans…"
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl
                           pl-8 pr-3 py-2.5 text-sm text-white placeholder-white/25
                           focus:outline-none focus:border-violet-500/50" />
            </div>
            {loadingClans
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={1} />)
              : (clansData ?? []).length === 0
              ? <div className="text-center py-10 space-y-2">
                  <p className="text-3xl">🏰</p>
                  <p className="text-sm text-white/40">No clans yet</p>
                  <p className="text-xs text-white/25">Create the first clan!</p>
                </div>
              : (clansData ?? []).map((clan: any) => (
                <div key={clan.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-bold text-white text-sm truncate">{clan.name}</p>
                        <span className="text-[10px] text-white/30 shrink-0">Lv.{clan.level}</span>
                      </div>
                      {clan.description && <p className="text-xs text-white/35 line-clamp-1">{clan.description}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-white/30">
                        <span className="flex items-center gap-1"><Users size={10} /> {clan.member_count}/20</span>
                        <span>⭐ {formatNumber(clan.season_xp)} XP</span>
                      </div>
                    </div>
                    {!hasClan
                      ? <Button size="sm" loading={joining} onClick={() => joinClan(clan.id)}
                          className="h-8 text-xs px-3 shrink-0">Join</Button>
                      : myMembership?.clan?.id === clan.id &&
                        <span className="text-[10px] font-bold text-violet-400 border border-violet-500/30
                                         bg-violet-500/10 px-2 py-1 rounded-lg shrink-0">YOUR CLAN</span>
                    }
                  </div>
                </div>
              ))
            }
          </>
        )}

        {/* ── MEIN CLAN ────────────────────────────── */}
        {view === 'mine' && (
          <>
            {loadingMembership ? <SkeletonCard lines={3} />
             : !hasClan ? (
              <div className="text-center py-10 space-y-3">
                <p className="text-4xl">🛡️</p>
                <p className="text-sm text-white/40">You are not in a clan</p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="secondary" onClick={() => setView('browse')}>Join</Button>
                  {canCreate && <Button size="sm" onClick={() => setView('create')}>Create</Button>}
                </div>
              </div>
             ) : myMembership && (
              <>
                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-black text-white">{myMembership.clan.name}</p>
                      {myMembership.clan.description && (
                        <p className="text-xs text-white/40 mt-0.5">{myMembership.clan.description}</p>
                      )}
                      <div className="flex gap-3 mt-2 text-xs text-white/40">
                        <span>⭐ {formatNumber(myMembership.clan.seasonXp)} XP</span>
                        <span><Users size={10} className="inline" /> {myMembership.clan.memberCount}/20</span>
                        <span>🏆 {myMembership.clan.wins}W</span>
                      </div>
                    </div>
                    <span className="text-xs text-violet-300 font-semibold shrink-0">
                      {myMembership.role === 'leader' ? '👑 Leader'
                       : myMembership.role === 'officer' ? '⚔️ Officer' : '🎮 Member'}
                    </span>
                  </div>
                </div>

                {/* Missionen Button */}
                <button onClick={() => setView('missions')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl
                             border border-white/[0.07] bg-white/[0.02]
                             active:scale-[0.98] transition-transform">
                  <Swords size={18} className="text-violet-400 shrink-0" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-white">Clan Missions</p>
                    <p className="text-xs text-white/35">3 missions daily · 15⚡ · Clan XP</p>
                  </div>
                  <span className="text-white/30 text-xs">→</span>
                </button>

                {/* Mitglieder */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">
                    Members ({(myMembership.members ?? []).length})
                  </h3>
                  {(myMembership.members ?? []).map((m: any) => (
                    <div key={m.userId}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                                 border border-white/[0.05] bg-white/[0.02]">
                      {m.telegramPhotoUrl
                        ? <img src={m.telegramPhotoUrl} alt=""
                            className="w-8 h-8 rounded-full object-cover shrink-0" />
                        : <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center
                                          justify-center text-xs font-bold text-violet-300 shrink-0">
                            {m.telegramFirstName?.[0] ?? '?'}
                          </div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white/80 truncate">
                          {m.telegramFirstName}
                          {m.userId === profile?.id && (
                            <span className="ml-1 text-[9px] text-violet-400 font-black">YOU</span>
                          )}
                        </p>
                        <p className="text-[10px] text-white/30">
                          ⭐ {formatNumber(m.contributedXp ?? 0)} XP · Lv.{m.level}
                        </p>
                      </div>
                      <span className="text-sm shrink-0">
                        {m.role === 'leader' ? '👑' : m.role === 'officer' ? '⚔️' : ''}
                      </span>
                    </div>
                  ))}
                </div>

                <Button variant="destructive" fullWidth loading={leaving}
                  onClick={() => { if (window.confirm('Leave clan?')) leaveClan(myMembership.clan.id) }}>
                  <LogOut size={14} /> Leave Clan
                </Button>
              </>
            )}
          </>
        )}

        {/* ── MISSIONEN ────────────────────────────── */}
        {view === 'missions' && hasClan && (
          <>
            <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.04] px-3 py-2.5">
              <p className="text-xs text-white/40 leading-relaxed">
                🛡️ Complete clan missions to support your clan with XP.
                Kosten: <span className="text-yellow-400">15⚡</span> pro Mission.
              </p>
            </div>

            {loadingMissions
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={1} />)
              : (missions ?? []).length === 0
              ? <div className="text-center py-10">
                  <p className="text-3xl mb-2">⚔️</p>
                  <p className="text-sm text-white/40">No missions available</p>
                </div>
              : (missions ?? []).map((m: any) => (
                <div key={m.id}
                  className={cn(
                    'rounded-2xl border p-4 transition-all',
                    m.status === 'completed'
                      ? 'border-emerald-500/15 bg-emerald-500/[0.03] opacity-60'
                      : 'border-white/[0.08] bg-white/[0.02]'
                  )}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center
                                    justify-center text-xl shrink-0">
                      {m.status === 'completed' ? '✓' : m.template.iconKey ?? '⚔️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white/90">{m.template.title}</p>
                      <p className="text-xs text-white/35 mt-0.5 line-clamp-2">{m.template.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-white/35">
                        <span className="flex items-center gap-1">
                          <Zap size={10} className="text-yellow-400" fill="currentColor" />
                          {m.energyCost}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star size={10} className="text-violet-400" fill="currentColor" />
                          +{m.xpReward} XP
                        </span>
                        <span className="flex items-center gap-1">
                          <Shield size={10} className="text-blue-400" />
                          Clan +{m.xpClanReward}
                        </span>
                      </div>
                    </div>
                  </div>

                  {m.status !== 'completed' && (
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" loading={completing && completingId === m.id}
                        onClick={() => completeMission(m.id)}
                        className="h-7 text-[11px] px-3">
                        Complete
                      </Button>
                    </div>
                  )}
                  {m.status === 'completed' && (
                    <p className="mt-2 text-right text-xs text-emerald-400">✓ Completed</p>
                  )}
                </div>
              ))
            }
          </>
        )}

        {/* ── ERSTELLEN ────────────────────────────── */}
        {view === 'create' && (
          <CreateClanForm
            canCreate={canCreate} hasClan={hasClan}
            userLevel={profile?.level ?? 1} token={token ?? ''}
            onCreated={async () => { await invalidateAll(); setView('mine') }}
          />
        )}
      </div>
    </div>
  )
}

function CreateClanForm({ canCreate, hasClan, userLevel, token, onCreated }: {
  canCreate: boolean; hasClan: boolean; userLevel: number
  token: string; onCreated: () => void
}) {
  const [name, setName]         = useState('')
  const [desc, setDesc]         = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const { toast, haptic }       = useUIStore()

  const { mutate: create, isPending } = useMutation({
    mutationFn: async () => {
      const res  = await fetch('/api/v1/clans', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), description: desc.trim(), isPublic }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: () => { toast('success', '🛡️ Clan created!'); haptic('heavy'); onCreated() },
    onError:   (e: Error) => { toast('error', e.message); haptic('error') },
  })

  if (hasClan) return (
    <div className="text-center py-10 space-y-2">
      <p className="text-3xl">🛡️</p>
      <p className="text-sm text-white/40">You are already in a clan</p>
    </div>
  )

  if (!canCreate) return (
    <div className="text-center py-10 space-y-2">
      <p className="text-3xl">🔒</p>
      <p className="text-sm font-bold text-white">Level {GAME_CONSTANTS.CLAN_UNLOCK_LEVEL} required</p>
      <p className="text-xs text-white/40">{GAME_CONSTANTS.CLAN_UNLOCK_LEVEL - userLevel} more levels</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-white/50">Clan Name *</label>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Crypto Warriors" maxLength={32}
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl
                     px-3 py-2.5 text-sm text-white placeholder-white/25
                     focus:outline-none focus:border-violet-500/50" />
        <p className="text-[10px] text-white/25 text-right">{name.length}/32</p>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-white/50">Description</label>
        <textarea value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="What does your clan stand for?" maxLength={200} rows={3}
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl
                     px-3 py-2.5 text-sm text-white placeholder-white/25
                     focus:outline-none focus:border-violet-500/50 resize-none" />
      </div>
      <div className="flex items-center justify-between px-3 py-3 rounded-xl
                      border border-white/[0.08] bg-white/[0.03]">
        <div>
          <p className="text-xs font-semibold text-white/70">Public Clan</p>
          <p className="text-[10px] text-white/30">Anyone can join</p>
        </div>
        <button onClick={() => setIsPublic(p => !p)}
          className={cn('w-11 h-6 rounded-full transition-colors relative',
            isPublic ? 'bg-violet-500' : 'bg-white/[0.1]')}>
          <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform',
            isPublic ? 'translate-x-5' : 'translate-x-0.5')} />
        </button>
      </div>
      <Button fullWidth size="lg" loading={isPending}
        disabled={name.trim().length < 3} onClick={() => create()}>
        <Shield size={16} /> Create Clan
      </Button>
    </div>
  )
}
