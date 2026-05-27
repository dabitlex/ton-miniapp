// src/app/api/v1/auth/telegram/route.ts
import { NextRequest } from 'next/server'
import { validateTelegramInitData, parseTelegramInitData } from '@/lib/telegram/initData'
import { getAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@supabase/supabase-js'
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

  // ── 2. Env prüfen ─────────────────────────────────────
  const botToken   = process.env.TELEGRAM_BOT_TOKEN
  const supaUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!botToken)   return err('TELEGRAM_BOT_TOKEN not configured', 'CONFIG_ERROR', 500)
  if (!supaUrl)    return err('NEXT_PUBLIC_SUPABASE_URL not configured', 'CONFIG_ERROR', 500)
  if (!serviceKey) return err('SUPABASE_SERVICE_ROLE_KEY not configured', 'CONFIG_ERROR', 500)

  // ── 3. Telegram initData validieren ───────────────────
  const { valid, reason } = validateTelegramInitData(body.initData, botToken)
  if (!valid) {
    return err(`initData validation failed: ${reason}`, 'INVALID_INIT_DATA', 401)
  }

  let parsed
  try { parsed = parseTelegramInitData(body.initData) }
  catch { return err('Failed to parse initData', 'PARSE_ERROR') }

  if (!parsed.user) return err('No user in initData', 'NO_USER', 400)

  const tgUser   = parsed.user
  const email    = `tg${tgUser.id}@telegram-user.com`
  const password = `Tg!${tgUser.id}${botToken.slice(-6)}`

  // Frischen Admin-Client erstellen (nicht gecacht)
  const db = createClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // ── 4. Auth-User holen oder erstellen ─────────────────
  let authUserId: string | null = null
  let isNewUser = false

  // Versuch 1: Einloggen (User existiert bereits)
  const { data: signInData } = await db.auth.signInWithPassword({ email, password })

  if (signInData?.user?.id) {
    authUserId = signInData.user.id

  } else {
    // Versuch 2: Neuen User anlegen mit admin API
    isNewUser = true
    const { data: newAuth, error: createErr } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        telegram_id:         tgUser.id,
        telegram_first_name: tgUser.first_name,
        telegram_username:   tgUser.username ?? null,
      },
    })

    if (!createErr && newAuth?.user?.id) {
      authUserId = newAuth.user.id

    } else {
      // Versuch 3: signUp als letzter Fallback
      const { data: signUpData, error: signUpErr } = await db.auth.signUp({
        email,
        password,
        options: {
          data: {
            telegram_id:         tgUser.id,
            telegram_first_name: tgUser.first_name,
          },
        },
      })

      if (!signUpErr && signUpData?.user?.id) {
        authUserId = signUpData.user.id
      } else {
        return err(
          `All auth methods failed. createUser: "${createErr?.message}" | signUp: "${signUpErr?.message}"`,
          'AUTH_CREATE_ERROR',
          500
        )
      }
    }
  }

  if (!authUserId) {
    return err('Could not get auth user ID', 'AUTH_ID_ERROR', 500)
  }

  // ── 5. Aktive Saison ──────────────────────────────────
  const { data: season } = await db
    .from('seasons')
    .select('id')
    .eq('status', 'active')
    .maybeSingle()

  // ── 6. User-Profil in public.users schreiben ──────────
  const { error: upsertErr } = await db.from('users' as any).upsert(
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
      current_season_id:      (season as any)?.id  ?? null,
    },
    { onConflict: 'telegram_id' }
  )

  if (upsertErr) {
    return err(
      `public.users upsert failed: ${upsertErr.message} (code: ${upsertErr.code})`,
      'PROFILE_UPSERT_ERROR',
      500
    )
  }

  // ── 7. Tagesquests sicherstellen ──────────────────────
  try {
    await ensureDailyQuests(db, authUserId, (season as any)?.id ?? null)
  } catch (e: any) {
    console.error('[Auth] Quest assignment failed:', e?.message)
  }

  // ── 8. Session erstellen ──────────────────────────────
  const { data: session, error: sessionErr } = await db.auth.signInWithPassword({
    email,
    password,
  })

  if (!sessionErr && session?.session) {
    return ok({
      accessToken:  session.session.access_token,
      refreshToken: session.session.refresh_token,
      expiresIn:    session.session.expires_in ?? 3600,
      userId:       authUserId,
      isNewUser,
    })
  }

  // Fallback: admin.createSession
  const { data: adminSess, error: adminSessErr } = await db.auth.admin.createSession({
    user_id: authUserId,
  })

  if (adminSessErr || !adminSess?.access_token) {
    return err(
      `Session failed: "${sessionErr?.message}" | admin: "${adminSessErr?.message}"`,
      'SESSION_ERROR',
      500
    )
  }

  return ok({
    accessToken:  adminSess.access_token,
    refreshToken: adminSess.refresh_token,
    expiresIn:    (adminSess as any).expires_in ?? 3600,
    userId:       authUserId,
    isNewUser,
  })
}

// ── Tagesquests ────────────────────────────────────────────

async function ensureDailyQuests(db: any, userId: string, seasonId: string | null) {
  const today = todayUTC()

  const { count } = await db
    .from('daily_quest_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('quest_date', today)

  if ((count ?? 0) > 0) {
    await db.from('users').update({ last_active_at: new Date().toISOString() }).eq('id', userId)
    return
  }

  const { data: templates } = await db
    .from('quest_templates')
    .select('id, difficulty')
    .eq('quest_type', 'daily')
    .eq('is_active', true)

  if (!templates?.length) return

  const easy   = templates.filter((t: any) => t.difficulty === 'easy').slice(0, 3)
  const medium = templates.filter((t: any) => t.difficulty === 'medium').slice(0, 2)
  const hard   = templates.filter((t: any) => t.difficulty === 'hard').slice(0, 1)

  await db.from('daily_quest_assignments').upsert(
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
