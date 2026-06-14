// src/app/api/v1/quests/onboarding/route.ts
// "First Steps" — one-time onboarding quests (quest_type = 'special').
//
// - On first call, lazily assigns all active 'special' templates.
// - On every call, checks all still-'available' quests and
//   completes them automatically if the condition is already met
//   (e.g. wallet already connected) — including immediate XP grant.
//   The player doesn't need to "claim" 5 of the 6 quests.
// - For special_first_referral, additionally returns the unlock
//   requirements (XP toward 2000, wallet) while the quest is still
//   open — identical to the logic in /api/v1/referrals.

import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient } from '@/lib/supabase/admin'
import { autoCompleteSpecialQuest, type SpecialAssignmentRow } from '@/lib/quests/special'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withAuth(async (ctx) => {
  const db = getAdminClient()

  // 1. Load active onboarding templates
  const { data: templates, error: tmplErr } = await db
    .from('quest_templates')
    .select('id, internal_code, title, description, xp_reward, icon_key, action_spec, sort_order')
    .eq('quest_type', 'special')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (tmplErr) return err(`Failed to load templates: ${tmplErr.message}`, 'DB_ERROR', 500)
  if (!templates?.length) return ok({ items: [], completedCount: 0, totalCount: 0 })

  // 2. Active season (for assignment)
  const { data: season } = await db
    .from('seasons').select('id').eq('status', 'active').maybeSingle()

  // 3. Load existing assignments
  const { data: existing, error: existErr } = await db
    .from('special_quest_assignments')
    .select('id, template_id, status, completed_at, xp_granted')
    .eq('user_id', ctx.userId)

  if (existErr) return err(`Failed to load assignments: ${existErr.message}`, 'DB_ERROR', 500)

  const byTemplate = new Map<string, SpecialAssignmentRow>(
    (existing ?? []).map(a => [a.template_id, a as SpecialAssignmentRow])
  )

  // 4. Lazily create missing assignments (new players / new templates)
  const missing = templates.filter(t => !byTemplate.has(t.id))
  if (missing.length > 0) {
    const rows = missing.map(t => ({
      user_id:     ctx.userId,
      template_id: t.id,
      season_id:   season?.id ?? null,
      status:      'available' as const,
    }))

    const { data: inserted, error: insErr } = await db
      .from('special_quest_assignments')
      .upsert(rows, { onConflict: 'user_id,template_id' })
      .select('id, template_id, status, completed_at, xp_granted')

    if (insErr) return err(`Failed to assign quests: ${insErr.message}`, 'DB_ERROR', 500)
    for (const row of inserted ?? []) byTemplate.set(row.template_id, row as SpecialAssignmentRow)
  }

  // 5. Auto-check + auto-complete for all still-open quests
  for (const t of templates) {
    const a = byTemplate.get(t.id)
    if (!a || a.status !== 'available') continue

    const result = await autoCompleteSpecialQuest(db, ctx.userId, ctx.telegramId, a, {
      internal_code: t.internal_code,
      xp_reward:     t.xp_reward,
    })

    if (result.completed) {
      a.status       = 'completed'
      a.completed_at = new Date().toISOString()
      a.xp_granted   = result.xpGranted
      ;(a as any).justCompleted = true
      ;(a as any).leveledUp     = result.leveledUp
      ;(a as any).newLevel      = result.newLevel
      ;(a as any).newLeague     = result.newLeague
    }
  }

  // 6. Referral unlock status for the UI (only while the quest is open)
  const referralTemplate = templates.find(t => t.internal_code === 'special_first_referral')
  let referral: { xp: { current: number; required: number; met: boolean }; wallet: { met: boolean } } | undefined

  if (referralTemplate) {
    const a = byTemplate.get(referralTemplate.id)
    if (a && a.status !== 'completed') {
      const [{ data: user }, { data: wallet }] = await Promise.all([
        db.from('users').select('xp_total').eq('id', ctx.userId).single(),
        db.from('wallets').select('address').eq('user_id', ctx.userId).eq('status', 'connected').maybeSingle(),
      ])

      const xpTotal = (user as any)?.xp_total ?? 0
      referral = {
        xp:     { current: xpTotal, required: 2000, met: xpTotal >= 2000 },
        wallet: { met: !!wallet?.address },
      }
    }
  }

  // 7. Build response
  const items = templates.map(t => {
    const a = byTemplate.get(t.id)! as any
    return {
      id:          a.id,
      status:      a.status,
      xpGranted:   a.xp_granted,
      completedAt: a.completed_at,
      // Only set when auto-completed during THIS request — lets the
      // frontend show a "+X XP" / "Level Up!" toast for the quest
      // that just got completed.
      justCompleted: a.justCompleted ?? false,
      leveledUp:     a.leveledUp ?? false,
      newLevel:      a.newLevel,
      newLeague:     a.newLeague,
      template: {
        internalCode: t.internal_code,
        title:        t.title,
        description:  t.description,
        xpReward:     t.xp_reward,
        iconKey:      t.icon_key,
        actionSpec:   t.action_spec,
        sortOrder:    t.sort_order,
      },
      ...(t.internal_code === 'special_first_referral' && referral ? { referral } : {}),
    }
  })

  const completedCount = items.filter(i => i.status === 'completed').length

  return ok({ items, completedCount, totalCount: items.length })
})
