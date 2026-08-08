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

    if (referrer?.id && referrer.id !== authUserId) {
      referredByUserId = referrer.id
    }
  }

  // Bestehenden User prüfen: Referrer + aktuelle Season-Zuordnung
  let existingReferredBy: string | null = null
  let existingSeasonId:   string | null = null
  if (!isNewUser) {
    const { data: existingUser } = await (db as any)
      .from('users').select('referred_by_user_id, current_season_id')
      .eq('id', authUserId).single()
    existingReferredBy = existingUser?.referred_by_user_id ?? null
    existingSeasonId   = existingUser?.current_season_id   ?? null
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

  // SEASON-GUARD (Fix Aug 2026): Wird der User hier auf eine ANDERE Season
  // umgehängt als bisher, muss season_xp mit zurückgesetzt werden — sonst
  // schleppt er seine XP der Vorsaison ins neue Leaderboard.
  // Betrifft vor allem User, die der season-rollover-Cron nicht erfasst hat
  // (current_season_id war NULL oder zeigte auf eine alte Season): deren
  // Migration passierte faktisch erst hier beim Login, aber ohne Reset.
  // Neu-Registrierungen brauchen den Reset nicht (season_xp startet bei 0).
  if (!isNewUser && (season as any)?.id && existingSeasonId !== (season as any).id) {
    upsertData.season_xp = 0
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
  })
}

// ── Fallback-Zuweisung für Nutzer, die der 00:00-Cron noch nicht kennt
// (v.a. Neuregistrierungen im Tagesverlauf).
// FIX (Season 2): identische Rotations-Logik wie die quest-assignment Edge
// Function — vorher wurden Difficulty-Slices ohne ORDER BY gezogen, wodurch
// Sets OHNE Login-Quest entstehen konnten (aus dem Kaltstart unlösbar:
// Energie-/Quest-Zähler-Quests brauchen einen ersten Claim → Deadlock).
// Jetzt bekommt jeder Nutzer exakt das offizielle, garantiert lösbare
// Tages-Set (fixe Bootstrap-Slots + deterministische Tagesrotation).
const DAILY_FIXED_EASY = ['daily_easy_login', 'daily_easy_energy5']
const DAILY_FIXED_MED  = ['daily_med_quests']
const DAILY_THIRD_EASY = ['daily_easy_quests2', 'daily_easy_energy']
const DAILY_SECOND_MED = ['daily_med_quests4', 'daily_med_energy25']
const DAILY_HARD       = ['daily_hard_champion', 'daily_hard_quests5', 'daily_hard_energy35']

const pickDaily = <T,>(arr: T[], n: number): T =>
  arr[((n % arr.length) + arr.length) % arr.length]!

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
    .from('quest_templates').select('id, internal_code, is_active')
    .eq('quest_type', 'daily')

  if (!templates?.length) return
  const byCode = new Map<string, any>(templates.map((t: any) => [t.internal_code, t]))

  // Gleiches Set wie der Cron: dayNum-Seed → identische Rotation für alle
  const dayNum = Math.floor(Date.parse(today) / 86_400_000)
  const codes = [
    ...DAILY_FIXED_EASY,
    pickDaily(DAILY_THIRD_EASY, dayNum),
    ...DAILY_FIXED_MED,
    pickDaily(DAILY_SECOND_MED, dayNum),
    pickDaily(DAILY_HARD, dayNum),
  ]

  const toAssign = codes
    .map(code => byCode.get(code))
    .filter((t: any) => !!t && t.is_active !== false)

  if (!toAssign.length) return

  await db.from('daily_quest_assignments').upsert(
    toAssign.map((t: any) => ({
      user_id: userId, template_id: t.id,
      quest_date: today, season_id: seasonId, status: 'available',
    })),
    { onConflict: 'user_id,template_id,quest_date' }
  )
}
