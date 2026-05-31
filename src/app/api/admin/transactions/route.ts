// src/app/api/admin/transactions/route.ts
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

  const { data } = await db()
    .from('ton_transactions')
    .select('id, tx_hash, amount_nano, status, created_at, confirmed_at, sender_address')
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ transactions: data ?? [] })
}
