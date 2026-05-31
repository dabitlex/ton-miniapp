// src/app/api/admin/auth/route.ts
// Telegram Login Widget Verifikation → Admin Session erstellen
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

// Telegram Login Widget HMAC Verifikation
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

  let body: Record<string, string>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Telegram Login Widget Daten prüfen
  if (!verifyTelegramLogin(body, botToken)) {
    return NextResponse.json({ error: 'Invalid Telegram auth data' }, { status: 401 })
  }

  // Auth-Daten dürfen max. 5 Minuten alt sein
  const authDate = parseInt(body.auth_date ?? '0')
  if (Date.now() / 1000 - authDate > 300) {
    return NextResponse.json({ error: 'Auth data expired' }, { status: 401 })
  }

  const telegramId = parseInt(body.id ?? '0')

  const supabase = db()

  // Prüfen ob Admin
  const { data: admin } = await supabase
    .from('admin_users')
    .select('telegram_id, role, telegram_username')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  if (!admin) {
    // Kein Admin → trotzdem 200 aber kein Token (Security through obscurity)
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // Session erstellen
  const { data: session } = await supabase
    .from('admin_sessions')
    .insert({
      telegram_id: telegramId,
    })
    .select('token, expires_at')
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Session creation failed' }, { status: 500 })
  }

  // Session Cookie setzen (HttpOnly, Secure)
  const response = NextResponse.json({
    success: true,
    role:    admin.role,
    username:admin.telegram_username,
  })

  response.cookies.set('admin_session', session.token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires:  new Date(session.expires_at),
    path:     '/admin',
  })

  return response
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get('admin_session')?.value
  if (token) {
    const supabase = db()
    await supabase.from('admin_sessions').delete().eq('token', token)
  }

  const response = NextResponse.json({ success: true })
  response.cookies.delete('admin_session')
  return response
}
