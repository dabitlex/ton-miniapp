// src/components/game/OnboardingQuests.tsx — "First Steps" onboarding section
//
// Rendered above the Daily/Weekly tabs on the Quests page. Shows the
// 6 one-time onboarding quests with a progress bar and per-item
// action buttons. Disappears entirely once all 6 are completed.
//
// Note on icon_key: this is a SEPARATE convention from QuestCard,
// which renders icon_key as an emoji string for daily/weekly quests.
// For quest_type='special', icon_key is a semantic key mapped to a
// lucide-react icon below (ICON_MAP) — scoped to this component only.
'use client'
import { useRouter } from 'next/navigation'
import {
  Wallet, ListChecks, Send, Users, Star, UserPlus,
  CheckCircle2, Circle, ChevronRight, ExternalLink, Lock, Share2, RefreshCw, Sparkles,
} from 'lucide-react'
import { useOnboardingQuests, type OnboardingQuestItem } from '@/features/quests/hooks'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  wallet:      Wallet,
  checklist:   ListChecks,
  telegram:    Send,
  users:       Users,
  star:        Star,
  'user-plus': UserPlus,
}

export function OnboardingQuests() {
  const router = useRouter()
  const { items, completedCount, totalCount, isLoading, recheckQuest, isRechecking } = useOnboardingQuests()

  // Loading, not configured, or already finished -> render nothing.
  if (isLoading || totalCount === 0) return null
  if (completedCount >= totalCount) return null

  const pct = Math.round((completedCount / totalCount) * 100)

  const handleNavigate = (route: string, anchor?: string) => {
    router.push(anchor ? `${route}#${anchor}` : route)
  }

  return (
    <div
      className="rounded-[20px] p-3.5 mb-3 animate-rise"
      style={{ background: 'var(--surface-accent)', border: '1px solid var(--border-glow)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: 'var(--violet-bright)' }} />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            First Steps
          </span>
        </div>
        <span
          className="text-[10px] font-semibold px-2.5 py-1 rounded-[10px]"
          style={{ color: 'var(--violet-bright)', background: 'var(--neon-dim)' }}
        >
          {completedCount}/{totalCount}
        </span>
      </div>

      <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>
        Complete these one-time quests for a head start in XP
      </p>

      {/* Progress bar */}
      <div className="h-[3px] rounded-full overflow-hidden mb-3" style={{ background: 'var(--border)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: 'var(--aurora)' }}
        />
      </div>

      {/* Items */}
      <div className="flex flex-col gap-2">
        {items.map(item => (
          <OnboardingItem
            key={item.id}
            item={item}
            onNavigate={handleNavigate}
            onRecheck={() => recheckQuest(item.id)}
            isRechecking={isRechecking}
          />
        ))}
      </div>
    </div>
  )
}

interface OnboardingItemProps {
  item:         OnboardingQuestItem
  onNavigate:   (route: string, anchor?: string) => void
  onRecheck:    () => void
  isRechecking: boolean
}

function OnboardingItem({ item, onNavigate, onRecheck, isRechecking }: OnboardingItemProps) {
  const { template, status, referral } = item
  const isDone   = status === 'completed'
  const Icon     = ICON_MAP[template.iconKey] ?? Circle
  const action   = template.actionSpec

  // ── Completed: green check, strikethrough title ──────────────
  if (isDone) {
    return (
      <div className="flex items-center gap-2.5 rounded-[14px] px-3 py-2.5" style={{ background: 'var(--surface-1)' }}>
        <CheckCircle2 size={20} style={{ color: 'var(--emerald)' }} />
        <p className="flex-1 text-[12.5px] font-medium truncate"
          style={{ color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
          {template.title}
        </p>
        <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
          +{template.xpReward} XP
        </span>
      </div>
    )
  }

  // ── special_first_referral: locked vs unlocked ────────────────
  if (template.internalCode === 'special_first_referral' && referral) {
    const eligible = referral.xp.met && referral.wallet.met

    if (!eligible) {
      return (
        <div
          className="flex flex-col gap-2 rounded-[14px] px-3 py-2.5 cursor-pointer"
          style={{ background: 'var(--surface-1)' }}
          onClick={() => onNavigate(action.route ?? '/profile', action.anchor)}
        >
          <div className="flex items-center gap-2.5">
            <Lock size={18} style={{ color: 'var(--text-faint)' }} />
            <p className="flex-1 text-[12.5px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
              {template.title}
            </p>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              +{template.xpReward} XP
            </span>
            <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap ml-[26px]">
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Unlocks at:</span>
            <span className="text-[10px] font-semibold" style={{ color: referral.wallet.met ? 'var(--emerald)' : 'var(--gold)' }}>
              Wallet {referral.wallet.met ? '✓' : '—'}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>·</span>
            <span className="text-[10px] font-semibold" style={{ color: 'var(--gold)' }}>
              {referral.xp.current.toLocaleString()}/{referral.xp.required.toLocaleString()} XP
            </span>
          </div>
        </div>
      )
    }

    // Unlocked: highlighted row, navigate to referral section to share the link
    return (
      <div
        className="flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 cursor-pointer"
        style={{ background: 'var(--surface-2)', border: '1px solid rgba(52,211,153,0.25)' }}
        onClick={() => onNavigate(action.route ?? '/profile', action.anchor)}
      >
        <Share2 size={20} style={{ color: 'var(--emerald)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {template.title}
          </p>
          <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
            Share your link to earn +{template.xpReward} XP
          </p>
        </div>
        <ChevronRight size={16} style={{ color: 'var(--emerald)' }} />
      </div>
    )
  }

  // ── special_join_channel: external link + recheck button ──────
  if (template.internalCode === 'special_join_channel' && action.action === 'link') {
    return (
      <div className="flex items-center gap-2.5 rounded-[14px] px-3 py-2.5"
        style={{ background: 'var(--surface-2)', border: '1px solid rgba(94,234,212,0.25)' }}>
        <a href={action.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 flex-1 min-w-0">
          <Icon size={20} style={{ color: 'var(--cyan-soft)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {template.title}
            </p>
            <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>@vexalgo</p>
          </div>
          <span className="text-[11px] font-semibold" style={{ color: 'var(--cyan-soft)' }}>
            +{template.xpReward} XP
          </span>
          <ExternalLink size={16} style={{ color: 'var(--cyan-soft)' }} />
        </a>
        <button
          onClick={onRecheck}
          disabled={isRechecking}
          aria-label="Check membership"
          className="shrink-0 rounded-full p-1.5 disabled:opacity-40"
          style={{ background: 'var(--surface-press)' }}
        >
          <RefreshCw size={13} style={{ color: 'var(--cyan-soft)' }} className={isRechecking ? 'animate-spin' : ''} />
        </button>
      </div>
    )
  }

  // ── navigate (clan) ─────────────────────────────────────────
  if (action.action === 'navigate') {
    return (
      <div
        className="flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 cursor-pointer"
        style={{ background: 'var(--surface-1)' }}
        onClick={() => onNavigate(action.route!, action.anchor)}
      >
        <Icon size={20} style={{ color: 'var(--text-faint)' }} />
        <p className="flex-1 text-[12.5px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {template.title}
        </p>
        <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
          +{template.xpReward} XP
        </span>
        <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  // ── passive (wallet, first quest, level 5) ─────────────────────
  return (
    <div className="flex items-center gap-2.5 rounded-[14px] px-3 py-2.5" style={{ background: 'var(--surface-1)', opacity: 0.75 }}>
      <Circle size={20} style={{ color: 'var(--text-faint)' }} />
      <p className="flex-1 text-[12.5px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
        {template.title}
      </p>
      <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
        +{template.xpReward} XP
      </span>
    </div>
  )
}
