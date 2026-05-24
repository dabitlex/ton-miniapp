// supabase/functions/leaderboard-refresh/index.ts
// Cron: "*/5 * * * *" — runs every 5 minutes

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  const start = Date.now()

  const { data, error } = await db.rpc('refresh_leaderboard_cache')

  if (error) {
    console.error('[leaderboard-refresh] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response(JSON.stringify({
    refreshed: true,
    rows:      data,
    duration_ms: Date.now() - start,
  }), { status: 200 })
})