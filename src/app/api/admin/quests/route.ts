// src/app/api/admin/quests/route.ts
// Quest Templates verwalten
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
  const { data } = await db().from('admin_sessions')
    .select('telegram_id').eq('token', token)
    .gt('expires_at', new Date().toISOString()).maybeSingle()
  return !!data
}

// GET — Alle Quest Templates
export async function GET(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await db()
    .from('quest_templates')
    .select('*')
    .order('quest_type', { ascending: true })
    .order('sort_order', { ascending: true })

  return NextResponse.json({ quests: data ?? [] })
}

// POST — Neues Quest Template erstellen
export async function POST(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const {
    internal_code, title, description,
    difficulty, quest_type, energy_cost,
    xp_reward, icon_key, sort_order,
    verification_type, verification_value
  } = body

  if (!internal_code || !title || !quest_type || !difficulty) {
    return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 })
  }

  const { data, error } = await db()
    .from('quest_templates')
    .insert({
      internal_code,
      title,
      description:        description ?? '',
      difficulty,
      quest_type,
      energy_cost:        energy_cost ?? 5,
      xp_reward:          xp_reward ?? 80,
      icon_key:           icon_key ?? '⚔️',
      sort_order:         sort_order ?? 99,
      is_active:          true,
      // Verifikations-Metadaten
      metadata: {
        verification_type:  verification_type ?? 'none',
        verification_value: verification_value ?? null,
      }
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quest: data })
}

// PATCH — Quest Template aktualisieren
export async function PATCH(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 })

  const { data, error } = await db()
    .from('quest_templates')
    .update(updates)
    .eq('id', id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quest: data })
}
