// src/app/api/v1/achievements/route.ts
// VEXALGO — Achievement-Seite: liefert alle Achievements eines Users
// mit Freischaltungsstatus + Live-Fortschritt (für die /achievements-Seite).
import { withAuth, ok } from '@/app/api/v1/_lib/handler'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export const GET = withAuth(async (ctx) => {
  const supabase = db()

  // Eine DB-Funktion liefert alles: Definition + unlocked + progress
  const { data, error } = await supabase
    .rpc('get_user_achievements', { p_user_id: ctx.userId })

  if (error) {
    // Bei Fehler: leere Liste statt Crash (Seite bleibt benutzbar)
    return ok({ achievements: [], unlockedCount: 0, totalCount: 0 })
  }

  const rows = (data ?? []) as Array<{
    code: string
    title: string
    description: string
    category: string
    icon_code: string
    threshold: number | null
    xp_reward: number
    sort_order: number
    unlocked: boolean
    unlocked_at: string | null
    progress: number
  }>

  // In ein sauberes Frontend-Format mappen (camelCase)
  const achievements = rows.map(r => ({
    code:        r.code,
    title:       r.title,
    description: r.description,
    category:    r.category,
    iconCode:    r.icon_code,
    threshold:   r.threshold,
    xpReward:    r.xp_reward,
    unlocked:    r.unlocked,
    unlockedAt:  r.unlocked_at,
    progress:    r.progress,
  }))

  const unlockedCount = achievements.filter(a => a.unlocked).length

  return ok({
    achievements,
    unlockedCount,
    totalCount: achievements.length,
  })
})
