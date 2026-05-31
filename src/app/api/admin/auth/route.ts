// src/app/api/admin/auth/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function verifyTelegramLogin(data: Record<string, string>, botToken: string): boolean {
  const { hash, ...fields } = data
  if (!hash) return false

  const checkString = Object.keys(fields)
    .sort()
    .map(k => `${k}=${fields[k]}`)
    .join('\n')

  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const hmac      = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex')

  return hmac === hash
}

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 })
  }

  let body: Record<string, any>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Alle Felder als Strings für HMAC-Verifikation
  const bodyStrings: Record<string, string> = {}
  for (const [k, v] of Object.entries(body)) {
    bodyStrings[k] = String(v)
  }

  if (!verifyTelegramLogin(bodyStrings, botToken)) {
    console.error('[Admin Auth] HMAC verification failed')
    return NextResponse.json({ error: 'Invalid Telegram auth data' }, { status: 401 })
  }

  // Auth-Daten max. 10 Minuten alt (großzügiger für Netzwerk-Delays)
  const authDate = parseInt(String(body.auth_date ?? '0'))
  if (Date.now() / 1000 - authDate > 600) {
    return NextResponse.json({ error: 'Auth data expired' }, { status: 401 })
  }

  // Telegram ID als Zahl
  const telegramId = parseInt(String(body.id ?? '0'))
  console.log('[Admin Auth] Login attempt for telegram_id:', telegramId)

  if (!telegramId) {
    return NextResponse.json({ error: 'Invalid Telegram ID' }, { status: 400 })
  }

  const supabase = db()

  // Admin prüfen — telegram_id als Zahl UND als String versuchen
  const { data: admin, error: adminError } = await supabase
    .from('admin_users')
    .select('telegram_id, role, telegram_username')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  console.log('[Admin Auth] DB result:', admin, 'Error:', adminError)

  if (!admin) {
    console.error('[Admin Auth] No admin found for telegram_id:', telegramId)
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // Session erstellen
  const { data: session, error: sessionError } = await supabase
    .from('admin_sessions')
    .insert({ telegram_id: telegramId })
    .select('token, expires_at')
    .single()

  if (!session || sessionError) {
    console.error('[Admin Auth] Session error:', sessionError)
    return NextResponse.json({ error: 'Session creation failed' }, { status: 500 })
  }

  const response = NextResponse.json({
    success:  true,
    role:     admin.role,
    username: admin.telegram_username,
  })

  response.cookies.set('admin_session', session.token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires:  new Date(session.expires_at),
    path:     '/',
  })

  return response
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get('admin_session')?.value
  if (token) {
    await db().from('admin_sessions').delete().eq('token', token)
  }
  const response = NextResponse.json({ success: true })
  response.cookies.delete('admin_session')
  return response
}
