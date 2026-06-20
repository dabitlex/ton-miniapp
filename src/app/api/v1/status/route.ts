// src/app/api/v1/status/route.ts
// VEXALGO — App-Status (öffentlich, KEIN Auth nötig).
// Liefert, ob die App im Maintenance Mode ist. Der Admin (per Telegram-ID)
// umgeht die Wartung, damit er während des Updates testen kann.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_TELEGRAM_ID = 1900315719

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const supabase = db()

  // Maintenance-Flag lesen (Helper aus app_config)
  let maintenance = false
  try {
    const { data } = await supabase.rpc('is_feature_enabled', { p_key: 'maintenance_mode' })
    maintenance = data === true
  } catch {
    // Im Fehlerfall NICHT in Wartung gehen (App bleibt nutzbar).
    maintenance = false
  }

  // Admin-Bypass: Wenn ein gültiger Token vom Admin kommt, ist für ihn
  // KEINE Wartung — er kann testen, während Nutzer den Screen sehen.
  if (maintenance) {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
    if (token) {
      try {
        const { data: { user } } = await supabase.auth.getUser(token)
        const tgId = Number(user?.user_metadata?.['telegram_id'] ?? 0)
        if (tgId === ADMIN_TELEGRAM_ID) {
          maintenance = false  // Admin umgeht die Wartung
        }
      } catch {
        // Token ungültig → bleibt bei maintenance=true
      }
    }
  }

  // Optionale Wartungs-Nachricht (falls gesetzt)
  let message: string | null = null
  if (maintenance) {
    try {
      const { data } = await supabase
        .from('app_config').select('value').eq('key', 'maintenance_message').maybeSingle()
      message = (data as any)?.value ?? null
    } catch { /* ignore */ }
  }

  return NextResponse.json({ maintenance, message })
}
