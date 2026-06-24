// src/app/api/v1/clans/chat/route.ts
//
// Clan-Chat — Lesen + Schreiben. KEINE clanId im Request: der Clan wird
// IMMER serverseitig aus der Mitgliedschaft abgeleitet (clan_members hat
// UNIQUE(user_id)). Damit gibt es keinen vom Client manipulierbaren
// clan_id-Parameter -> Cross-Clan-Zugriff ist strukturell unmöglich.
//
// Schreiben läuft hier (service-role) durch, damit Rate-Limit, Längen-Cap
// und der Autor-Snapshot erzwungen werden. Lesen ist zusätzlich per RLS
// abgesichert (siehe clan_chat.sql) — Realtime im Frontend stützt sich darauf.

import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { createClient }      from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const LOAD_LIMIT     = 30      // letzte N Nachrichten beim Öffnen
const BODY_MAX       = 200     // Zeichen-Cap (zusätzlich zum DB-CHECK)
const RATE_WINDOW_MS = 10_000  // Spam-Schutz: Fenster
const RATE_MAX       = 5       // ... max. Nachrichten pro Fenster/User

type ChatRow = {
  id: string
  user_id: string
  author_name: string
  author_avatar: string | null
  body: string
  created_at: string
}

// Eigene Clan-Mitgliedschaft auflösen (Quelle der Wahrheit für clan_id).
async function resolveMembership(supabase: ReturnType<typeof db>, userId: string) {
  const { data } = await supabase
    .from('clan_members')
    .select('clan_id, role')
    .eq('user_id', userId)
    .maybeSingle()
  return data as { clan_id: string; role: string } | null
}

function mapRow(r: any): ChatRow {
  return {
    id:            r.id,
    user_id:       r.user_id,
    author_name:   r.author_name,
    author_avatar: r.author_avatar ?? null,
    body:          r.body,
    created_at:    r.created_at,
  }
}

// ── GET: letzte 30 Nachrichten des eigenen Clans (älteste zuerst) ───────────
export const GET = withAuth(async (ctx) => {
  const supabase = db()

  const member = await resolveMembership(supabase, ctx.userId)
  if (!member) return err('You are not in a clan', 'NOT_IN_CLAN', 403)

  const { data, error } = await supabase
    .from('clan_chat_messages')
    .select('id, user_id, author_name, author_avatar, body, created_at')
    .eq('clan_id', member.clan_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(LOAD_LIMIT)

  if (error) return err('Failed to load chat', 'CHAT_LOAD_FAILED', 500)

  // chronologisch (älteste oben) für die Anzeige; clanId mitliefern, damit der
  // Realtime-Filter im Hook gesetzt werden kann.
  const messages = (data ?? []).map(mapRow).reverse()
  return ok({ clanId: member.clan_id, role: member.role, messages })
})

// ── POST: Nachricht senden ──────────────────────────────────────────────────
export const POST = withAuth(async (ctx) => {
  const supabase = db()

  const member = await resolveMembership(supabase, ctx.userId)
  if (!member) return err('You are not in a clan', 'NOT_IN_CLAN', 403)

  let payload: { body?: unknown }
  try { payload = await ctx.req.json() }
  catch { return err('Invalid JSON body', 'BAD_REQUEST') }

  const raw  = typeof payload.body === 'string' ? payload.body : ''
  const body = raw.replace(/\s+/g, ' ').trim()
  if (body.length === 0)        return err('Message is empty', 'EMPTY_MESSAGE')
  if (body.length > BODY_MAX)   return err(`Message too long (max ${BODY_MAX})`, 'MESSAGE_TOO_LONG')

  // Rate-Limit: max RATE_MAX Nachrichten / RATE_WINDOW_MS je User.
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const { count } = await supabase
    .from('clan_chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.userId)
    .gte('created_at', since)
  if ((count ?? 0) >= RATE_MAX) {
    return err('You are sending messages too fast', 'RATE_LIMITED', 429)
  }

  // Autor-Snapshot (eingefroren). Fallback-Kette für den Anzeigenamen.
  const { data: profile } = await supabase
    .from('users')
    .select('telegram_first_name, telegram_username, telegram_photo_url')
    .eq('id', ctx.userId)
    .single()

  const authorName =
    (profile?.telegram_first_name as string | null)?.trim() ||
    (profile?.telegram_username   as string | null)?.trim() ||
    'Member'

  const { data: inserted, error: insErr } = await supabase
    .from('clan_chat_messages')
    .insert({
      clan_id:       member.clan_id,            // serverseitig, NIE vom Client
      user_id:       ctx.userId,
      author_name:   authorName,
      author_avatar: (profile?.telegram_photo_url as string | null) ?? null,
      body,
    })
    .select('id, user_id, author_name, author_avatar, body, created_at')
    .single()

  if (insErr) return err('Failed to send message', 'CHAT_SEND_FAILED', 500)

  return ok({ message: mapRow(inserted) })
})
