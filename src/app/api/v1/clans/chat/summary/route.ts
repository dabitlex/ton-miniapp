// src/app/api/v1/clans/chat/summary/route.ts
//
// Liefert den Einstiegs-Zustand für die Chat-Karte im "My Clan"-Tab:
//   { lastMessage: { author_name, body, created_at } | null, unread: number }
// Unread = Nachrichten des eigenen Clans, die nach last_read_at entstanden sind.
// last_read_at wird beim Öffnen des Chats (GET /clans/chat) auf now() gesetzt.

import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { createClient }      from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const UNREAD_CAP = 99 // im Badge zeigen wir "99+" darüber

export const GET = withAuth(async (ctx) => {
  const supabase = db()

  const { data: member } = await supabase
    .from('clan_members')
    .select('clan_id, last_read_at')
    .eq('user_id', ctx.userId)
    .maybeSingle()

  if (!member) return ok({ inClan: false, lastMessage: null, unread: 0 })

  // Letzte (nicht gelöschte) Nachricht für die Vorschau.
  const { data: last } = await supabase
    .from('clan_chat_messages')
    .select('author_name, body, created_at')
    .eq('clan_id', member.clan_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Unread-Zähler. Ohne last_read_at (frisch beigetreten) zählen wir ab Beitritt
  // faktisch alles Vorhandene — daher Fallback auf created_at-Vergleich mit epoch.
  const since = (member.last_read_at as string | null) ?? '1970-01-01T00:00:00Z'
  const { count } = await supabase
    .from('clan_chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('clan_id', member.clan_id)
    .is('deleted_at', null)
    .gt('created_at', since)

  const unread = Math.min(count ?? 0, UNREAD_CAP + 1)

  return ok({
    inClan:      true,
    lastMessage: last ?? null,
    unread,
  })
})
