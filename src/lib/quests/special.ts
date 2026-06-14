// src/lib/quests/special.ts
// Shared logic for "First Steps" onboarding quests
// (quest_type = 'special', table special_quest_assignments).
//
// Used by:
//  - GET  /api/v1/quests/onboarding  (auto-check on every load)
//  - POST /api/v1/quests/complete    (explicit retry, mainly for
//                                      special_join_channel after
//                                      joining the channel)
//
// 5 of the 6 quests are PASSIVE: the condition is checked via
// verify_quest_condition (wallet, first quest, clan, level 5,
// first referral). Once met, the quest is completed automatically
// and XP is granted — the player doesn't need to "claim" anything.
//
// special_join_channel is the ONE exception: verification goes
// through the Telegram Bot API (fail-closed on errors, same
// pattern as K2/M2).

import type { SupabaseClient } from '@supabase/supabase-js'
import { checkChannelMembership } from '@/lib/telegram/channel'

export interface SpecialAssignmentRow {
  id:           string
  template_id:  string
  status:       string
  completed_at: string | null
  xp_granted:   number | null
}

export interface SpecialTemplateRow {
  internal_code: string
  xp_reward:     number
}

export type AutoCompleteResult =
  | {
      completed:  true
      xpGranted:  number
      leveledUp:  boolean
      newLevel:   number
      newLeague:  string
      softCapped: boolean
    }
  | { completed: false; reason?: string; code?: string }

/**
 * Checks whether the condition of an 'available' onboarding quest
 * is met, and if so completes it ATOMICALLY (including grant_xp).
 *
 * Returns { completed: false } if the condition is not (yet) met,
 * OR the quest was no longer 'available' (race condition / already
 * completed) — never an error, just the normal case.
 */
export async function autoCompleteSpecialQuest(
  db:         SupabaseClient,
  userId:     string,
  telegramId: number,
  assignment: SpecialAssignmentRow,
  template:   SpecialTemplateRow,
): Promise<AutoCompleteResult> {
  if (assignment.status !== 'available') return { completed: false }

  // ── 1. Check condition ──────────────────────────────────────
  if (template.internal_code === 'special_join_channel') {
    const isMember = await checkChannelMembership(telegramId)

    if (isMember === null) {
      // Fail-closed: Telegram API unreachable -> do NOT complete
      return { completed: false, reason: 'Channel check temporarily unavailable', code: 'VERIFY_UNAVAILABLE' }
    }
    if (isMember === false) {
      return { completed: false, reason: 'Not joined the channel yet', code: 'CHANNEL_NOT_JOINED' }
    }
    // isMember === true -> continue to step 2

  } else {
    const { data: verifyResult, error: verifyErr } = await db.rpc('verify_quest_condition', {
      p_user_id:    userId,
      p_quest_code: template.internal_code,
      p_quest_type: 'special',
    })

    if (verifyErr) {
      // Fail-closed, same pattern as K2: do NOT complete on technical error
      return { completed: false, reason: 'Verification temporarily unavailable', code: 'VERIFY_UNAVAILABLE' }
    }

    const verified = !!(verifyResult as any[])?.[0]?.verified
    if (!verified) {
      return {
        completed: false,
        reason: (verifyResult as any[])?.[0]?.reason ?? 'Condition not yet met',
        code:   'QUEST_CONDITION_NOT_MET',
      }
    }
  }

  // ── 2. Complete atomically (only if still 'available') ──────
  const { data: claimed, error: claimErr } = await db
    .from('special_quest_assignments')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', assignment.id)
    .eq('status', 'available')
    .select('id')

  if (claimErr || !claimed || claimed.length === 0) {
    // Race condition: someone else (or a parallel request) already
    // completed this quest. Not an error.
    return { completed: false }
  }

  // ── 3. Grant XP ──────────────────────────────────────────────
  const { data: xpResult, error: xpErr } = await db.rpc('grant_xp', {
    p_user_id:       userId,
    p_xp_base:       template.xp_reward,
    p_source_type:   'quest_special',
    p_source_ref_id: assignment.id,
  })

  if (xpErr) {
    // Roll back the completion so it can succeed on the next attempt —
    // prevents a "completed but no XP" state.
    await db.from('special_quest_assignments')
      .update({ status: 'available', completed_at: null })
      .eq('id', assignment.id)
    return { completed: false, reason: 'XP grant failed', code: 'XP_ERROR' }
  }

  const xp = (xpResult as any[])[0]
  if (xp.xp_granted > 0) {
    await db.from('special_quest_assignments')
      .update({ xp_granted: xp.xp_granted })
      .eq('id', assignment.id)
  }

  return {
    completed:  true,
    xpGranted:  xp.xp_granted,
    leveledUp:  xp.leveled_up,
    newLevel:   xp.new_level,
    newLeague:  xp.new_league,
    softCapped: xp.soft_capped,
  }
}
