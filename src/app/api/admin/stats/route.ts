// src/app/api/admin/stats/route.ts
// Admin API — Live Statistiken
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_session')?.value
  if (!token) return false

  const { data } = await db()
    .from('admin_sessions')
    .select('telegram_id')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  return !!data
}

export async function GET(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = db()
  const today    = new Date().toISOString().split('T')[0]!
  const weekAgo  = new Date(Date.now() - 7 * 86400000).toISOString()

  const [
    { count: totalUsers },
    { count: activeToday },
    { count: newToday },
    { data: topUsers },
    { count: pendingTx },
    { count: confirmedTx },
    { data: recentTx },
    { data: clanStats },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('user_daily_stats').select('*', { count: 'exact', head: true })
      .eq('stat_date', today).eq('was_active', true),
    supabase.from('users').select('*', { count: 'exact', head: true })
      .gte('created_at', today),
    supabase.from('users').select('telegram_first_name, telegram_username, level, season_xp, league')
      .order('season_xp', { ascending: false }).limit(5),
    supabase.from('ton_transactions').select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase.from('ton_transactions').select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed'),
    supabase.from('ton_transactions')
      .select('tx_hash, status, amount_nano, created_at, confirmed_at')
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('clans').select('name, member_count, season_xp')
      .eq('is_active', true).order('season_xp', { ascending: false }).limit(5),
  ])

  // XP heute gesamt
  const { data: xpToday } = await supabase
    .from('user_daily_stats')
    .select('xp_earned')
    .eq('stat_date', today)
  const totalXpToday = (xpToday ?? []).reduce((sum, r) => sum + (r.xp_earned ?? 0), 0)

  // Neue User letzte 7 Tage
  const { data: newUsers7d } = await supabase
    .from('users')
    .select('created_at')
    .gte('created_at', weekAgo)

  return NextResponse.json({
    users: {
      total:       totalUsers ?? 0,
      activeToday: activeToday ?? 0,
      newToday:    newToday ?? 0,
      newLast7d:   newUsers7d?.length ?? 0,
    },
    xp: {
      totalToday: totalXpToday,
    },
    transactions: {
      pending:   pendingTx ?? 0,
      confirmed: confirmedTx ?? 0,
      recent:    recentTx ?? [],
    },
    topPlayers: topUsers ?? [],
    topClans:   clanStats ?? [],
    timestamp:  new Date().toISOString(),
  })
}
