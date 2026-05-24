// src/app/api/v1/auth/telegram/route.ts
import { NextRequest } from 'next/server'
import { validateTelegramInitData, parseTelegramInitData } from '@/lib/telegram/initData'
import { getAdminClient } from '@/lib/supabase/admin'
import { ok, err } from '../_lib/handler'
import { todayUTC } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // ── 1. Parse body ──────────────────────────────────────────────────
  let body: { initData?: string }
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 'BAD_REQUEST')
  }

  if (!body.initData || typeof body.initData !== 'string') {
    return err('initData is required', 'MISSING_INIT_DATA')
  }

  // ── 2. Validate HMAC signature (server-side only) ───────────────────
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return err('Bot token not configured', 'CONFIG_ERROR', 500)

  const { valid, reason } = validateTelegramInitData(body.initData, botToken)
  if (!valid) {
    return err(`initData validation failed: ${reason}`, 'INVALID_INIT_DATA', 401)
  }

  // ── 3. Parse user from initData ────────────────────────────────────
  let parsed
  try {
    parsed = parseTelegramInitData(body.initData)
  } catch {
    return err('Failed to parse initData', 'PARSE_ERROR')
  }

  if (!parsed.user) {
    return err('No user data in initData', 'NO_USER', 400)
  }

  const tgUser = parsed.user
  const db = getAdminClient()
  const email = `tg_${tgUser.id}@ton-miniapp.internal`

  // ── 4. Upsert Supabase auth user ───────────────────────────────────
  let authUserId: string
  let isNewUser = false

  // Try to find existing user by email
  const { data: { users: existingUsers } } = await db.auth.admin.listUsers()
  const existing = existingUsers.find(u => u.email === email)

  if (existing) {
    authUserId = existing.id
    // Update metadata if name/photo changed
    await db.auth.admin.updateUserById(authUserId, {
      user_metadata: {
        telegram_id: tgUser.id,
        telegram_username: tgUser.username ?? null,
        telegram_first_name: tgUser.first_name,
      },
    })
  } else {
    const { data: newAuth, error: createErr } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        telegram_id: tgUser.id,
        telegram_username: tgUser.username ?? null,
        telegram_first_name: tgUser.first_name,
      },
    })
    if (createErr || !newAuth.user) {
      return err(`Auth user creation failed: ${createErr?.message}`, 'AUTH_CREATE_ERROR', 500)
    }
    authUserId = newAuth.user.id
    isNewUser = true
  }

  // ── 5. Get active season ───────────────────────────────────────────
  const { data: season } = await db
    .from('seasons')
    .select('id')
    .eq('status', 'active')
    .maybeSingle()

  // ── 6. Upsert user profile ─────────────────────────────────────────
  const { error: upsertErr } = await db.from('users').upsert(
    {
      id: authUserId,
      telegram_id: tgUser.id,
      telegram_username: tgUser.username ?? null,
      telegram_first_name: tgUser.first_name,
      telegram_last_name: tgUser.last_name ?? null,
      telegram_photo_url: tgUser.photo_url ?? null,
      telegram_language_code: tgUser.language_code ?? 'en',
      telegram_is_premium: tgUser.is_premium ?? false,
      last_active_at: new Date().toISOString(),
      current_season_id: season?.id ?? null,
    },
    { onConflict: 'telegram_id' }
  )

  if (upsertErr) {
    return err(`Profile upsert failed: ${upsertErr.message}`, 'PROFILE_ERROR', 500)
  }

  // ── 7. Initialize new user defaults ───────────────────────────────
  if (isNewUser) {
    // antibot_scores and user_settings are created by DB trigger on users INSERT
    // Assign daily quests for today
    await assignDailyQuests(authUserId, season?.id ?? null)
  } else {
    // Returning user — update streak + ensure today's quests exist
    await updateLastActive(authUserId)
    await ensureDailyQuests(authUserId, season?.id ?? null)
  }

  // ── 8. Issue session ───────────────────────────────────────────────
  const { data: session, error: sessionErr } = await db.auth.admin.createSession({
    user_id: authUserId,
  })

  if (sessionErr || !session) {
    return err('Session creation failed', 'SESSION_ERROR', 500)
  }

  return ok({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
    userId: authUserId,
    isNewUser,
  })
}

// ── Helpers ────────────────────────────────────────────────────────────

async function assignDailyQuests(userId: string, seasonId: string | null) {
  const db = getAdminClient()
  const today = todayUTC()

  const { data: templates } = await db
    .from('quest_templates')
    .select('id, difficulty')
    .eq('quest_type', 'daily')
    .eq('is_active', true)

  if (!templates) return

  const easy   = templates.filter(t => t.difficulty === 'easy').slice(0, 3)
  const medium = templates.filter(t => t.difficulty === 'medium').slice(0, 2)
  const hard   = templates.filter(t => t.difficulty === 'hard').slice(0, 1)
  const toAssign = [...easy, ...medium, ...hard]

  await db.from('daily_quest_assignments').upsert(
    toAssign.map(t => ({
      user_id: userId,
      template_id: t.id,
      quest_date: today,
      season_id: seasonId,
      status: 'available',
    })),
    { onConflict: 'user_id,template_id,quest_date' }
  )
}

async function ensureDailyQuests(userId: string, seasonId: string | null) {
  const db = getAdminClient()
  const today = todayUTC()

  const { count } = await db
    .from('daily_quest_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('quest_date', today)

  if ((count ?? 0) === 0) {
    await assignDailyQuests(userId, seasonId)
  }
}

async function updateLastActive(userId: string) {
  const db = getAdminClient()
  await db
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId)
}