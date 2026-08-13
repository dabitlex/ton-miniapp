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
import { ChevronLeft, Users, ArrowUp, Shield, Trash2 } from 'lucide-react'

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

  const { messages, clanId, role, notInClan, isLoading, isSending, sendError, send, deleteMessage } = useClanChat()
  const [text, setText] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const canModerate = role === 'leader' || role === 'officer'

  async function handleDelete(id: string) {
    setConfirmId(null)
    haptic?.('medium')
    try { await deleteMessage(id) }
    catch (e) { useUIStore.getState().toast('error', (e as Error).message) }
  }

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
  const memberCount = membership?.clan?.memberCount ?? null

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
  if (notInClan) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl surface-2 flex items-center justify-center">
          <Shield size={26} style={{ color: 'var(--blue-2)' }} />
        </div>
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500 }}>Noch kein Clan</p>
          <p className="mt-1.5" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            Tritt einem Clan bei, um mit deinen Mitgliedern zu schreiben.
          </p>
        </div>
        <button onClick={() => router.push('/clans')}
          className="press chip" style={{ color: 'var(--blue-2)', height: 36, padding: '0 18px' }}>
          Clan finden
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">

      {/* ── Clan-Kontextleiste ───────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2.5 px-3 py-2.5"
        style={{ background: 'linear-gradient(180deg,rgba(8,13,24,0.72),transparent)' }}>
        <button onClick={() => router.push('/clans?tab=mine')} className="press p-1" aria-label="Zurück">
          <ChevronLeft size={22} style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div className="w-9 h-9 flex items-center justify-center font-display"
          style={{ background: 'linear-gradient(140deg,#7BA5FF,#1D4ED8)', color: '#fff', fontSize: 13,
            fontWeight: 500, borderRadius: 12, boxShadow: '0 8px 20px rgba(37,99,255,.4)' }}>
          {initials(clanName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate" style={{ fontFamily: 'var(--font-display)', fontSize: 15,
            fontWeight: 600, letterSpacing: '-0.01em' }}>{clanName}</div>
          <div className="flex items-center gap-1.5 text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            <Users size={11} />
            {memberCount != null ? `${memberCount} Mitglieder` : 'Clan-Kanal'}
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
              Noch keine Nachrichten.<br />Schreib deinem Clan als Erster.
            </p>
          </div>
        ) : (
          messages.map(m => {
            const mine = m.user_id === myId
            const selected = canModerate && confirmId === m.id
            return (
              <div key={m.id}
                className={`flex gap-2 max-w-[84%] animate-rise ${mine ? 'self-end flex-row-reverse' : ''}`}>
                {!mine && (
                  m.author_avatar
                    ? <img src={m.author_avatar} alt="" className="w-[26px] h-[26px] rounded-full shrink-0 object-cover" />
                    : <div className="w-[26px] h-[26px] rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold font-display"
                        style={{ background: avatarGradient(m.user_id), color: '#fff', fontWeight: 500 }}>
                        {initials(m.author_name)}
                      </div>
                )}
                <div className={mine ? 'text-right' : ''}>
                  {!mine && (
                    <div className="mb-1 ml-0.5" style={{ fontFamily: 'var(--font-display)',
                      fontSize: 11.5, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {m.author_name}
                    </div>
                  )}
                  <div
                    onClick={canModerate ? () => setConfirmId(selected ? null : m.id) : undefined}
                    className="inline-block px-3 py-2 text-[13.5px] leading-snug text-left"
                    style={{
                      ...(mine ? {
                        background: 'linear-gradient(150deg,rgba(91,141,255,0.30),rgba(37,99,255,0.16))',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.26), inset 0 0 0 .5px rgba(143,180,255,.20)',
                        borderRadius: '15px', borderBottomRightRadius: '5px',
                      } : {
                        background: 'linear-gradient(150deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.16), inset 0 0 0 .5px rgba(255,255,255,.06)',
                        borderRadius: '15px', borderBottomLeftRadius: '5px',
                      }),
                      ...(canModerate ? { cursor: 'pointer' } : {}),
                      ...(selected ? { outline: '1.5px solid var(--rose)', outlineOffset: '1px' } : {}),
                    }}>
                    {m.body}
                  </div>
                  {selected && (
                    <div className={`mt-1 ${mine ? 'text-right' : ''}`}>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="press inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
                        style={{ color: 'var(--rose)', background: 'rgba(251,113,133,0.14)', fontFamily: 'var(--font-display)' }}>
                        <Trash2 size={12} /> Delete message
                      </button>
                    </div>
                  )}
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
        style={{ background: 'linear-gradient(0deg,rgba(8,13,24,0.96) 40%,transparent)' }}>
        <div className="flex-1 flex items-center px-4 py-3"
          style={{ borderRadius: 16,
            background: 'linear-gradient(150deg,rgba(255,255,255,.10),rgba(255,255,255,.03))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.16), inset 0 0 0 .5px rgba(255,255,255,.06)' }}>
          <input
            value={text}
            onChange={e => setText(e.target.value.slice(0, BODY_MAX))}
            onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
            maxLength={BODY_MAX}
            placeholder="Nachricht schreiben…"
            aria-label="Nachricht an deinen Clan"
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
          aria-label="Nachricht senden"
          className="press w-11 h-11 flex items-center justify-center shrink-0 disabled:opacity-35"
          style={{
            borderRadius: 15, color: '#fff',
            background: 'linear-gradient(140deg,#7BA5FF,#1D4ED8)',
            boxShadow: text.trim()
              ? '0 8px 20px rgba(37,99,255,0.45), inset 0 1px 0 rgba(255,255,255,.35)'
              : 'inset 0 1px 0 rgba(255,255,255,.2)',
          }}>
          <ArrowUp size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
