// src/components/game/ReferralSection.tsx
'use client'
import { useState }      from 'react'
import { useQuery }      from '@tanstack/react-query'
import { useAuthStore }  from '@/stores/useAuthStore'
import { useUserStore }  from '@/stores/useUserStore'
import { SkeletonCard }  from '@/components/ui/Skeleton'
import { Copy, CheckCircle, Users, Gift, Lock } from 'lucide-react'

export function ReferralSection() {
  const token   = useAuthStore(s => s.accessToken)
  const profile = useUserStore(s => s.profile)
  const [copied, setCopied] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['referrals'],
    enabled:  !!token,
    staleTime:60_000,
    queryFn:  async () => {
      const res  = await fetch('/api/v1/referrals', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      return json.success ? json.data : null
    },
  })

  function copyLink() {
    if (!data?.referralLink) return
    navigator.clipboard.writeText(data.referralLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (isLoading) return <SkeletonCard lines={2} />

  // Noch nicht berechtigt
  if (!data?.referralEligible) {
    const reqs = data?.requirements
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Lock size={14} className="text-white/30" />
          <h3 className="text-sm font-bold text-white/60">Freunde einladen</h3>
        </div>
        <p className="text-xs text-white/35">
          Schalte das Referral-System frei und verdiene 500 XP pro erfolgreichem Freund!
        </p>
        <div className="space-y-2">
          {reqs && [
            { label: `Level 5 erreichen`, met: reqs.level.met,
              current: `Lv. ${reqs.level.current}`, required: 'Lv. 5' },
            { label: `2.000 XP sammeln`, met: reqs.xp.met,
              current: `${reqs.xp.current.toLocaleString()} XP`,
              required: '2.000 XP' },
            { label: 'TON Wallet verbinden', met: !!profile?.wallet,
              current: profile?.wallet ? '✓' : '✗', required: '' },
          ].map(({ label, met, current, required }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  met ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.06] text-white/30'
                }`}>
                  {met ? '✓' : '·'}
                </span>
                <span className="text-xs text-white/50">{label}</span>
              </div>
              <span className={`text-[11px] font-semibold ${met ? 'text-emerald-400' : 'text-white/30'}`}>
                {current}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Berechtigt
  return (
    <div className="space-y-3">
      {/* Referral-Link */}
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Freunde einladen</h3>
          <span className="text-xs text-violet-300 font-semibold">+500 XP pro Freund</span>
        </div>
        <p className="text-xs text-white/40">
          Teile deinen Link. Du erhältst 500 XP sobald dein Freund Level 5 und 2.000 XP erreicht.
        </p>
        <button onClick={copyLink}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl
                     bg-white/[0.04] border border-white/[0.08] text-xs font-mono
                     text-white/60 active:scale-[0.98] transition-transform">
          <span className="truncate">{data?.referralLink}</span>
          {copied
            ? <CheckCircle size={14} className="text-emerald-400 shrink-0" />
            : <Copy size={14} className="text-white/30 shrink-0" />
          }
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Users size={12} className="text-violet-400" />
            <p className="text-lg font-black text-white">{data?.totalReferrals ?? 0}</p>
          </div>
          <p className="text-[10px] text-white/35">Eingeladen</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Gift size={12} className="text-emerald-400" />
            <p className="text-lg font-black text-white">{data?.validReferrals ?? 0}</p>
          </div>
          <p className="text-[10px] text-white/35">Bestätigt (+{(data?.validReferrals ?? 0) * 500} XP)</p>
        </div>
      </div>

      {/* Referral-Liste */}
      {(data?.referrals ?? []).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider">
            Deine Freunde
          </h4>
          {(data?.referrals ?? []).map((r: any) => (
            <div key={r.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                         border border-white/[0.05] bg-white/[0.02]">
              {r.referee.photoUrl
                ? <img src={r.referee.photoUrl} alt=""
                    className="w-8 h-8 rounded-full object-cover shrink-0" />
                : <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center
                                  justify-center text-xs font-bold text-violet-300 shrink-0">
                    {r.referee.firstName?.[0] ?? '?'}
                  </div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white/80 truncate">
                  {r.referee.firstName}
                  {r.referee.username && (
                    <span className="text-white/30 ml-1">@{r.referee.username}</span>
                  )}
                </p>
                <p className="text-[10px] text-white/30">
                  Lv.{r.referee.level} · {new Date(r.createdAt).toLocaleDateString('de-DE')}
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                r.isValid
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-white/[0.06] text-white/30'
              }`}>
                {r.isValid ? '+500 XP' : 'Ausstehend'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
