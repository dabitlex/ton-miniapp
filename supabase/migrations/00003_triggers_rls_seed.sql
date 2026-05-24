-- supabase/migrations/00003_triggers.sql

-- ── Auto-update updated_at ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','user_settings','user_daily_stats','seasons',
    'daily_quest_assignments','weekly_quest_assignments','quest_templates',
    'ecosystem_support','ton_transactions','wallets',
    'antibot_scores','flag_reviews'
  ] LOOP
    EXECUTE FORMAT(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();',
      t, t
    );
  END LOOP;
END;
$$;

-- ── Auto-create antibot_scores + user_settings on user insert ──────────
CREATE OR REPLACE FUNCTION fn_init_user_deps()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO antibot_scores(user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO user_settings(user_id) VALUES (NEW.id)  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_init_user_deps
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION fn_init_user_deps();

-- ── Auto-flag when antibot score drops below threshold ────────────────
CREATE OR REPLACE FUNCTION fn_autoflag_on_low_score()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.score < 40 AND NOT NEW.auto_flagged THEN
    NEW.auto_flagged    := TRUE;
    NEW.review_required := TRUE;
    UPDATE users SET is_flagged = TRUE WHERE id = NEW.user_id;
    INSERT INTO flag_reviews(user_id, triggered_by, auto_score)
    VALUES (NEW.user_id, 'auto_score_threshold', NEW.score)
    ON CONFLICT (user_id) DO UPDATE SET auto_score = EXCLUDED.auto_score, updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_autoflag_score
  BEFORE UPDATE OF score ON antibot_scores
  FOR EACH ROW WHEN (NEW.score < OLD.score)
  EXECUTE FUNCTION fn_autoflag_on_low_score();

-- ── Enforce single active season ──────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_single_active_season()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'active' AND EXISTS (
    SELECT 1 FROM seasons WHERE status = 'active' AND id != NEW.id
  ) THEN
    RAISE EXCEPTION 'Another season is already active';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_active_season
  BEFORE INSERT OR UPDATE OF status ON seasons
  FOR EACH ROW EXECUTE FUNCTION fn_single_active_season();

-- ── Check referral eligibility when user updates ──────────────────────
CREATE OR REPLACE FUNCTION fn_check_referral_eligibility()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_ref RECORD; v_days INT;
BEGIN
  IF NEW.referred_by_user_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.level < 5 OR NEW.xp_total < 2000 THEN RETURN NEW; END IF;

  SELECT COUNT(DISTINCT stat_date) INTO v_days
  FROM user_daily_stats WHERE user_id = NEW.id AND was_active = TRUE;

  IF v_days >= 3 AND EXISTS(SELECT 1 FROM wallets WHERE user_id = NEW.id AND status = 'connected') THEN
    NEW.referral_eligible := TRUE;
    UPDATE referrals SET
      is_valid = TRUE, validated_at = NOW(),
      referee_wallet_ok = TRUE, referee_level_ok = TRUE,
      referee_xp_ok = TRUE, referee_active_days_ok = TRUE
    WHERE referee_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_referral_check
  BEFORE UPDATE OF level, xp_total ON users
  FOR EACH ROW EXECUTE FUNCTION fn_check_referral_eligibility();

-- ========================================================
-- supabase/migrations/00003b_rls.sql  (kept in same file)
-- ========================================================

-- Enable RLS on all tables
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','user_settings','user_daily_stats','seasons',
    'daily_quest_assignments','weekly_quest_assignments','quest_templates',
    'action_nonces','xp_logs','energy_logs','level_history',
    'wallets','ton_transactions','ecosystem_support','referrals',
    'leaderboard_cache','antibot_scores','antibot_events',
    'flag_reviews','system_events','request_logs'
  ] LOOP
    EXECUTE FORMAT('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END;
$$;

-- ── Users ─────────────────────────────────────────────────────────────
CREATE POLICY "users_read_own" ON users
  FOR SELECT USING (auth.uid() = id);

-- Public fields for leaderboard (limited columns enforced in API)
CREATE POLICY "users_read_public" ON users
  FOR SELECT USING (
    is_banned = FALSE AND
    COALESCE((SELECT leaderboard_visible FROM user_settings WHERE user_id = users.id), TRUE)
  );

-- ── Settings ──────────────────────────────────────────────────────────
CREATE POLICY "settings_read_own" ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "settings_update_own" ON user_settings FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Daily stats ───────────────────────────────────────────────────────
CREATE POLICY "daily_stats_read_own" ON user_daily_stats FOR SELECT USING (auth.uid() = user_id);

-- ── Seasons ───────────────────────────────────────────────────────────
CREATE POLICY "seasons_read_all" ON seasons FOR SELECT USING (auth.role() = 'authenticated');

-- ── Audit logs ────────────────────────────────────────────────────────
CREATE POLICY "xp_logs_read_own"     ON xp_logs      FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "energy_logs_read_own" ON energy_logs  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "level_history_own"    ON level_history FOR SELECT USING (auth.uid() = user_id);

-- ── Quests ────────────────────────────────────────────────────────────
CREATE POLICY "quest_templates_read" ON quest_templates
  FOR SELECT USING (is_active = TRUE AND auth.role() = 'authenticated');
CREATE POLICY "daily_quests_read_own" ON daily_quest_assignments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "weekly_quests_read_own" ON weekly_quest_assignments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "nonces_read_own" ON action_nonces
  FOR SELECT USING (auth.uid() = user_id);

-- ── Wallet & TON ──────────────────────────────────────────────────────
CREATE POLICY "wallets_read_own" ON wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ton_tx_read_own"  ON ton_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM wallets w WHERE w.user_id = auth.uid()
    AND (w.address = ton_transactions.sender_address OR w.address = ton_transactions.recipient_address))
);
CREATE POLICY "ecosystem_read_own" ON ecosystem_support FOR SELECT USING (auth.uid() = user_id);

-- ── Referrals ────────────────────────────────────────────────────────
CREATE POLICY "referrals_read_own" ON referrals
  FOR SELECT USING (referrer_id = auth.uid() OR referee_id = auth.uid());

-- ── Leaderboard ───────────────────────────────────────────────────────
CREATE POLICY "leaderboard_read_all" ON leaderboard_cache
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── Anti-bot (own score visible for transparency) ─────────────────────
CREATE POLICY "antibot_score_read_own" ON antibot_scores FOR SELECT USING (auth.uid() = user_id);
-- flag_reviews: no policy = denied to authenticated (admin only via service_role)

-- ═══════════════════════════════════════════════════════════════════════
-- supabase/migrations/00003c_seed.sql  (kept in same file for clarity)
-- ═══════════════════════════════════════════════════════════════════════

-- ── Seed active season ────────────────────────────────────────────────
INSERT INTO seasons (
  season_number, name, tagline, status,
  starts_at, ends_at, off_season_ends_at,
  token_pool_total, token_pool_remaining, theme
) VALUES (
  1,
  'Season 1: Genesis',
  'The journey begins.',
  'active',
  NOW(),
  NOW() + INTERVAL '42 days',
  NOW() + INTERVAL '45 days',
  350000000,   -- 35% of 1B supply
  350000000,
  'genesis'
) ON CONFLICT (season_number) DO NOTHING;

-- ── Seed daily quest templates ────────────────────────────────────────
INSERT INTO quest_templates (internal_code, title, description, difficulty, quest_type,
  energy_cost, xp_reward, icon_key, sort_order) VALUES

-- Easy daily (energy_cost = 5, xp_reward = 80)
('daily_easy_login',   'Daily Login',        'Open the app and claim your daily login bonus.',    'easy', 'daily', 5, 80, '🌅', 10),
('daily_easy_tap',     'Tap 10 Times',       'Tap the action button 10 times to earn your XP.',  'easy', 'daily', 5, 80, '👆', 11),
('daily_easy_share',   'Share Progress',     'Share your level progress with the community.',      'easy', 'daily', 5, 80, '📢', 12),

-- Medium daily (energy_cost = 10, xp_reward = 180)
('daily_med_streak',   'Keep Your Streak',   'Maintain your daily streak for bonus rewards.',      'medium', 'daily', 10, 180, '🔥', 20),
('daily_med_explore',  'Explore Features',   'Visit 3 different sections of the app today.',       'medium', 'daily', 10, 180, '🗺️', 21),

-- Hard daily (energy_cost = 20, xp_reward = 500)
('daily_hard_champion','Daily Champion',     'Complete all daily quests to prove your dedication.','hard',  'daily', 20, 500, '🏆', 30)

ON CONFLICT (internal_code) DO NOTHING;

-- ── Seed weekly quest templates ───────────────────────────────────────
INSERT INTO quest_templates (internal_code, title, description, difficulty, quest_type,
  energy_cost, xp_reward, icon_key, sort_order) VALUES

('weekly_easy_login',  'Week Warrior',       'Log in every day this week.',                       'easy',   'weekly', 5,  80,  '📅', 10),
('weekly_med_xp',      'XP Grind',           'Earn 1000 XP in a single week.',                   'medium', 'weekly', 10, 180, '⭐', 20),
('weekly_med_quests',  'Quest Master',       'Complete 15 quests this week.',                     'medium', 'weekly', 10, 180, '📋', 21),
('weekly_hard_top100', 'Top 100 Push',       'Reach the top 100 on the season leaderboard.',      'hard',   'weekly', 20, 500, '🥇', 30),
('weekly_hard_streak', 'Perfect Week',       'Claim your streak every single day this week.',     'hard',   'weekly', 20, 500, '🔥', 31)

ON CONFLICT (internal_code) DO NOTHING;