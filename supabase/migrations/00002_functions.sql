-- supabase/migrations/00002_functions.sql

-- ── xp_required_for_level ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION xp_required_for_level(p_level SMALLINT)
RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
  IF p_level < 1 OR p_level > 30 THEN
    RAISE EXCEPTION 'Level must be 1–30, got %', p_level;
  END IF;
  RETURN FLOOR(120.0 * POWER(1.34, p_level))::INTEGER;
END;
$$;

-- ── league_for_level ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION league_for_level(p_level SMALLINT)
RETURNS league_tier LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
  RETURN CASE
    WHEN p_level BETWEEN 1  AND 5  THEN 'bronze'::league_tier
    WHEN p_level BETWEEN 6  AND 10 THEN 'silver'::league_tier
    WHEN p_level BETWEEN 11 AND 15 THEN 'gold'::league_tier
    WHEN p_level BETWEEN 16 AND 20 THEN 'platinum'::league_tier
    WHEN p_level BETWEEN 21 AND 25 THEN 'diamond'::league_tier
    WHEN p_level BETWEEN 26 AND 30 THEN 'legendary'::league_tier
    ELSE 'bronze'::league_tier
  END;
END;
$$;

-- ── compute_energy_at ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_energy_at(
  p_current      SMALLINT,
  p_last_updated TIMESTAMPTZ,
  p_at           TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(energy SMALLINT, ticks_elapsed INTEGER, next_regen_at TIMESTAMPTZ, seconds_to_full INTEGER)
LANGUAGE plpgsql STABLE STRICT AS $$
DECLARE
  v_seconds INTEGER;
  v_ticks   INTEGER;
  v_new     SMALLINT;
  v_last_tick TIMESTAMPTZ;
BEGIN
  v_seconds := EXTRACT(EPOCH FROM (p_at - p_last_updated))::INTEGER;
  v_ticks   := v_seconds / 900;   -- 900s = 15 min
  v_new     := LEAST(100, p_current + v_ticks)::SMALLINT;
  v_last_tick := p_last_updated + (v_ticks * INTERVAL '15 minutes');
  RETURN QUERY SELECT
    v_new,
    v_ticks,
    CASE WHEN v_new >= 100 THEN NULL
         ELSE v_last_tick + INTERVAL '15 minutes'
    END,
    CASE WHEN v_new >= 100 THEN 0
         ELSE (100 - v_new) * 900
    END::INTEGER;
END;
$$;

-- ── consume_energy ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION consume_energy(
  p_user_id  UUID,
  p_amount   SMALLINT,
  p_reason   TEXT,
  p_ref_id   UUID    DEFAULT NULL,
  p_ip_hash  TEXT    DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, energy_after SMALLINT, failure_reason TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user     RECORD;
  v_energy   RECORD;
  v_before   SMALLINT;
  v_after    SMALLINT;
  v_tick_at  TIMESTAMPTZ;
  v_today    DATE := CURRENT_DATE;
BEGIN
  SELECT id, energy_current, energy_last_updated, energy_used_today, energy_date
  INTO v_user FROM users WHERE id = p_user_id FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::SMALLINT, 'User not found'::TEXT; RETURN;
  END IF;

  -- Compute current energy with regen
  SELECT * INTO v_energy FROM compute_energy_at(v_user.energy_current, v_user.energy_last_updated);
  v_before := v_energy.energy;

  -- Reset daily counter if stale
  IF v_user.energy_date < v_today THEN
    UPDATE users SET energy_used_today = 0, energy_date = v_today WHERE id = p_user_id;
    v_user.energy_used_today := 0;
  END IF;

  -- Daily energy cap (anti-bot: 320/day)
  IF v_user.energy_used_today + p_amount > 320 THEN
    RETURN QUERY SELECT FALSE, v_before, 'Daily energy cap reached (320)'::TEXT; RETURN;
  END IF;

  -- Insufficient energy check
  IF v_before < p_amount THEN
    RETURN QUERY SELECT FALSE, v_before,
      FORMAT('Need %s energy, have %s', p_amount, v_before)::TEXT; RETURN;
  END IF;

  v_after := v_before - p_amount;
  v_tick_at := v_user.energy_last_updated + (v_energy.ticks_elapsed * INTERVAL '15 minutes');

  -- Update user energy state
  UPDATE users SET
    energy_current    = v_after,
    energy_last_updated = v_tick_at,
    energy_used_today = v_user.energy_used_today + p_amount,
    updated_at        = NOW()
  WHERE id = p_user_id;

  -- Audit log
  INSERT INTO energy_logs(user_id, delta, reason, reason_ref_id, energy_before, energy_after, ip_hash)
  VALUES (p_user_id, -p_amount, p_reason, p_ref_id, v_before, v_after, p_ip_hash);

  RETURN QUERY SELECT TRUE, v_after, NULL::TEXT;
END;
$$;

-- ── grant_xp ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION grant_xp(
  p_user_id       UUID,
  p_xp_base       INTEGER,
  p_source_type   xp_source_type,
  p_source_ref_id UUID DEFAULT NULL
)
RETURNS TABLE(xp_granted INTEGER, leveled_up BOOLEAN, new_level SMALLINT, new_league league_tier, soft_capped BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user        RECORD;
  v_boost       NUMERIC(5,2) := 0;
  v_boost_capped BOOLEAN := FALSE;
  v_xp_boosted  INTEGER;
  v_xp_grant    INTEGER;
  v_soft_capped BOOLEAN := FALSE;
  v_xp_cur      INTEGER;
  v_xp_total    BIGINT;
  v_level       SMALLINT;
  v_old_level   SMALLINT;
  v_league      league_tier;
  v_leveled_up  BOOLEAN := FALSE;
  v_xp_needed   INTEGER;
  v_xp_log_id   UUID;
  v_today       DATE := CURRENT_DATE;
BEGIN
  SELECT * INTO v_user FROM users WHERE id = p_user_id FOR UPDATE NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found: %', p_user_id; END IF;

  -- Reset daily XP counter if stale
  IF v_user.xp_earned_today_date < v_today THEN
    UPDATE users SET xp_earned_today = 0, xp_earned_today_date = v_today WHERE id = p_user_id;
    v_user.xp_earned_today := 0;
  END IF;

  -- Hard block: at soft cap (5000/day)
  IF v_user.xp_earned_today >= 5000 THEN
    -- Log cap hit
    INSERT INTO antibot_events(user_id, event_type, severity, score_impact, details)
    VALUES (p_user_id,'xp_cap_hit','low',-2,jsonb_build_object('xp_today',v_user.xp_earned_today));
    UPDATE antibot_scores SET xp_cap_hits_today = xp_cap_hits_today + 1 WHERE user_id = p_user_id;
    RETURN QUERY SELECT 0,FALSE,v_user.level,v_user.league,TRUE; RETURN;
  END IF;

  -- Ecosystem boost (highest active tier)
  SELECT COALESCE(MAX(xp_boost_percent),0) INTO v_boost
  FROM ecosystem_support
  WHERE user_id = p_user_id AND is_active = TRUE
    AND boost_active_from <= NOW() AND boost_active_until >= NOW();

  -- Apply boost only up to 3000 XP/day threshold
  IF v_user.xp_earned_today < 3000 AND v_boost > 0 THEN
    v_xp_boosted := FLOOR(p_xp_base * (1 + v_boost / 100.0))::INTEGER;
    IF v_user.xp_earned_today + v_xp_boosted > 3000 THEN
      v_boost_capped := TRUE;
    END IF;
  ELSE
    v_xp_boosted := p_xp_base;
    IF v_boost > 0 THEN v_boost_capped := TRUE; END IF;
  END IF;

  -- Enforce soft daily cap
  v_xp_grant := LEAST(v_xp_boosted, 5000 - v_user.xp_earned_today);
  IF v_xp_grant < v_xp_boosted THEN v_soft_capped := TRUE; END IF;

  -- Level-up loop
  v_xp_cur   := v_user.xp_current_level + v_xp_grant;
  v_xp_total := v_user.xp_total + v_xp_grant;
  v_level    := v_user.level;
  v_old_level:= v_user.level;

  WHILE v_level < 30 LOOP
    v_xp_needed := xp_required_for_level(v_level);
    EXIT WHEN v_xp_cur < v_xp_needed;
    v_xp_cur   := v_xp_cur - v_xp_needed;
    v_level    := v_level + 1;
    v_leveled_up := TRUE;
  END LOOP;

  v_league := league_for_level(v_level);

  -- Update user
  UPDATE users SET
    xp_current_level = v_xp_cur,
    xp_total         = v_xp_total,
    level            = v_level,
    league           = v_league,
    season_xp        = season_xp + v_xp_grant,
    xp_earned_today  = v_user.xp_earned_today + v_xp_grant,
    last_active_at   = NOW(),
    updated_at       = NOW()
  WHERE id = p_user_id;

  -- XP audit log
  INSERT INTO xp_logs(
    user_id, season_id, source_type, source_ref_id,
    xp_base, xp_bonus, xp_granted,
    boost_percent, boost_capped, soft_capped, xp_before_cap,
    level_before, level_after, leveled_up
  ) VALUES (
    p_user_id, v_user.current_season_id, p_source_type, p_source_ref_id,
    p_xp_base, v_xp_grant - p_xp_base, v_xp_grant,
    v_boost, v_boost_capped, v_soft_capped,
    CASE WHEN v_soft_capped THEN v_xp_boosted ELSE NULL END,
    v_old_level, v_level, v_leveled_up
  ) RETURNING id INTO v_xp_log_id;

  -- Level history
  IF v_leveled_up THEN
    FOR i IN (v_old_level + 1)..v_level LOOP
      INSERT INTO level_history(user_id, from_level, to_level, xp_log_id, league_changed, new_league)
      VALUES (p_user_id, i-1, i, v_xp_log_id,
        league_for_level(i) != league_for_level(i-1), league_for_level(i))
      ON CONFLICT (user_id, to_level) DO NOTHING;
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_xp_grant, v_leveled_up, v_level, v_league, v_soft_capped;
END;
$$;

-- ── refresh_leaderboard_cache ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION refresh_leaderboard_cache()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows INTEGER;
BEGIN
  -- Get active season
  DECLARE v_season_id UUID;
  SELECT id INTO v_season_id FROM seasons WHERE status = 'active';
  IF v_season_id IS NULL THEN RETURN 0; END IF;

  -- Replace global leaderboard (top 1000)
  DELETE FROM leaderboard_cache
  WHERE cache_type = 'season_global' AND season_id = v_season_id;

  INSERT INTO leaderboard_cache(
    cache_type, season_id, rank, entity_id, entity_type,
    display_name, avatar_url, score, level, metadata, refreshed_at
  )
  SELECT
    'season_global', v_season_id,
    ROW_NUMBER() OVER (ORDER BY u.season_xp DESC, u.xp_total DESC)::INTEGER,
    u.id, 'user',
    u.telegram_first_name,
    u.telegram_photo_url,
    u.season_xp,
    u.level,
    jsonb_build_object(
      'league',    u.league,
      'username',  u.telegram_username,
      'streak',    u.streak_current
    ),
    NOW()
  FROM users u
  WHERE u.is_flagged = FALSE AND u.is_banned = FALSE
    AND u.current_season_id = v_season_id
  ORDER BY u.season_xp DESC, u.xp_total DESC
  LIMIT 1000;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

-- Wrapper for Edge Function call
CREATE OR REPLACE FUNCTION safe_refresh_leaderboards()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM refresh_leaderboard_cache();
  INSERT INTO system_events(event_type, payload) VALUES ('leaderboard_refreshed', '{}');
END;
$$;