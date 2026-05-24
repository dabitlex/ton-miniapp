// supabase/functions/quest-assignment/index.ts
// Cron: "0 0 * * *" — runs daily at 00:00 UTC
// Assigns fresh daily quests to all active users

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  const start = Date.now()
  const today = new Date().toISOString().split('T')[0]!

  // 1. Get active season
  const { data: season } = await db
    .from('seasons')
    .select('id')
    .eq('status', 'active')
    .maybeSingle()

  // 2. Get quest templates
  const { data: templates } = await db
    .from('quest_templates')
    .select('id, difficulty')
    .eq('quest_type', 'daily')
    .eq('is_active', true)

  if (!templates?.length) {
    return new Response(JSON.stringify({ error: 'No daily quest templates found' }), { status: 500 })
  }

  const easy   = templates.filter(t => t.difficulty === 'easy').slice(0, 3)
  const medium = templates.filter(t => t.difficulty === 'medium').slice(0, 2)
  const hard   = templates.filter(t => t.difficulty === 'hard').slice(0, 1)
  const toAssign = [...easy, ...medium, ...hard]

  // 3. Get active users (logged in within last 14 days)
  const cutoff = new Date(Date.now() - 14 * 86400_000).toISOString()
  const { data: users, error: usersErr } = await db
    .from('users')
    .select('id')
    .gte('last_active_at', cutoff)
    .eq('is_banned', false)

  if (usersErr) {
    return new Response(JSON.stringify({ error: usersErr.message }), { status: 500 })
  }

  // 4. Also expire yesterday's incomplete quests
  const yesterday = new Date(Date.now() - 86400_000).toISOString().split('T')[0]!
  await db
    .from('daily_quest_assignments')
    .update({ status: 'expired' })
    .eq('quest_date', yesterday)
    .in('status', ['available', 'active'])

  // 5. Batch-insert assignments (upsert: skip existing)
  const assignments = (users ?? []).flatMap(u =>
    toAssign.map(t => ({
      user_id:     u.id,
      template_id: t.id,
      quest_date:  today,
      season_id:   season?.id ?? null,
      status:      'available',
    }))
  )

  let processed = 0
  const CHUNK = 500
  for (let i = 0; i < assignments.length; i += CHUNK) {
    const { error } = await db
      .from('daily_quest_assignments')
      .upsert(assignments.slice(i, i + CHUNK), { onConflict: 'user_id,template_id,quest_date' })
    if (!error) processed += Math.min(CHUNK, assignments.length - i)
  }

  // 6. Log result
  await db.from('system_events').insert({
    event_type:  'quest_assignment_complete',
    payload:     { date: today, users: users?.length ?? 0, assignments: processed },
    success:     true,
    duration_ms: Date.now() - start,
  })

  // 7. Prune expired nonces (older than 48h)
  await db
    .from('action_nonces')
    .delete()
    .lt('expires_at', new Date(Date.now() - 48 * 3600_000).toISOString())

  return new Response(JSON.stringify({
    date: today,
    users: users?.length ?? 0,
    assignments: processed,
    duration_ms: Date.now() - start,
  }), { status: 200 })
})