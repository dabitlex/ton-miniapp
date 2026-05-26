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

  const tgUser = parsed.user
  const db     = getAdminClient()
  const email  = `tg_${tgUser.id}@ton-miniapp.internal`

  // ── 3. User in unserer Tabelle suchen ─────────────────
  // Primärer Lookup: telegram_id in public.users
  const { data: existingProfile } = await (db as any)
    .from('users')
    .select('id')
    .eq('telegram_id', tgUser.id)
    .maybeSingle()

  let authUserId: string
  let isNewUser = false

  if (existingProfile?.id) {
    // ── Bestehender User ──────────────────────────────
    authUserId = existingProfile.id

  } else {
    // ── Neuer User — Auth-Account erstellen ──────────
    isNewUser  = true
    authUserId = await createAuthUser(db, email, tgUser)

    if (!authUserId) {
      return err(
        'Auth user creation failed — bitte prüfe Supabase Authentication Settings: ' +
        'Dashboard → Authentication → Settings → "Disable new user signups" muss OFF sein.',
        'AUTH_CREATE_ERROR',
        500
      )
    }
  }

  // ── 4. Aktive Saison ──────────────────────────────────
  const { data: season } = await (db as any)
    .from('seasons')
    .select('id')
    .eq('status', 'active')
    .maybeSingle()

  // ── 5. User-Profil upserten ───────────────────────────
  await (db as any).from('users').upsert(
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

  // ── 6. Tagesquests sicherstellen ──────────────────────
  await ensureDailyQuests(authUserId, season?.id ?? null)

  // ── 7. Session erstellen ──────────────────────────────
  const { data: session, error: sessionErr } = await (db.auth.admin as any)
    .createSession({ user_id: authUserId })

  if (sessionErr || !session) {
    // Fallback: signInWithPassword versuchen
    const { data: fallbackSession } = await db.auth.signInWithPassword({
      email,
      password: `tg_secure_${tgUser.id}_${botToken.slice(-8)}`,
    })
    if (!fallbackSession?.session) {
      return err('Session creation failed', 'SESSION_ERROR', 500)
    }
    return ok({
      accessToken:  fallbackSession.session.access_token,
      refreshToken: fallbackSession.session.refresh_token,
      expiresIn:    fallbackSession.session.expires_in,
      userId:       authUserId,
      isNewUser,
    })
  }

  return ok({
    accessToken:  session.access_token,
    refreshToken: session.refresh_token,
    expiresIn:    session.expires_in,
    userId:       authUserId,
    isNewUser,
  })
}

// ── Auth-User erstellen mit mehreren Fallbacks ─────────────

async function createAuthUser(db: any, email: string, tgUser: any): Promise<string> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? ''

  // Versuch 1: admin.createUser
  const { data: newAuth, error: createErr } = await (db.auth.admin as any).createUser({
    email,
    email_confirm:    true,
    password:         `tg_secure_${tgUser.id}_${botToken.slice(-8)}`,
    user_metadata: {
      telegram_id:         tgUser.id,
      telegram_username:   tgUser.username   ?? null,
      telegram_first_name: tgUser.first_name,
    },
  })

  if (!createErr && newAuth?.user?.id) {
    return newAuth.user.id
  }

  // Versuch 2: signUp (falls admin API blockiert ist)
  if (createErr?.message?.includes('not allowed') ||
      createErr?.message?.includes('Not allowed') ||
      createErr?.message?.includes('signup')) {

    const { data: signUpData, error: signUpErr } = await db.auth.signUp({
      email,
      password: `tg_secure_${tgUser.id}_${botToken.slice(-8)}`,
      options: {
        data: {
          telegram_id:         tgUser.id,
          telegram_username:   tgUser.username   ?? null,
          telegram_first_name: tgUser.first_name,
        },
      },
    })

    if (!signUpErr && signUpData?.user?.id) {
      return signUpData.user.id
    }
  }

  // Versuch 3: User existiert bereits in Auth aber nicht in users-Tabelle
  // Versuch über signInWithPassword
  const { data: signInData } = await db.auth.signInWithPassword({
    email,
    password: `tg_secure_${tgUser.id}_${botToken.slice(-8)}`,
  })

  if (signInData?.user?.id) {
    return signInData.user.id
  }

  return ''
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
    // Quests existieren bereits — nur last_active_at updaten
    await (db as any)
      .from('users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', userId)
    return
  }

  // Quests zuweisen
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
