// src/app/api/v1/auth/telegram/route.ts
import { NextRequest } from 'next/server'
import { validateTelegramInitData, parseTelegramInitData } from '@/lib/telegram/initData'
import { getAdminClient } from '@/lib/supabase/admin'
import { ok, err } from '@/app/api/v1/_lib/handler'
import { todayUTC } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {

  // ── 1. Body parsen ─────────────────────────────────────
  let body: { initData?: string }
  try { body = await req.json() }
  catch { return err('Invalid JSON body', 'BAD_REQUEST') }

  if (!body.initData || typeof body.initData !== 'string') {
    return err('initData is required', 'MISSING_INIT_DATA')
  }

  // ── 2. Telegram initData validieren (HMAC-SHA256) ──────
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return err('Bot token not configured', 'CONFIG_ERROR', 500)

  const { valid, reason } = validateTelegramInitData(body.initData, botToken)
  if (!valid) {
    return err(`initData validation failed: ${reason}`, 'INVALID_INIT_DATA', 401)
  }

  // ── 3. User aus initData extrahieren ───────────────────
  let parsed
  try { parsed = parseTelegramInitData(body.initData) }
  catch { return err('Failed to parse initData', 'PARSE_ERROR') }

  if (!parsed.user) return err('No user in initData', 'NO_USER', 400)

  const tgUser = parsed.user
  const db     = getAdminClient()

  // ── 4. Supabase Auth User finden oder erstellen ────────
  // FIX: Direkter Lookup über email statt listUsers()
  // listUsers() ist langsam und schlägt auf Free Tier fehl
  const email = `tg_${tgUser.id}@ton-miniapp.internal`

  let authUserId: string
  let isNewUser = false

  // Versuche zuerst den User über die users-Tabelle zu finden
  const { data: existingProfile } = await (db as any)
    .from('users')
    .select('id')
    .eq('telegram_id', tgUser.id)
    .maybeSingle()

  if (existingProfile) {
    // Bestehender User -- ID aus unserer Tabelle
    authUserId = existingProfile.id

    // Auth-Metadaten aktualisieren (Name/Foto könnte sich geändert haben)
    await (db.auth.admin as any).updateUserById(authUserId, {
      user_metadata: {
        telegram_id:         tgUser.id,
        telegram_username:   tgUser.username   ?? null,
        telegram_first_name: tgUser.first_name,
      },
    }).catch(() => {}) // Fehler ignorieren falls Update scheitert

  } else {
    // Neuer User -- Supabase Auth User erstellen
    isNewUser = true

    const { data: newAuth, error: createErr } = await (db.auth.admin as any).createUser({
      email,
      email_confirm:  true,
      user_metadata: {
        telegram_id:         tgUser.id,
        telegram_username:   tgUser.username   ?? null,
        telegram_first_name: tgUser.first_name,
      },
    })

    if (createErr) {
      // Falls User bereits in Auth existiert aber nicht in users-Tabelle
      // versuchen wir ihn über Email zu finden
      if (createErr.message?.includes('already') || createErr.message?.includes('exists')) {
        // Supabase gibt manchmal diesen Fehler -- User existiert bereits in Auth
        // Suche über Admin API mit Filter
        const { data: found } = await (db.auth.admin as any).listUsers({ 
          filter: `email.eq.${email}`,
          perPage: 1 
        }).catch(() => ({ data: null }))
        
        if (found?.users?.[0]) {
          authUserId = found.users[0].id
          isNewUser  = false
        } else {
          return err(
            `Auth user creation failed: ${createErr.message}`,
            'AUTH_CREATE_ERROR',
            500
          )
        }
      } else {
        return err(
          `Auth user creation failed: ${createErr.message}`,
          'AUTH_CREATE_ERROR',
          500
        )
      }
    } else {
      authUserId = newAuth.user.id
    }
  }

  // ── 5. Aktive Saison holen ─────────────────────────────
  const { data: season } = await (db as any)
    .from('seasons')
    .select('id')
    .eq('status', 'active')
    .maybeSingle()

  // ── 6. User-Profil upserten ────────────────────────────
  const { error: upsertErr } = await (db as any).from('users').upsert(
    {
      id:                     authUserId,
      telegram_id:            tgUser.id,
      telegram_username:      tgUser.username      ?? null,
      telegram_first_name:    tgUser.first_name,
      telegram_last_name:     tgUser.last_name     ?? null,
      telegram_photo_url:     tgUser.photo_url     ?? null,
      telegram_language_code: tgUser.language_code ?? 'en',
      telegram_is_premium:    tgUser.is_premium    ?? false,
      last_active_at:         new Date().toISOString(),
      current_season_id:      season?.id           ?? null,
    },
    { onConflict: 'telegram_id' }
  )

  if (upsertErr) {
    return err(`Profile upsert failed: ${upsertErr.message}`, 'PROFILE_ERROR', 500)
  }

  // ── 7. Tagesquests zuweisen falls nötig ───────────────
  if (isNewUser) {
    await assignDailyQuests(authUserId, season?.id ?? null)
  } else {
    await ensureDailyQuests(authUserId, season?.id ?? null)
  }

  // ── 8. Session erstellen ───────────────────────────────
  const { data: session, error: sessionErr } = await (db.auth.admin as any).createSession({
    user_id: authUserId,
  })

  if (sessionErr || !session) {
    return err('Session creation failed', 'SESSION_ERROR', 500)
  }

  return ok({
    accessToken:  session.access_token,
    refreshToken: session.refresh_token,
    expiresIn:    session.expires_in,
    userId:       authUserId,
    isNewUser,
  })
}

// ── Hilfsfunktionen ────────────────────────────────────────

async function assignDailyQuests(userId: string, seasonId: string | null) {
  const db    = getAdminClient()
  const today = todayUTC()

  const { data: templates } = await (db as any)
    .from('quest_templates')
    .select('id, difficulty')
    .eq('quest_type', 'daily')
    .eq('is_active', true)

  if (!templates?.length) return

  const easy    = templates.filter((t: any) => t.difficulty === 'easy').slice(0, 3)
  const medium  = templates.filter((t: any) => t.difficulty === 'medium').slice(0, 2)
  const hard    = templates.filter((t: any) => t.difficulty === 'hard').slice(0, 1)
  const toAssign = [...easy, ...medium, ...hard]

  await (db as any).from('daily_quest_assignments').upsert(
    toAssign.map((t: any) => ({
      user_id:     userId,
      template_id: t.id,
      quest_date:  today,
      season_id:   seasonId,
      status:      'available',
    })),
    { onConflict: 'user_id,template_id,quest_date' }
  )
}

async function ensureDailyQuests(userId: string, seasonId: string | null) {
  const db    = getAdminClient()
  const today = todayUTC()

  const { count } = await (db as any)
    .from('daily_quest_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('quest_date', today)

  if ((count ?? 0) === 0) {
    await assignDailyQuests(userId, seasonId)
  }

  // last_active_at aktualisieren
  await (db as any)
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId)
}
