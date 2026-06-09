// src/app/api/v1/ads/reward/route.ts
// Adsgram Server-to-Server Reward-Callback.
// Adsgram ruft diese URL auf, NACHDEM der Nutzer die Werbung zu Ende gesehen hat:
//   https://ton-miniapp-bice.vercel.app/api/v1/ads/reward?secret=<SECRET>&userid=[userId]
// [userId] wird von Adsgram durch die Telegram-ID des Nutzers ersetzt.
// SECURITY: Der Server ist die einzige Wahrheit — niemals dem Client glauben.
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Konfiguration ──────────────────────────────────────────────
const DAILY_AD_LIMIT = 5    // max. belohnte Ads pro Nutzer/Tag
const XP_PER_AD       = 50   // XP pro Ad

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const url    = new URL(req.url)
  const secret = url.searchParams.get('secret')
  const userid = url.searchParams.get('userid')

  // ── 1. Secret prüfen ─────────────────────────────────────────
  if (!secret || secret !== process.env.ADSGRAM_REWARD_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Telegram-ID validieren ────────────────────────────────
  const telegramId = Number(userid)
  if (!userid || !Number.isFinite(telegramId) || telegramId <= 0) {
    return NextResponse.json({ error: 'Invalid userid' }, { status: 400 })
  }

  const supabase = db()

  // ── 3. Nutzer finden ─────────────────────────────────────────
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, is_banned')
    .eq('telegram_id', telegramId)
    .single()

  if (userErr || !user) {
    // 200 zurückgeben, damit Adsgram nicht in eine Retry-Schleife läuft
    return NextResponse.json({ rewarded: false, reason: 'user_not_found' })
  }
  if ((user as any).is_banned) {
    return NextResponse.json({ rewarded: false, reason: 'banned' })
  }

  const userId = (user as any).id as string

  // ── 4. Tages-Limit prüfen ────────────────────────────────────
  const { count, error: countErr } = await supabase
    .from('ad_views')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('view_date', todayUTC())

  if (countErr) {
    console.error('[AdsReward] count error:', countErr.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if ((count ?? 0) >= DAILY_AD_LIMIT) {
    // Limit erreicht — kein weiterer Reward, aber 200 (kein Fehler)
    return NextResponse.json({ rewarded: false, reason: 'daily_limit' })
  }

  // ── 5. Ad-View speichern ─────────────────────────────────────
  const { data: view, error: insErr } = await supabase
    .from('ad_views')
    .insert({
      user_id:     userId,
      telegram_id: telegramId,
      block_id:    url.searchParams.get('blockid') ?? null,
      xp_granted:  0,
      source:      'adsgram',
    })
    .select('id')
    .single()

  if (insErr || !view) {
    console.error('[AdsReward] insert error:', insErr?.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  const adViewId = (view as any).id as string

  // ── 6. XP gutschreiben (server-autoritativ) ──────────────────
  // grant_xp respektiert den 5000er-Tages-Soft-Cap automatisch.
  const { data: grantRes, error: grantErr } = await supabase.rpc('grant_xp', {
    p_user_id:       userId,
    p_xp_base:       XP_PER_AD,
    p_source_type:   'ad_reward',
    p_source_ref_id: adViewId,
  })

  let xpGranted = 0
  if (grantErr) {
    console.error('[AdsReward] grant_xp error:', grantErr.message)
    // Ad-View bleibt gespeichert (zählt fürs Limit/Quest), XP konnte nicht vergeben werden
  } else {
    xpGranted = (grantRes as any[])?.[0]?.xp_granted ?? 0
    await supabase.from('ad_views').update({ xp_granted: xpGranted }).eq('id', adViewId)
  }

  return NextResponse.json({
    rewarded: true,
    xp:       xpGranted,
    today:    (count ?? 0) + 1,
    limit:    DAILY_AD_LIMIT,
  })
}

// Adsgram ruft die Reward-URL per GET auf; POST als Absicherung.
export async function GET(req: NextRequest)  { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
