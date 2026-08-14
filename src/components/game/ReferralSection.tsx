// src/components/game/ReferralSection.tsx
'use client'
import { useState }      from 'react'
import { useQuery }      from '@tanstack/react-query'
import { useAuthStore }  from '@/stores/useAuthStore'
import { useUserStore }  from '@/stores/useUserStore'
import { SkeletonCard }  from '@/components/ui/Skeleton'
import { Copy, CheckCircle, Users, Gift, Lock, Share2, X, Mail, Send } from 'lucide-react'
import { authedFetch } from '@/lib/authedFetch'

// ── Share Modal ───────────────────────────────────────────────
interface ShareModalProps {
  isOpen:       boolean
  onClose:      () => void
  referralLink: string
  shareText:    string
}

function ShareModal({ isOpen, onClose, referralLink, shareText }: ShareModalProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const tg          = (window as any).Telegram?.WebApp
  const encodedUrl  = encodeURIComponent(referralLink)
  const encodedText = encodeURIComponent(shareText)

  function haptic(type: 'light' | 'medium' | 'success' = 'light') {
    try { tg?.HapticFeedback?.impactOccurred(type) } catch { /* silent */ }
  }

  function openUrl(url: string) {
    haptic('light')
    // Telegram WebApp openLink für externe URLs
    if (tg?.openLink) {
      tg.openLink(url, { try_instant_view: false })
    } else {
      window.open(url, '_blank')
    }
    onClose()
  }

  function openTelegramShare() {
    haptic('light')
    const url = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(url)
    } else if (tg?.openLink) {
      tg.openLink(url, { try_instant_view: false })
    } else {
      window.open(url, '_blank')
    }
    onClose()
  }

  async function copyLink() {
    haptic('medium')
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        onClose()
      }, 1500)
    } catch {
      // Fallback: execCommand
      try {
        const el = document.createElement('textarea')
        el.value = referralLink
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        setCopied(true)
        setTimeout(() => { setCopied(false); onClose() }, 1500)
      } catch { /* silent */ }
    }
  }

  const OPTIONS = [
    {
      id:      'telegram',
      label:   'Telegram',
      icon:    <Send size={20} />,
      color:   '#2AABEE',
      bg:      'rgba(42,171,238,0.12)',
      border:  'rgba(42,171,238,0.25)',
      action:  openTelegramShare,
    },
    {
      id:      'whatsapp',
      label:   'WhatsApp',
      icon:    <span style={{ fontSize: 20 }}>💬</span>,
      color:   '#25D366',
      bg:      'rgba(37,211,102,0.1)',
      border:  'rgba(37,211,102,0.22)',
      action:  () => openUrl(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + referralLink)}`),
    },
    {
      id:      'twitter',
      label:   'X',
      icon:    <X size={20} />,
      color:   '#E7E9EA',
      bg:      'rgba(231,233,234,0.08)',
      border:  'rgba(231,233,234,0.15)',
      action:  () => openUrl(`https://x.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`),
    },
    {
      id:      'email',
      label:   'E-Mail',
      icon:    <Mail size={20} />,
      color:   '#F59E0B',
      bg:      'rgba(245,158,11,0.1)',
      border:  'rgba(245,158,11,0.22)',
      action:  () => openUrl(`mailto:?subject=Join%20VEXALGO&body=${encodeURIComponent(shareText + ' ' + referralLink)}`),
    },
    {
      id:      'copy',
      label:   copied ? 'Copied!' : 'Copy Link',
      icon:    copied ? <CheckCircle size={20} /> : <Copy size={20} />,
      color:   copied ? '#10B981' : '#A855F7',
      bg:      copied ? 'rgba(16,185,129,0.1)' : 'rgba(168,85,247,0.1)',
      border:  copied ? 'rgba(16,185,129,0.25)' : 'rgba(168,85,247,0.25)',
      action:  copyLink,
    },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-4 pt-4"
        style={{
          background: 'linear-gradient(180deg, rgba(12,11,24,0.99) 0%, rgba(8,8,14,1) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(167,139,250,0.25), 0 -8px 44px rgba(0,0,0,0.55)',
          borderRadius: '24px 24px 0 0',
          paddingBottom: 'calc(90px + env(safe-area-inset-bottom, 0px))',
          animation: 'slideUp 0.28s cubic-bezier(0.34, 1.2, 0.64, 1)',
        }}>

        {/* Handle */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Title */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div>
            <h3 className="display text-sm text-white" style={{ letterSpacing: '0.02em' }}>
              Share your link
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Choose where to share your referral link
            </p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            <X size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>

        {/* Referral Link Preview */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <span className="text-[10px] font-mono truncate flex-1"
            style={{ color: 'rgba(255,255,255,0.35)' }}>
            {referralLink}
          </span>
        </div>

        {/* Share Options Grid */}
        <div className="grid grid-cols-5 gap-2">
          {OPTIONS.map(({ id, label, icon, color, bg, border, action }) => (
            <button
              key={id}
              onClick={action}
              className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl
                         active:scale-90 transition-all"
              style={{ background: bg, border: `1px solid ${border}` }}>
              <div style={{ color }}>
                {icon}
              </div>
              <span className="text-[9px] font-bold text-center leading-tight"
                style={{ color: id === 'copy' && copied ? '#10B981' : 'rgba(255,255,255,0.6)' }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

// ── Main Component ────────────────────────────────────────────
export function ReferralSection() {
  const token   = useAuthStore(s => s.accessToken)
  const profile = useUserStore(s => s.profile)
  const [copied,      setCopied]      = useState(false)
  const [showModal,   setShowModal]   = useState(false)

  const shareText = '🎮 Join me on VEXALGO! Earn XP, climb the leaderboard and be ready for the token launch.'

  const { data, isLoading } = useQuery({
    queryKey: ['referrals'],
    enabled:  !!token,
    staleTime: 60_000,
    queryFn:  async () => {
      const res  = await authedFetch('/api/v1/referrals', {
              })
      const json = await res.json()
      return json.success ? json.data : null
    },
  })

  function openShareModal() {
    if (!data?.referralLink) {
      // Fallback
      navigator.clipboard.writeText(data?.referralLink ?? '').catch(() => {})
      return
    }
    // Haptic
    try {
      const tg = (window as any).Telegram?.WebApp
      tg?.HapticFeedback?.impactOccurred('medium')
    } catch { /* silent */ }
    setShowModal(true)
  }

  function copyLink() {
    if (!data?.referralLink) return
    navigator.clipboard.writeText(data.referralLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  if (isLoading) return <SkeletonCard lines={2} />

  // Not eligible yet
  if (!data?.referralEligible) {
    const reqs = data?.requirements
    return (
      <div className="surface p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Lock size={14} style={{ color: 'var(--text-faint)' }} />
          <h3 className="display text-sm" style={{ color: 'var(--text-secondary)' }}>Invite Friends</h3>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Unlock the referral system and earn 500 XP for every successful friend!
        </p>
        <div className="space-y-2">
          {reqs && [
            { label: 'Reach Level 5',     met: reqs.level.met,   current: `Lv. ${reqs.level.current}` },
            { label: 'Collect 2,000 XP',  met: reqs.xp.met,      current: `${reqs.xp.current.toLocaleString()} XP` },
            { label: 'Connect TON Wallet',met: !!profile?.wallet, current: profile?.wallet ? '✓' : '✗' },
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

  // Eligible
  return (
    <>
      <div className="space-y-3">
        {/* Belohnung */}
        <div className="surface-accent" style={{ padding: 20, textAlign: 'center' }}>
          <p className="eyebrow">Pro validiertem Freund</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500,
            letterSpacing: '-0.03em', margin: '8px 0 2px' }}>+500 XP</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            für dich · dein Freund startet mit Bonus
          </p>
        </div>

        {/* Einladungslink */}
        <div className="surface-2" style={{ padding: 16 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dein Einladungslink</p>
          <div className="flex items-center" style={{ gap: 9, marginTop: 10 }}>
            <div style={{ flex: 1, minWidth: 0, padding: '11px 13px', borderRadius: 13,
              background: 'rgba(0,0,0,.28)', boxShadow: 'inset 0 0 0 .5px rgba(255,255,255,.09)' }}>
              <p className="truncate" style={{ fontFamily: 'var(--font-display)', fontSize: 12 }}>
                {data?.referralLink}
              </p>
            </div>
            <button onClick={copyLink} className="btn-primary press"
              style={{ width: 'auto', height: 42, padding: '0 16px', fontSize: 12.5, borderRadius: 12 }}>
              {copied ? 'Kopiert' : 'Kopieren'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 11 }}>
            <button onClick={openShareModal} className="btn-primary press" style={{ height: 42, fontSize: 12.5 }}>
              Auf Telegram teilen
            </button>
            <button onClick={openShareModal} className="btn-secondary press" style={{ height: 42, fontSize: 12.5 }}>
              Andere Apps
            </button>
          </div>
        </div>

        {/* Statistik */}
        <div className="surface-2" style={{ padding: 16 }}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500 }}>
                {data?.totalReferrals ?? 0}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Geworben</p>
            </div>
            <div style={{ width: .5, height: 32, background: 'rgba(255,255,255,.12)' }} />
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500,
                color: 'var(--blue-2)' }}>{data?.validReferrals ?? 0}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Validiert</p>
            </div>
            <div style={{ width: .5, height: 32, background: 'rgba(255,255,255,.12)' }} />
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500 }}>
                {((data?.validReferrals ?? 0) * 500).toLocaleString('de-DE')}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>XP erhalten</p>
            </div>
          </div>
        </div>

        {/* Friends list */}
        {(data?.referrals ?? []).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider">
              Your Friends ({data.referrals.length})
            </h4>
            {data.referrals.map((r: any) => (
              <div key={r.id}
                className="surface flex items-center gap-3 px-3.5 py-3">
                {r.referee.photoUrl
                  // eslint-disable-next-line @next/next/no-img-element
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
                    Lv.{r.referee.level} · {new Date(r.createdAt).toLocaleDateString('en-US')}
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

      {/* Share Modal */}
      <ShareModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        referralLink={data?.referralLink ?? ''}
        shareText={shareText}
      />
    </>
  )
}
