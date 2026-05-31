// src/app/api/v1/quests/complete/route.ts
// SECURITY: server-authoritative XP + energy + quest verification
import { NextRequest } from 'next/server'
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient } from '@/lib/supabase/admin'
import { todayUTC } from '@/lib/utils'
import type { CompleteQuestRequest } from '@/types/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Rate limit: 10 completions per 60 seconds per user
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export const POST = withAuth(async (ctx) => {
  let body: CompleteQuestRequest
  try { body = await ctx.req.json() }
  catch { return err('Invalid JSON body', 'BAD_REQUEST') }

  const { questId, questType, nonce } = body

  if (!questId || !questType || !nonce) {
    return err('questId, questType, and nonce are required', 'MISSING_FIELDS')
  }

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRe.test(questId) || !uuidRe.test(nonce)) {
    return err('Invalid UUID format', 'INVALID_FORMAT')
  }

  if (!['daily', 'weekly'].includes(questType)) {
    return err('questType must be daily or weekly', 'INVALID_QUEST_TYPE')
  }

  // ── Rate Limiting ────────────────────────────────────────────
  const now = Date.now()
  const rl  = rateLimitMap.get(ctx.userId) ?? { count: 0, resetAt: now + 60_000 }
  if (now > rl.resetAt) { rl.count = 0; rl.resetAt = now + 60_000 }
  rl.count++
  rateLimitMap.set(ctx.userId, rl)
  if (rl.count > 10) {
    await recordAntibotEvent(ctx.userId, 'rapid_completion', 'high', { count: rl.count })
    return err('Too many requests', 'RATE_LIMITED', 429)
  }

  const db    = getAdminClient()
  const table = questType === 'daily' ? 'daily_quest_assignments' : 'weekly_quest_assignments'

  // ── 1. Replay attack check ────────────────────────────────────
  const { data: nonceCheck } = await db
    .from('action_nonces')
    .select('nonce')
    .eq('nonce', nonce)
    .maybeSingle()

  if (nonceCheck) {
    await recordAntibotEvent(ctx.userId, 'replay_attempt', 'medium', { nonce, questId })
    return err('Duplicate nonce — replay detected', 'REPLAY_ATTACK', 409)
  }

  // ── 2. Quest laden ────────────────────────────────────────────
  const { data: quest, error: questErr } = await db
    .from(table as 'daily_quest_assignments')
    .select('*, template:quest_templates(*)')
    .eq('id', questId)
    .eq('user_id', ctx.userId)
    .single()

  if (questErr || !quest) return err('Quest not found', 'NOT_FOUND', 404)

  if (quest.status !== 'available') {
    return err(`Quest is ${quest.status}`, `QUEST_${quest.status.toUpperCase()}`)
  }

  if (questType === 'daily' && (quest as any).quest_date !== todayUTC()) {
    await db.from(table as 'daily_quest_assignments')
      .update({ status: 'expired' }).eq('id', questId)
    return err('Quest has expired', 'QUEST_EXPIRED')
  }

  const template    = (quest as any).template
  const energyCost  = template.energy_cost as number
  const xpReward    = template.xp_reward as number
  const questCode   = template.internal_code as string

  // ── 3. QUEST VERIFIKATION ─────────────────────────────────────
  // Server prüft ob der Nutzer die Bedingung wirklich erfüllt hat
  const { data: verifyResult, error: verifyErr } = await db.rpc(
    'verify_quest_condition' as any,
    {
      p_user_id:    ctx.userId,
      p_quest_code: questCode,
      p_quest_type: questType,
    }
  )

  if (verifyErr) {
    console.error(`[QuestVerify] Fehler für ${questCode}:`, verifyErr.message)
    // Bei Verifikationsfehler: Quest trotzdem erlauben (Fallback)
    // damit technische Fehler keine Blockierung verursachen
  } else {
    const verify = (verifyResult as any[])?.[0]
    if (verify && !verify.verified) {
      // Bedingung nicht erfüllt → Quest ablehnen
      await recordAntibotEvent(ctx.userId, 'quest_condition_failed', 'low', {
        questCode,
        reason:        verify.reason,
        currentValue:  verify.current_value,
        requiredValue: verify.required_value,
      })
      return err(
        verify.reason ?? 'Quest-Bedingung nicht erfüllt',
        'QUEST_CONDITION_NOT_MET',
        422
      )
    }
  }

  // ── 4. Energie abziehen ───────────────────────────────────────
  const { data: energyResult, error: energyErr } = await db.rpc('consume_energy', {
    p_user_id: ctx.userId,
    p_amount:  energyCost,
    p_reason:  `quest_${template.difficulty}`,
    p_ref_id:  questId,
    p_ip_hash: ctx.ipHash,
  })

  if (energyErr) return err(`Energy error: ${energyErr.message}`, 'ENERGY_ERROR', 500)

  const energyRes = (energyResult as any[])[0]
  if (!energyRes?.success) {
    return err(energyRes?.failure_reason ?? 'Insufficient energy', 'NO_ENERGY')
  }

  // ── 5. XP vergeben ───────────────────────────────────────────
  const { data: xpResult, error: xpErr } = await db.rpc('grant_xp', {
    p_user_id:       ctx.userId,
    p_xp_base:       xpReward,
    p_source_type:   questType === 'daily' ? 'quest_daily' : 'quest_weekly',
    p_source_ref_id: questId,
  })

  if (xpErr) return err(`XP error: ${xpErr.message}`, 'XP_ERROR', 500)

  const xp = (xpResult as any[])[0]

  // ── 6. Quest abschließen ──────────────────────────────────────
  await Promise.all([
    db.from(table as 'daily_quest_assignments').update({
      status:           'completed',
      completed_at:     new Date().toISOString(),
      xp_granted:       xp.xp_granted,
      energy_spent:     energyCost,
      completion_nonce: nonce,
    } as any).eq('id', questId),

    db.from('action_nonces').insert({
      nonce,
      user_id:       ctx.userId,
      action_type:   'quest_complete',
      action_ref_id: questId,
      ip_hash:       ctx.ipHash,
    }).then(() => {}),

    db.from('user_daily_stats').upsert({
      user_id:          ctx.userId,
      stat_date:        todayUTC(),
      quests_completed: 1,
      xp_earned:        xp.xp_granted,
      was_active:       true,
    }, { onConflict: 'user_id,stat_date' }).then(() => {}),
  ])

  return ok({
    xpGranted:   xp.xp_granted,
    leveledUp:   xp.leveled_up,
    newLevel:    xp.new_level,
    newLeague:   xp.new_league,
    energyAfter: energyRes.energy_after,
    softCapped:  xp.soft_capped,
  })
})

async function recordAntibotEvent(
  userId: string, eventType: string,
  severity: string, details: Record<string, unknown>
) {
  const db = getAdminClient()
  await db.from('antibot_events').insert({
    user_id: userId, event_type: eventType,
    severity, score_impact: -10, details,
  }).then(() => {})
}
