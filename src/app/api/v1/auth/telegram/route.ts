// src/app/api/v1/auth/telegram/route.ts
import { NextRequest }    from 'next/server'
import { validateTelegramInitData, parseTelegramInitData } from '@/lib/telegram/initData'
import { ok, err }        from '@/app/api/v1/_lib/handler'
import { todayUTC }       from '@/lib/utils'
import { createClient }   from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  })
}

export async function POST(req: NextRequest) {
  const botToken   = process.env.TELEGRAM_BOT_TOKEN
  const supaUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!botToken)   return err('TELEGRAM_BOT_TOKEN fehlt', 'CONFIG_ERROR', 500)
  if (!supaUrl)    return err('SUPABASE_URL fehlt', 'CONFIG_ERROR', 500)
  if (!serviceKey) return err('SERVICE_ROLE_KEY fehlt', 'CONFIG_ERROR', 500)

  let body: { initData?: string; photoUrl?: string | null; startParam?: string | null }
  try { body = await req.json() }
  catch { return err('Invalid JSON body', 'BAD_REQUEST') }

  if (!body.initData || typeof body.initData !== 'string') {
    return err('initData is required', 'MISSING_INIT_DATA')
  }

  const { valid, reason } = validateTelegramInitData(body.initData, botToken)
  if (!valid) return err(`initData validation failed: ${reason}`, 'INVALID_INIT_DATA', 401)

  let parsed
  try { parsed = parseTelegramInitData(body.initData) }
  catch { return err('Failed to parse initData', 'PARSE_ERROR') }

  if (!parsed.user) return err('No user in initData', 'NO_USER', 400)

  const tgUser     = parsed.user
  const email      = `tg${tgUser.id}@telegram-user.com`
  // Stabiles Passwort — unabhängig vom Bot-Token
  const password   = `Tg!${tgUser.id}!vxalgo`
  const photoUrl   = body.photoUrl   ?? tgUser.photo_url ?? null

  // start_param: kommt vom Client UND auch direkt aus initData prüfen
  // Telegram bettet start_param manchmal direkt in initData ein
  const startParamFromClient = body.startParam ?? null
  const startParamFromInit   = (parsed as any).start_param ?? null
  const startParam = startParamFromClient || startParamFromInit || null

  // Debug-Log (kann nach dem Fix entfernt werden)
  console.log('[Auth] Referral Debug:', {
    telegramId: tgUser.id,
    startParamFromClient,
    startParamFromInit,
    startParam,
    initDataKeys: Object.keys(parsed ?? {}),
  })

  const db = getServiceClient()

  // Auth-User holen oder erstellen
  let authUserId: string | null = null
  let isNewUser = false

  const { data: signInData, error: signInErr } = await db.auth.signInWithPassword({ email, password })

  if (signInData?.user?.id) {
    authUserId = signInData.user.id
  } else {
    // Login fehlgeschlagen — prüfen ob User bereits existiert (z.B. nach Bot-Wechsel)
    const { data: existingUser } = await db.auth.admin.listUsers()
    const found = existingUser?.users?.find(u => u.email === email)

    if (found?.id) {
      // User existiert → Passwort auf neues stabiles Format updaten
      await db.auth.admin.updateUserById(found.id, { password })
      authUserId = found.id
      console.log('[Auth] Passwort nach Bot-Wechsel aktualisiert für:', tgUser.id)
    } else {
      isNewUser = true
      const { data: newAuth, error: createErr } = await db.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: {
        telegram_id:         tgUser.id,
        telegram_first_name: tgUser.first_name,
        telegram_username:   tgUser.username ?? null,
      },
    })

      if (!createErr && newAuth?.user?.id) {
        authUserId = newAuth.user.id
      } else {
        const { data: signUpData, error: signUpErr } = await db.auth.signUp({
          email, password,
          options: { data: { telegram_id: tgUser.id } },
        })
        if (!signUpErr && signUpData?.user?.id) {
          authUserId = signUpData.user.id
        } else {
          return err(
            `Auth failed: "${createErr?.message}" | "${signUpErr?.message}"`,
            'AUTH_CREATE_ERROR', 500
          )
        }
      }
    }
  }

  if (!authUserId) return err('No auth user ID', 'AUTH_ID_ERROR', 500)

  const { data: season } = await (db as any)
    .from('seasons').select('id, season_number').eq('status', 'active').maybeSingle()

  // Referrer ermitteln
  let referredByUserId: string | null = null
  if (startParam && startParam.length >= 8) {
    const { data: referrer } = await (db as any)
      .from('users')
      .select('id')
      .eq('referral_code', startParam.trim())
      .maybeSingle()

    console.log('[Auth] Referrer lookup:', { startParam, found: referrer?.id ?? null })

    if (referrer?.id && referrer.id !== authUserId) {
      referredByUserId = referrer.id
    }
  }

  // Bestehenden User prüfen ob er schon einen Referrer hat
  let existingReferredBy: string | null = null
  if (!isNewUser) {
    const { data: existingUser } = await (db as any)
      .from('users').select('referred_by_user_id')
      .eq('id', authUserId).single()
    existingReferredBy = existingUser?.referred_by_user_id ?? null
  }

  // User-Profil upserten
  const upsertData: any = {
    id:                     authUserId,
    telegram_id:            tgUser.id,
    telegram_username:      tgUser.username      ?? null,
    telegram_first_name:    tgUser.first_name,
    telegram_last_name:     tgUser.last_name     ?? null,
    telegram_photo_url:     photoUrl,
    telegram_language_code: tgUser.language_code ?? 'en',
    telegram_is_premium:    tgUser.is_premium    ?? false,
    last_active_at:         new Date().toISOString(),
    current_season_id:      (season as any)?.id  ?? null,
  }

  // Referrer setzen: bei neuem User ODER wenn noch kein Referrer gesetzt
  if (referredByUserId && (isNewUser || !existingReferredBy)) {
    upsertData.referred_by_user_id = referredByUserId
  }

  // Founder-Status: wer in Season 1 ("Genesis") NEU beitritt, wird dauerhaft Founding Member.
  // Nur bei Neu-Registrierung gesetzt → bestehende Founder behalten ihr Flag (Upsert lässt
  // nicht-übergebene Spalten unberührt), und Beitritte ab Season 2 erhalten es nicht.
  if (isNewUser && (season as any)?.season_number === 1) {
    upsertData.is_founder = true
  }

  const { error: upsertErr } = await (db as any).from('users').upsert(
    upsertData, { onConflict: 'telegram_id' }
  )

  if (upsertErr) {
    console.error('[Auth] Upsert failed:', upsertErr.message)
  }

  // Referral-Eintrag erstellen (neu oder nachträglich)
  if (referredByUserId && (isNewUser || !existingReferredBy)) {
    const { error: refErr } = await (db as any).from('referrals').upsert({
      referrer_id:        referredByUserId,
      referee_id:         authUserId,
      referral_code_used: startParam,
    }, { onConflict: 'referee_id' })

    if (refErr) {
      console.error('[Auth] Referral insert failed:', refErr.message)
    } else {
      console.log('[Auth] Referral saved:', { referredByUserId, authUserId })
    }
  }

  try { await ensureDailyQuests(db as any, authUserId, (season as any)?.id ?? null) }
  catch (e: any) { console.error('[Auth] Quests failed:', e?.message) }

  const { data: session, error: sessionErr } = await db.auth.signInWithPassword({ email, password })

  if (!sessionErr && session?.session) {
    return ok({
      accessToken:  session.session.access_token,
      refreshToken: session.session.refresh_token,
      expiresIn:    session.session.expires_in ?? 3600,
      userId:       authUserId,
      isNewUser,
      // Debug-Info zurückgeben (temporär)
      _debug: { startParam, referredByUserId, isNewUser },
    })
  }

  const { data: adminSess, error: adminSessErr } = await db.auth.admin.createSession({
    user_id: authUserId,
  })

  if (adminSessErr || !adminSess?.access_token) {
    return err(
      `Session failed: "${sessionErr?.message}" | "${adminSessErr?.message}"`,
      'SESSION_ERROR', 500
    )
  }

  return ok({
    accessToken:  adminSess.access_token,
    refreshToken: adminSess.refresh_token,
    expiresIn:    (adminSess as any).expires_in ?? 3600,
    userId:       authUserId,
    isNewUser,
    _debug: { startParam, referredByUserId, isNewUser },
  })
}

async function ensureDailyQuests(db: any, userId: string, seasonId: string | null) {
  const today = todayUTC()
  const { count } = await db
    .from('daily_quest_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('quest_date', today)

  if ((count ?? 0) > 0) {
    await db.from('users').update({ last_active_at: new Date().toISOString() }).eq('id', userId)
    return
  }

  const { data: templates } = await db
    .from('quest_templates').select('id, difficulty')
    .eq('quest_type', 'daily').eq('is_active', true)

  if (!templates?.length) return

  const easy   = templates.filter((t: any) => t.difficulty === 'easy').slice(0, 3)
  const medium = templates.filter((t: any) => t.difficulty === 'medium').slice(0, 2)
  const hard   = templates.filter((t: any) => t.difficulty === 'hard').slice(0, 1)

  await db.from('daily_quest_assignments').upsert(
    [...easy, ...medium, ...hard].map((t: any) => ({
      user_id: userId, template_id: t.id,
      quest_date: today, season_id: seasonId, status: 'available',
    })),
    { onConflict: 'user_id,template_id,quest_date' }
  )
}
