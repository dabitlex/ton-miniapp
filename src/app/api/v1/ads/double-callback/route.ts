// src/app/api/v1/ads/double-callback/route.ts
// Adsgram Server-to-Server Reward-Callback für den DOPPEL-Block.
// Adsgram ruft diese URL auf, NACHDEM der Nutzer die Doppel-Werbung zu Ende
// gesehen hat:
//   https://ton-miniapp-bice.vercel.app/api/v1/ads/double-callback?secret=<SECRET>&userid=[userId]
// Wirkung: schreibt EINE server-bestätigte "Doppel-Gutschrift" (quest_double_credits).
// Bewusst KEIN +50-XP und KEIN Verbrauch des normalen 5/Tag-Ad-Limits — dieser
// Block dient ausschließlich dem Quest-Doppeln.
// SECURITY: Eigenes Secret (ADSGRAM_DOUBLE_SECRET), getrennt vom normalen Ad-Block.

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const url    = new URL(req.url)
  const secret = url.searchParams.get('secret')
  const userid = url.searchParams.get('userid')

  // 1. Secret prüfen (eigenes Secret für den Doppel-Block)
  if (!secret || secret !== process.env.ADSGRAM_DOUBLE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Telegram-ID validieren
  const telegramId = Number(userid)
  if (!userid || !Number.isFinite(telegramId) || telegramId <= 0) {
    return NextResponse.json({ error: 'Invalid userid' }, { status: 400 })
  }

  const supabase = db()

  // 3. Nutzer finden
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, is_banned')
    .eq('telegram_id', telegramId)
    .single()

  // 200 zurückgeben, damit Adsgram nicht in eine Retry-Schleife läuft
  if (userErr || !user) return NextResponse.json({ credited: false, reason: 'user_not_found' })
  if ((user as any).is_banned) return NextResponse.json({ credited: false, reason: 'banned' })

  const userId = (user as any).id as string

  // 4. Server-bestätigte Doppel-Gutschrift schreiben
  const { error: insErr } = await supabase
    .from('quest_double_credits')
    .insert({
      user_id:  userId,
      block_id: url.searchParams.get('blockid') ?? null,
    })

  if (insErr) {
    console.error('[DoubleCallback] insert error:', insErr.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ credited: true })
}

// Adsgram ruft die Reward-URL per GET auf; POST als Absicherung.
export async function GET(req: NextRequest)  { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
