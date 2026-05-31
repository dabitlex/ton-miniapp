// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
  const { data } = await db().from('admin_sessions').select('telegram_id')
    .eq('token', token).gt('expires_at', new Date().toISOString()).maybeSingle()
  return !!data
}

export async function GET(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = new URL(req.url).searchParams.get('q') ?? ''

  let query = db().from('users')
    .select('id, telegram_id, telegram_first_name, telegram_last_name, telegram_username, level, league, season_xp, xp_total, is_banned, created_at')
    .order('season_xp', { ascending: false })
    .limit(20)

  if (q) {
    query = query.or(`telegram_username.ilike.%${q}%,telegram_first_name.ilike.%${q}%`)
  }

  const { data } = await query
  return NextResponse.json({ users: data ?? [] })
}
