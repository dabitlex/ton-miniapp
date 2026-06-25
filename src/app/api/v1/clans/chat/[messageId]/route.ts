// src/app/api/v1/clans/chat/[messageId]/route.ts
// Nachricht moderieren (Soft-Delete) — nur Leader/Officer, nur im eigenen Clan.
//   DELETE -> setzt deleted_at + deleted_by

import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { createClient }      from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export const DELETE = withAuth(async (ctx) => {
  const messageId = ctx.params?.messageId
  if (!messageId) return err('Message ID missing', 'MISSING_ID')

  const supabase = db()

  // Eigene Mitgliedschaft + Rolle.
  const { data: member } = await supabase
    .from('clan_members').select('clan_id, role')
    .eq('user_id', ctx.userId).maybeSingle()
  if (!member) return err('You are not in a clan', 'NOT_IN_CLAN', 403)
  if (member.role !== 'leader' && member.role !== 'officer') {
    return err('Only leaders and officers can delete messages', 'FORBIDDEN', 403)
  }

  // Nachricht laden + auf den EIGENEN Clan verifizieren.
  const { data: msg } = await supabase
    .from('clan_chat_messages')
    .select('id, clan_id, deleted_at')
    .eq('id', messageId)
    .maybeSingle()

  if (!msg || msg.clan_id !== member.clan_id) return err('Message not found', 'NOT_FOUND', 404)
  if (msg.deleted_at) return ok({ deleted: true, alreadyDeleted: true })

  const { error } = await supabase
    .from('clan_chat_messages')
    .update({ deleted_at: new Date().toISOString(), deleted_by: ctx.userId })
    .eq('id', messageId)

  if (error) return err('Failed to delete message', 'DB_ERROR', 500)

  return ok({ deleted: true, messageId })
})
