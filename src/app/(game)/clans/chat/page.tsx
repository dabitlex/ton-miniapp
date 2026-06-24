// src/app/(game)/clans/chat/page.tsx — Clan Chat (Aurora OS)
//
// Rendert NUR den Inhalt in <main>; GameHeader, AuroraBackground und MobileNav
// kommen aus dem (game)-Layout. Aufbau: Clan-Kontextleiste (fix) · scrollende
// Nachrichten (flex-1) · fixierte Eingabe (fix). Daten via useClanChat:
//   - initiales Laden der letzten 30 (RLS-/membership-gesichert)
//   - Realtime-INSERTs des eigenen Clans (RLS ist die harte Grenze)
//   - Senden via API (clan_id serverseitig, 200-Zeichen-Cap, Rate-Limit)

'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter }    from 'next/navigation'
import { useQuery }     from '@tanstack/react-query'
import { useClanChat }  from '@/features/clan/hooks'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUserStore } from '@/stores/useUserStore'
import { useUIStore }   from '@/stores/useUIStore'
import { ChevronLeft, Users, ArrowUp, Shield } from 'lucide-react'

const BODY_MAX = 200

function initials(name: string): string {
  return (name?.trim()?.[0] ?? 'M').toUpperCase()
}

// Stabiler Avatar-Verlauf pro User (kein Rainbow, nur 4 Marken-Paare).
const AV_GRADIENTS = [
  'linear-gradient(150deg,#A78BFA,#7C3AED)',
  'linear-gradient(150deg,#5EEAD4,#5B8DEF)',
  'linear-gradient(150deg,#FBBF24,#F59E0B)',
  'linear-gradient(150deg,#FB7185,#F43F5E)',
]
function avatarGradient(userId: string): string {
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return AV_GRADIENTS[h % AV_GRADIENTS.length]
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function ClanChatPage() {
  const router  = useRouter()
  const token   = useAuthStore(s => s.accessToken)
  const myId    = useUserStore(s => s.profile?.id) ?? null
  const haptic  = useUIStore(s => s.haptic)

  const { messages, clanId, isLoading, isSending, sendError, send } = useClanChat()
  const [text, setText] = useState('')

  // Clan-Metadaten (Name + Mitgliederzahl) aus dem bestehenden Endpoint —
  // wir duplizieren das nicht in den Chat-Response.
  const { data: membership } = useQuery({
    queryKey: ['my-membership'],
    enabled:  !!token,
    staleTime: 30_000,
    queryFn: async () => {
      const res  = await fetch('/api/v1/clans/my', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      return json.success ? json.data : null
    },
  })

  const clanName    = membership?.clan?.name ?? 'Clan'
  const memberCount = membership?.clan?.member_count ?? null

  // Auto-Scroll ans Ende bei neuen Nachrichten.
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  // Fehler-Feedback (z.B. Rate-Limit) als Toast.
  useEffect(() => { if (sendError) useUIStore.getState().toast('error', sendError.message) }, [sendError])

  async function handleSend() {
    const t = text.replace(/\s+/g, ' ').trim()
    if (!t || isSending) return
    setText('')
    haptic?.('light')
    try { await send(t) } catch { /* Toast via sendError */ }
  }

  // ── Kein Clan → freundlicher Leerzustand ──────────────────────────────────
  if (!isLoading && !clanId) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl surface-2 flex items-center justify-center">
          <Shield size={26} style={{ color: '#C4B5FD' }} />
        </div>
        <div>
          <p className="font-display font-bold text-lg">No clan yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Join a clan to chat with your members.
          </p>
        </div>
        <button onClick={() => router.push('/clans')}
          className="press chip" style={{ color: '#C4B5FD' }}>
          Browse clans
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">

      {/* ── Clan-Kontextleiste ───────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2.5 px-3 py-2.5"
        style={{ background: 'linear-gradient(180deg,rgba(10,10,18,0.6),transparent)' }}>
        <button onClick={() => router.back()} className="press p-1" aria-label="Back">
          <ChevronLeft size={22} style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div className="w-9 h-9 rounded-[11px] flex items-center justify-center font-display font-extrabold"
          style={{ background: 'var(--aurora)', color: '#0A0A12', fontSize: 15, boxShadow: 'var(--shadow-violet)' }}>
          {initials(clanName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-[15px] leading-tight truncate">{clanName}</div>
          <div className="flex items-center gap-1.5 text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            <Users size={11} />
            {memberCount != null ? `${memberCount} members` : 'Clan channel'}
          </div>
        </div>
      </div>

      {/* ── Nachrichten ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 [scrollbar-width:none]">
        {isLoading ? (
          [0, 1, 2].map(i => (
            <div key={i} className={`shimmer h-10 ${i % 2 ? 'self-end w-1/2' : 'w-2/3'}`} />
          ))
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
              No messages yet.<br />Say hello to your clan 👋
            </p>
          </div>
        ) : (
          messages.map(m => {
            const mine = m.user_id === myId
            return (
              <div key={m.id}
                className={`flex gap-2 max-w-[84%] animate-rise ${mine ? 'self-end flex-row-reverse' : ''}`}>
                {!mine && (
                  m.author_avatar
                    ? <img src={m.author_avatar} alt="" className="w-[26px] h-[26px] rounded-full shrink-0 object-cover" />
                    : <div className="w-[26px] h-[26px] rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold font-display"
                        style={{ background: avatarGradient(m.user_id), color: '#0A0A12' }}>
                        {initials(m.author_name)}
                      </div>
                )}
                <div className={mine ? 'text-right' : ''}>
                  {!mine && (
                    <div className="font-display font-bold text-[10.5px] mb-0.5 ml-0.5" style={{ color: '#C4B5FD' }}>
                      {m.author_name}
                    </div>
                  )}
                  <div className="inline-block px-3 py-2 text-[13.5px] leading-snug text-left"
                    style={mine ? {
                      background: 'linear-gradient(155deg,rgba(139,92,246,0.34),rgba(91,141,239,0.18))',
                      borderRadius: '15px', borderTopRightRadius: '5px',
                      boxShadow: 'inset 0 1px 0 rgba(167,139,250,0.3), 0 6px 18px rgba(124,58,237,0.22)',
                    } : {
                      background: 'var(--surface-2)',
                      borderRadius: '15px', borderTopLeftRadius: '5px',
                      boxShadow: 'inset 0 1px 0 var(--edge-light), var(--shadow-sm)',
                    }}>
                    {m.body}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{fmtTime(m.created_at)}</div>
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      {/* ── Eingabe ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2.5 px-3 pt-2 pb-3"
        style={{ background: 'linear-gradient(0deg,rgba(8,8,14,0.96) 40%,transparent)' }}>
        <div className="flex-1 flex items-center rounded-full px-3.5 py-2.5"
          style={{ background: 'var(--surface-2)', boxShadow: 'inset 0 1px 0 var(--edge-light)' }}>
          <input
            value={text}
            onChange={e => setText(e.target.value.slice(0, BODY_MAX))}
            onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
            maxLength={BODY_MAX}
            placeholder="Message your clan…"
            aria-label="Message your clan"
            className="flex-1 bg-transparent outline-none text-[13.5px] placeholder:text-white/30"
            style={{ color: 'var(--text-primary)' }}
          />
          {text.length > 0 && (
            <span className="text-[10px] ml-1.5 tabular-nums"
              style={{ color: text.length > 180 ? 'var(--rose)' : 'var(--text-faint)' }}>
              {text.length}/{BODY_MAX}
            </span>
          )}
        </div>
        <button
          onClick={handleSend}
          disabled={!text.trim() || isSending}
          aria-label="Send message"
          className="press w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-35"
          style={{
            background: 'var(--aurora)', color: '#0A0A12',
            boxShadow: text.trim() ? '0 8px 22px rgba(139,92,246,0.45)' : 'none',
          }}>
          <ArrowUp size={18} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  )
}
