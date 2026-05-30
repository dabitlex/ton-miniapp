// src/app/api/v1/clans/route.ts
import { NextRequest } from 'next/server'
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { createClient }     from '@supabase/supabase-js'
import { GAME_CONSTANTS }   from '@/lib/constants/game'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/v1/clans — Liste öffentlicher Clans
export const GET = withAuth(async (ctx) => {
  const url    = new URL(ctx.req.url)
  const search = url.searchParams.get('q') ?? ''
  const page   = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
  const limit  = Math.min(20, Number(url.searchParams.get('limit') ?? '20'))
  const offset = (page - 1) * limit

  let query = db()
    .from('clans')
    .select('id,name,slug,description,avatar_url,member_count,season_xp,level,is_public,leader_id', { count: 'exact' })
    .eq('is_active', true)
    .eq('is_public', true)
    .order('season_xp', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) query = (query as any).ilike('name', `%${search}%`)

  const { data, count, error } = await query
  if (error) return err('Fehler beim Laden der Clans', 'DB_ERROR', 500)

  return ok(data ?? [], { page, limit, total: count ?? 0 })
})

// POST /api/v1/clans — Clan erstellen
export const POST = withAuth(async (ctx) => {
  let body: { name?: string; description?: string; isPublic?: boolean }
  try { body = await ctx.req.json() }
  catch { return err('Ungültiger Body', 'BAD_REQUEST') }

  const { name, description = '', isPublic = true } = body
  if (!name || name.trim().length < 3) {
    return err('Name muss mindestens 3 Zeichen haben', 'INVALID_NAME')
  }
  if (name.length > 32) {
    return err('Name darf maximal 32 Zeichen haben', 'INVALID_NAME')
  }

  const supabase = db()

  // Level prüfen
  const { data: user } = await supabase
    .from('users').select('level').eq('id', ctx.userId).single()
  if (!user || user.level < GAME_CONSTANTS.CLAN_UNLOCK_LEVEL) {
    return err(`Clan-Erstellung erfordert Level ${GAME_CONSTANTS.CLAN_UNLOCK_LEVEL}`, 'LEVEL_REQUIRED')
  }

  // Bereits in Clan?
  const { data: existing } = await supabase
    .from('clan_members').select('clan_id').eq('user_id', ctx.userId).maybeSingle()
  if (existing) return err('Du bist bereits in einem Clan', 'ALREADY_IN_CLAN')

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')

  // Clan anlegen
  const { data: clan, error: clanErr } = await supabase
    .from('clans').insert({
      name:        name.trim(),
      slug,
      description,
      is_public:   isPublic,
      leader_id:   ctx.userId,
    }).select().single()

  if (clanErr) {
    if (clanErr.code === '23505') return err('Clan-Name bereits vergeben', 'NAME_TAKEN')
    return err(`Clan-Erstellung fehlgeschlagen: ${clanErr.message}`, 'DB_ERROR', 500)
  }

  // Leader als Mitglied hinzufügen
  await supabase.from('clan_members').insert({
    clan_id: clan.id,
    user_id: ctx.userId,
    role:    'leader',
  })

  return ok(clan, undefined)
})
