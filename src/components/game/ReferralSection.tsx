// src/components/game/ReferralSection.tsx
'use client'
import { useState }      from 'react'
import { useQuery }      from '@tanstack/react-query'
import { useAuthStore }  from '@/stores/useAuthStore'
import { useUserStore }  from '@/stores/useUserStore'
import { SkeletonCard }  from '@/components/ui/Skeleton'
import { Copy, CheckCircle, Users, Gift, Lock, Share2 } from 'lucide-react'

export function ReferralSection() {
  const token   = useAuthStore(s => s.accessToken)
  const profile = useUserStore(s => s.profile)
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)

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

  async function shareLink() {
    if (!data?.referralLink) return

    const shareData = {
      title: 'TON MiniApp',
      text:  `🎮 Play VEXALGO with me! Earn XP, level up and win TON tokens. Use my link:`,
      url:   data.referralLink,
    }

    // Web Share API — opens native share menu (WhatsApp, Telegram, X, Email...)
    if (navigator.share) {
      try {
        await navigator.share(shareData)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      } catch (e: any) {
        // User cancelled — no error
        if (e.name !== 'AbortError') {
          // Fallback auf Kopieren
          copyLink()
        }
      }
    } else {
      // Fallback: Direkt in Telegram teilen
      const tg = (window as any).Telegram?.WebApp
      if (tg?.openTelegramLink) {
        const text = encodeURIComponent(`🎮 Join me on VEXALGO!\n\n${data.referralLink}`)
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(data.referralLink)}&text=${text}`)
      } else {
        copyLink()
      }
    }
  }

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
            { label: 'Reach Level 5', met: reqs.level.met,
              current: `Lv. ${reqs.level.current}` },
            { label: '2.000 XP sammeln', met: reqs.xp.met,
              current: `${reqs.xp.current.toLocaleString()} XP` },
            { label: 'TON Wallet verbinden', met: !!profile?.wallet,
              current: profile?.wallet ? '✓' : '✗' },
          ].map(({ label, met, current }) => (
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
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Freunde einladen</h3>
          <span className="text-xs text-violet-300 font-semibold">+500 XP pro Freund</span>
        </div>

        <p className="text-xs text-white/40 leading-relaxed">
          Teile deinen persönlichen Link. Du erhältst 500 XP sobald dein Freund
          Reach Level 5 and 2,000 XP.
        </p>

        {/* Link anzeigen */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl
                        bg-white/[0.04] border border-white/[0.08]">
          <span className="text-xs font-mono text-white/40 truncate flex-1">
            {data?.referralLink}
          </span>
          <button onClick={copyLink}
            className="shrink-0 text-white/30 hover:text-white/60 transition-colors p-1">
            {copied
              ? <CheckCircle size={13} className="text-emerald-400" />
              : <Copy size={13} />
            }
          </button>
        </div>

        {/* Teilen Button — öffnet natives Teilen-Menü */}
        <button
          onClick={shareLink}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                     bg-violet-500 hover:bg-violet-400 active:scale-[0.98]
                     text-white text-sm font-semibold transition-all">
          {shared
            ? <><CheckCircle size={15} /> Geteilt!</>
            : <><Share2 size={15} /> Link teilen</>
          }
        </button>

        {/* Direkt in Telegram teilen */}
        <button
          onClick={() => {
            const tg = (window as any).Telegram?.WebApp
            const url = encodeURIComponent(data?.referralLink ?? '')
            const text = encodeURIComponent('🎮 Play with me on VEXALGO and earn TON Tokens!')
            if (tg?.openTelegramLink) {
              tg.openTelegramLink(`https://t.me/share/url?url=${url}&text=${text}`)
            }
          }}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl
                     bg-blue-500/10 border border-blue-500/20 text-blue-300
                     text-xs font-semibold active:scale-[0.98] transition-all">
          <span>✈️</span> In Telegram teilen
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
          <p className="text-[10px] text-white/35">
            Confirmed · +{(data?.validReferrals ?? 0) * 500} XP
          </p>
        </div>
      </div>

      {/* Freundesliste */}
      {(data?.referrals ?? []).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider">
            Deine Freunde ({data.referrals.length})
          </h4>
          {data.referrals.map((r: any) => (
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
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                r.isValid
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-white/[0.06] text-white/30'
              }`}>
                {r.isValid ? '+500 XP ✓' : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
