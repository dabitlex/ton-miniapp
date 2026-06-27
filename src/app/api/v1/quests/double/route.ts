// src/app/api/v1/quests/double/route.ts
// Vom Client aufgerufen, NACHDEM die Doppel-Ad zu Ende lief.
//   POST { questId, questType: 'daily' | 'weekly' }
//   -> { doubled: boolean, bonus: number, reason: string }
// Die eigentliche Prüfung + Vergabe passiert server-autoritativ in der DB-Funktion
// double_quest_reward(): Eigentum/Status der Quest, einmal pro Quest, und Verbrauch
// EINER frischen, server-bestätigten Ad-Gutschrift (aus dem S2S-Callback).
// Ohne echte (vom Callback bestätigte) Ad gibt es kein Doppeln -> reason 'no_ad_credit'.

import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient }    from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const POST = withAuth(async (ctx) => {
  let body: { questId?: string; questType?: string }
  try { body = await ctx.req.json() }
  catch { return err('Invalid JSON body', 'BAD_BODY') }

  const { questId, questType } = body
  if (!questId || !questType) return err('questId and questType are required', 'MISSING_FIELDS')
  if (!uuidRe.test(questId))   return err('Invalid questId', 'INVALID_ID')
  if (questType !== 'daily' && questType !== 'weekly') {
    return err('questType must be daily or weekly', 'INVALID_QUEST_TYPE')
  }

  const supabase = getAdminClient()

  const { data, error } = await supabase.rpc('double_quest_reward', {
    p_user_id:       ctx.userId,
    p_quest_type:    questType,
    p_assignment_id: questId,
  })

  if (error) {
    console.error('[QuestDouble] rpc error:', error.message)
    return err('Could not double reward', 'DB_ERROR', 500)
  }

  const row = Array.isArray(data) ? data[0] : data
  return ok({
    doubled: !!row?.out_ok,
    bonus:   row?.out_bonus ?? 0,
    reason:  row?.out_reason ?? 'unknown',
  })
})
