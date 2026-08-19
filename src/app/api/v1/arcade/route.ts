// src/app/api/v1/arcade/route.ts 
//
// GET   — Zustand: aktiv?, verbleibende Runden, Bestwerte
// POST  — Lauf eröffnen  { action: 'start', withAd?: boolean }
//         Lauf abschließen { action: 'finish', runId, score, bestCombo }
//
// Die Bewertung passiert vollständig in der Datenbank
// (start_arcade_run / finish_arcade_run). Diese Route reicht nur durch —
// so gibt es genau EINE Stelle, an der Limits und Plausibilität geprüft
// werden, statt zwei, die auseinanderlaufen können.
import { withAuth, ok, err } from '@/app/api/v1/_lib/handler'
import { getAdminClient }    from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const GET = withAuth(async (ctx) => {
  const db = getAdminClient() as any
  const { data, error } = await db.rpc('arcade_status', { p_user_id: ctx.userId })

  if (error) return ok({ enabled: false })

  const s = Array.isArray(data) ? data[0] : data
  return ok({
    enabled:     !!s?.enabled,
    runsLeft:    Number(s?.runs_left ?? 0),
    adRunsLeft:  Number(s?.ad_runs_left ?? 0),
    bestScore:   Number(s?.best_score ?? 0),
    bestToday:   Number(s?.best_today ?? 0),
    xpToday:     Number(s?.xp_today ?? 0),
  })
})

export const POST = withAuth(async (ctx) => {
  let body: { action?: string; withAd?: boolean; runId?: string; score?: number; bestCombo?: number }
  try { body = await ctx.req.json() }
  catch { return err('Invalid body', 'BAD_REQUEST') }

  const db = getAdminClient() as any

  // ── Lauf eröffnen ──
  if (body.action === 'start') {
    const { data, error } = await db.rpc('start_arcade_run', {
      p_user_id: ctx.userId,
      p_with_ad: !!body.withAd,
    })
    if (error) return err('Start fehlgeschlagen', 'ARCADE_START_FAILED', 500)

    const r = Array.isArray(data) ? data[0] : data
    if (!r?.run_id) {
      return err(r?.reason ?? 'Keine Runden mehr', 'NO_RUNS_LEFT', 429)
    }
    return ok({
      runId:      r.run_id,
      runsLeft:   Number(r.runs_left ?? 0),
      adRunsLeft: Number(r.ad_runs_left ?? 0),
    })
  }

  // ── Lauf abschließen ──
  if (body.action === 'finish') {
    if (!body.runId || !uuidRe.test(body.runId)) {
      return err('runId required', 'MISSING_FIELDS')
    }
    const score = Number(body.score)
    if (!Number.isFinite(score) || score < 0) {
      return err('score required', 'MISSING_FIELDS')
    }

    const { data, error } = await db.rpc('finish_arcade_run', {
      p_user_id:    ctx.userId,
      p_run_id:     body.runId,
      p_score:      Math.floor(score),
      p_best_combo: Math.max(0, Math.min(Number(body.bestCombo) || 0, 999)),
    })
    if (error) return err('Abschluss fehlgeschlagen', 'ARCADE_FINISH_FAILED', 500)

    const r = Array.isArray(data) ? data[0] : data

    // Abgelehnte Läufe geben bewusst 200 zurück, nicht 4xx: der Nutzer
    // soll sein Ergebnis sehen, nur eben ohne XP. Ein Fehler-Toast wäre
    // hier verwirrend, weil der Lauf ja stattgefunden hat.
    return ok({
      accepted: !!r?.accepted,
      xp:       Number(r?.xp ?? 0),
      reason:   r?.reason ?? null,
    })
  }

  return err('Unknown action', 'BAD_REQUEST')
})
