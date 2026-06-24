// src/app/api/v1/clans/[clanId]/avatar/route.ts
// Clan-Profilbild — nur Leader.
//   POST   { dataUrl: "data:image/jpeg;base64,..." }  -> Upload + avatar_url setzen
//   DELETE                                            -> Bild entfernen + avatar_url = null
//
// Upload via service-role in den public Bucket "clan-avatars".
// Deterministischer Pfad {clanId}.jpg (upsert) -> ein Bild pro Clan, kein
// Alt-Datei-Aufräumen nötig. Cache-Bust über ?v={ts} an der URL.

import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient }    from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET    = 'clan-avatars'
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB (Client verkleinert ohnehin auf ~256px)
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
}

async function requireLeader(db: ReturnType<typeof getAdminClient>, clanId: string, userId: string) {
  const { data } = await db
    .from('clan_members').select('role')
    .eq('clan_id', clanId).eq('user_id', userId).maybeSingle()
  return data?.role === 'leader'
}

export const POST = withAuth(async (ctx) => {
  const clanId = ctx.params?.clanId
  if (!clanId) return err('Clan ID missing', 'MISSING_ID')

  let body: { dataUrl?: string }
  try { body = await ctx.req.json() }
  catch { return err('Invalid body', 'BAD_REQUEST') }

  const dataUrl = body.dataUrl ?? ''
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl)
  if (!match) return err('Invalid image data', 'BAD_IMAGE')

  const mime   = match[1]
  const base64 = match[2]
  const buffer = Buffer.from(base64, 'base64')
  if (buffer.byteLength === 0)        return err('Empty image', 'BAD_IMAGE')
  if (buffer.byteLength > MAX_BYTES)  return err('Image too large (max 2 MB)', 'IMAGE_TOO_LARGE')

  const db = getAdminClient()
  if (!(await requireLeader(db, clanId, ctx.userId))) {
    return err('Only the clan leader can change the picture', 'FORBIDDEN', 403)
  }

  const ext  = MIME_EXT[mime] ?? 'jpg'
  const path = `${clanId}.${ext}`

  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mime, upsert: true })
  if (upErr) return err(`Upload failed: ${upErr.message}`, 'UPLOAD_FAILED', 500)

  const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path)
  const avatarUrl = `${pub.publicUrl}?v=${Date.now()}` // Cache-Bust

  const { error: updErr } = await db.from('clans').update({ avatar_url: avatarUrl }).eq('id', clanId)
  if (updErr) return err('Failed to save avatar', 'DB_ERROR', 500)

  return ok({ avatarUrl })
})

export const DELETE = withAuth(async (ctx) => {
  const clanId = ctx.params?.clanId
  if (!clanId) return err('Clan ID missing', 'MISSING_ID')

  const db = getAdminClient()
  if (!(await requireLeader(db, clanId, ctx.userId))) {
    return err('Only the clan leader can remove the picture', 'FORBIDDEN', 403)
  }

  // Alle möglichen Endungen best-effort entfernen.
  await db.storage.from(BUCKET).remove(
    Object.values(MIME_EXT).map(ext => `${clanId}.${ext}`)
  )

  const { error } = await db.from('clans').update({ avatar_url: null }).eq('id', clanId)
  if (error) return err('Failed to remove avatar', 'DB_ERROR', 500)

  return ok({ removed: true })
})
