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

  // ── 2. Telegram initData validieren ───────────────────
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return err('Bot token not configured', 'CONFIG_ERROR', 500)

  const { valid, reason } = validateTelegramInitData(body.initData, botToken)
  if (!valid) {
    return err(`initData validation failed: ${reason}`, 'INVALID_INIT_DATA', 401)
  }

  let parsed
  try { parsed = parseTelegramInitData(body.initData) }
  catch { return err('Failed to parse initData', 'PARSE_ERROR') }

  if (!parsed.user) return err('No user in initData', 'NO_USER', 400)

  const tgUser   = parsed.user
  const db       = getAdminClient()
  const email    = `tg${tgUser.id}@telegram-user.com`
  const password = `Tg!${tgUser.id}${botToken.slice(-6)}`

  // ── 3. Auth-User holen oder erstellen ─────────────────
  // Zuerst in auth.users per Email suchen
  let authUserId: string | null = null
  let isNewUser = false

  // Versuch: direkt einloggen (User existiert bereits)
  const { data: signInData } = await db.auth.signInWithPassword({ email, password })

  if (signInData?.user?.id) {
    authUserId = signInData.user.id
  } else {
    // Neuer User — mit admin.createUser anlegen
    isNewUser = true
    const { data: newAuth, error: createErr } = await (db.auth.admin as any).createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        telegram_id:         tgUser.id,
        telegram_first_name: tgUser.first_name,
        telegram_username:   tgUser.username ?? null,
      },
    })

    if (createErr || !newAuth?.user?.id) {
      return err(
        `Auth creation failed: ${createErr?.message ?? 'unknown error'}`,
        'AUTH_CREATE_ERROR',
        500
      )
    }
    authUserId = newAuth.user.id
  }

  if (!authUserId) {
    return err('Could not determine auth user ID', 'AUTH_ID_ERROR', 500)
  }

  // ── 4. Aktive Saison ──────────────────────────────────
  const { data: season } = await (db as any)
    .from('seasons')
    .select('id')
    .eq('status', 'active')
    .maybeSingle()

  // ── 5. User-Profil in public.users upserten ───────────
  // Service Role umgeht RLS — sollte immer funktionieren
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

  // Upsert-Fehler NICHT ignorieren — zurückgeben damit wir ihn sehen
  if (upsertErr) {
    return err(
      `Profile upsert failed: ${upsertErr.message} | Code: ${upsertErr.code}`,
      'PROFILE_UPSERT_ERROR',
      500
    )
  }

  // ── 6. Tagesquests sicherstellen ──────────────────────
  try {
    await ensureDailyQuests(authUserId, season?.id ?? null)
  } catch (e: any) {
    // Quests-Fehler ist nicht kritisch — App kann trotzdem starten
    console.error('[Auth] Quest assignment failed:', e?.message)
  }

  // ── 7. Session erstellen ──────────────────────────────
  // signInWithPassword gibt direkt eine Session zurück
  const { data: sessionData, error: sessionErr } = await db.auth.signInWithPassword({
    email,
    password,
  })

  if (sessionErr || !sessionData?.session) {
    // Fallback: admin.createSession
    const { data: adminSess, error: adminErr } = await (db.auth.admin as any)
      .createSession({ user_id: authUserId })

    if (adminErr || !adminSess?.access_token) {
      return err(
        `Session failed: ${sessionErr?.message} | admin: ${adminErr?.message}`,
        'SESSION_ERROR',
        500
      )
    }

    return ok({
      accessToken:  adminSess.access_token,
      refreshToken: adminSess.refresh_token,
      expiresIn:    adminSess.expires_in ?? 3600,
      userId:       authUserId,
      isNewUser,
    })
  }

  return ok({
    accessToken:  sessionData.session.access_token,
    refreshToken: sessionData.session.refresh_token,
    expiresIn:    sessionData.session.expires_in ?? 3600,
    userId:       authUserId,
    isNewUser,
  })
}

// ── Tagesquests sicherstellen ─────────────────────────────

async function ensureDailyQuests(userId: string, seasonId: string | null) {
  const db    = getAdminClient()
  const today = todayUTC()

  const { count } = await (db as any)
    .from('daily_quest_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('quest_date', today)

  if ((count ?? 0) > 0) {
    await (db as any)
      .from('users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', userId)
    return
  }

  const { data: templates } = await (db as any)
    .from('quest_templates')
    .select('id, difficulty')
    .eq('quest_type', 'daily')
    .eq('is_active', true)

  if (!templates?.length) return

  const easy   = templates.filter((t: any) => t.difficulty === 'easy').slice(0, 3)
  const medium = templates.filter((t: any) => t.difficulty === 'medium').slice(0, 2)
  const hard   = templates.filter((t: any) => t.difficulty === 'hard').slice(0, 1)

  await (db as any).from('daily_quest_assignments').upsert(
    [...easy, ...medium, ...hard].map((t: any) => ({
      user_id:     userId,
      template_id: t.id,
      quest_date:  today,
      season_id:   seasonId,
      status:      'available',
    })),
    { onConflict: 'user_id,template_id,quest_date' }
  )
}
