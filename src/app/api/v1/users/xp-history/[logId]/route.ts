// src/app/api/v1/users/xp-history/[logId]/route.ts
// Detail zu EINEM XP-Log-Eintrag (für das Popup im XP-Verlauf).
//   GET -> { source, xp, createdAt, title, description }
// Auflösung anhand source_type + source_ref_id:
//   • quest_daily/weekly -> assignment.template_id -> quest_templates(title, description)
//   • achievement        -> user_achievements.achievement_code -> achievements(title, description)
// title/description sind null, wenn nicht auflösbar (z.B. Achievements von VOR dem
// check_achievements-Fix). Die Komponente zeigt dann einen generischen Fallback.

import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { createClient }      from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export const GET = withAuth(async (ctx) => {
  const logId = ctx.params?.logId
  if (!logId) return err('Missing log id', 'MISSING_ID')

  const supabase = db()

  // Nur eigene Log-Zeile (Sicherheit über user_id).
  const { data: log } = await supabase
    .from('xp_logs')
    .select('id, source_type, source_ref_id, xp_granted, created_at')
    .eq('id', logId)
    .eq('user_id', ctx.userId)
    .maybeSingle()
  if (!log) return err('Entry not found', 'NOT_FOUND', 404)

  let title: string | null = null
  let description: string | null = null

  if (log.source_ref_id) {
    if (log.source_type === 'quest_daily' || log.source_type === 'quest_weekly') {
      const table = log.source_type === 'quest_daily' ? 'daily_quest_assignments' : 'weekly_quest_assignments'
      const { data: a } = await supabase
        .from(table).select('template_id').eq('id', log.source_ref_id).maybeSingle()
      if (a?.template_id) {
        const { data: tpl } = await supabase
          .from('quest_templates').select('title, description').eq('id', a.template_id).maybeSingle()
        if (tpl) { title = tpl.title; description = tpl.description }
      }
    } else if (log.source_type === 'achievement') {
      const { data: ua } = await supabase
        .from('user_achievements').select('achievement_code').eq('id', log.source_ref_id).maybeSingle()
      if (ua?.achievement_code) {
        const { data: ach } = await supabase
          .from('achievements').select('title, description').eq('code', ua.achievement_code).maybeSingle()
        if (ach) { title = ach.title; description = ach.description }
      }
    }
  }

  return ok({
    source:      log.source_type,
    xp:          log.xp_granted,
    createdAt:   log.created_at,
    title,
    description,
  })
})
