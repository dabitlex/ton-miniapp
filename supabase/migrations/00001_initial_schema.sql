-- ============================================================
-- Migration 00001 - FINAL (alle Fehler behoben)
-- Fixes:
--   1. Kein GENERATED ALWAYS AS (nicht immutable)
--   2. Kein NOW() in Index-Prädikaten (nicht immutable)
--   3. amount_ton via Trigger statt generierte Spalte
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enums ──────────────────────────────────────────────────

CREATE TYPE quest_difficulty AS ENUM ('easy','medium','hard');
CREATE TYPE quest_type AS ENUM ('daily','weekly','special','clan_mission','pvp');
CREATE TYPE quest_status AS ENUM ('available','active','completed','expired','failed','locked');
CREATE TYPE league_tier AS ENUM ('bronze','silver','gold','platinum','diamond','legendary');
CREATE TYPE clan_role AS ENUM ('member','officer','leader');
CREATE TYPE war_status AS ENUM ('scheduled','active','completed','cancelled','draw');
CREATE TYPE invite_status AS ENUM ('pending','accepted','declined','expired','revoked');
CREATE TYPE season_status AS ENUM ('upcoming','active','off_season','ended');
CREATE TYPE reward_status AS ENUM ('pending','eligible','claimed','expired','forfeited');
CREATE TYPE wallet_status AS ENUM ('connected','disconnected','suspended');
CREATE TYPE tx_status AS ENUM ('pending','confirming','confirmed','failed','expired');
CREATE TYPE ecosystem_tier AS ENUM ('tier_1','tier_5','tier_20','tier_50','tier_100');
CREATE TYPE flag_severity AS ENUM ('low','medium','high','critical');
CREATE TYPE flag_status AS ENUM ('open','reviewing','cleared','confirmed','appealed');
CREATE TYPE antibot_event_type AS ENUM (
  'xp_cap_hit','energy_cap_hit','rapid_completion','replay_attempt',
  'suspicious_timing','ip_velocity','wallet_mismatch','referral_fraud','pattern_anomaly'
);
CREATE TYPE xp_source_type AS ENUM (
  'quest_daily','quest_weekly','quest_special','clan_mission','clan_war_win',
  'streak_bonus','referral_bonus','pvp_win','season_bonus','admin_grant','correction'
);

-- ── Seasons ────────────────────────────────────────────────

CREATE TABLE seasons (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_number        SMALLINT NOT NULL UNIQUE CHECK (season_number > 0),
  name                 TEXT NOT NULL,
  tagline              TEXT,
  status               season_status NOT NULL DEFAULT 'upcoming',
  starts_at            TIMESTAMPTZ NOT NULL,
  ends_at              TIMESTAMPTZ NOT NULL,
  off_season_ends_at   TIMESTAMPTZ NOT NULL,
  token_pool_total     BIGINT NOT NULL DEFAULT 0,
  token_pool_remaining BIGINT NOT NULL DEFAULT 0,
  theme                TEXT,
  metadata             JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT seasons_end_after_start CHECK (ends_at > starts_at),
  CONSTRAINT seasons_off_after_end   CHECK (off_season_ends_at > ends_at),
  CONSTRAINT seasons_pool_valid      CHECK (
    token_pool_remaining >= 0 AND token_pool_remaining <= token_pool_total
  )
);

CREATE UNIQUE INDEX idx_seasons_active ON seasons(status)
  WHERE status = 'active';

-- ── Users ──────────────────────────────────────────────────

CREATE TABLE users (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id             BIGINT NOT NULL UNIQUE,
  telegram_username       TEXT,
  telegram_first_name     TEXT NOT NULL,
  telegram_last_name      TEXT,
  telegram_photo_url      TEXT,
  telegram_language_code  VARCHAR(10) DEFAULT 'en',
  telegram_is_premium     BOOLEAN NOT NULL DEFAULT FALSE,
  level                   SMALLINT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 30),
  xp_total                BIGINT NOT NULL DEFAULT 0 CHECK (xp_total >= 0),
  xp_current_level        INTEGER NOT NULL DEFAULT 0 CHECK (xp_current_level >= 0),
  league                  league_tier NOT NULL DEFAULT 'bronze',
  energy_current          SMALLINT NOT NULL DEFAULT 100 CHECK (energy_current BETWEEN 0 AND 100),
  energy_last_updated     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  energy_used_today       SMALLINT NOT NULL DEFAULT 0 CHECK (energy_used_today >= 0),
  energy_date             DATE NOT NULL DEFAULT CURRENT_DATE,
  streak_current          SMALLINT NOT NULL DEFAULT 0 CHECK (streak_current >= 0),
  streak_longest          SMALLINT NOT NULL DEFAULT 0 CHECK (streak_longest >= 0),
  streak_last_active_date DATE,
  streak_miss_used_at     DATE,
  streak_miss_eligible_at DATE,
  xp_earned_today         INTEGER NOT NULL DEFAULT 0 CHECK (xp_earned_today >= 0),
  xp_earned_today_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  is_flagged              BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned               BOOLEAN NOT NULL DEFAULT FALSE,
  current_season_id       UUID REFERENCES seasons(id) ON DELETE SET NULL,
  season_xp               INTEGER NOT NULL DEFAULT 0 CHECK (season_xp >= 0),
  referral_code           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  referred_by_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  referral_eligible       BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  last_active_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_telegram_id   ON users(telegram_id);
CREATE INDEX idx_users_season_xp     ON users(current_season_id, season_xp DESC)
  WHERE is_flagged = FALSE AND is_banned = FALSE;
CREATE INDEX idx_users_level_league  ON users(level, league)
  WHERE is_banned = FALSE;
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_users_last_active   ON users(last_active_at DESC)
  WHERE is_banned = FALSE;

-- ── User Settings & Daily Stats ────────────────────────────

CREATE TABLE user_settings (
  user_id               UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  leaderboard_visible   BOOLEAN NOT NULL DEFAULT TRUE,
  profile_public        BOOLEAN NOT NULL DEFAULT TRUE,
  locale                VARCHAR(10) DEFAULT 'en',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_daily_stats (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stat_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  quests_completed SMALLINT NOT NULL DEFAULT 0,
  xp_earned        INTEGER NOT NULL DEFAULT 0,
  energy_consumed  SMALLINT NOT NULL DEFAULT 0,
  login_count      SMALLINT NOT NULL DEFAULT 0,
  was_active       BOOLEAN NOT NULL DEFAULT FALSE,
  level_ups        SMALLINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, stat_date)
);

CREATE INDEX idx_daily_stats_user_date ON user_daily_stats(user_id, stat_date DESC);

-- ── Wallets ────────────────────────────────────────────────

CREATE TABLE wallets (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  address          TEXT NOT NULL UNIQUE,
  address_friendly TEXT,
  address_raw      TEXT,
  public_key       TEXT,
  wallet_version   TEXT,
  status           wallet_status NOT NULL DEFAULT 'connected',
  connected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_at  TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata         JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT wallets_address_length CHECK (char_length(address) BETWEEN 32 AND 68)
);

CREATE INDEX idx_wallets_user    ON wallets(user_id, status);
CREATE INDEX idx_wallets_address ON wallets(address)
  WHERE status = 'connected';

-- ── TON Transactions ───────────────────────────────────────
-- FIX: amount_ton als normale Spalte (kein GENERATED ALWAYS AS)

CREATE TABLE ton_transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tx_hash           TEXT NOT NULL UNIQUE,
  lt                BIGINT,
  sender_address    TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  amount_nano       BIGINT NOT NULL CHECK (amount_nano > 0),
  amount_ton        NUMERIC(18,9),
  fee_nano          BIGINT,
  status            tx_status NOT NULL DEFAULT 'pending',
  block_seq_no      BIGINT,
  confirmed_at      TIMESTAMPTZ,
  failed_at         TIMESTAMPTZ,
  failure_reason    TEXT,
  comment           TEXT,
  raw_data          JSONB,
  detected_via      TEXT NOT NULL DEFAULT 'webhook',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ton_tx_hash    ON ton_transactions(tx_hash);
CREATE INDEX idx_ton_tx_pending ON ton_transactions(status, created_at)
  WHERE status IN ('pending','confirming');

-- Trigger: amount_ton automatisch berechnen
CREATE OR REPLACE FUNCTION fn_calc_amount_ton()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.amount_ton := NEW.amount_nano::NUMERIC / 1000000000;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calc_amount_ton
  BEFORE INSERT OR UPDATE OF amount_nano ON ton_transactions
  FOR EACH ROW EXECUTE FUNCTION fn_calc_amount_ton();

-- ── Quest Templates ────────────────────────────────────────

CREATE TABLE quest_templates (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  internal_code    TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  difficulty       quest_difficulty NOT NULL,
  quest_type       quest_type NOT NULL,
  energy_cost      SMALLINT NOT NULL CHECK (energy_cost > 0),
  xp_reward        INTEGER NOT NULL CHECK (xp_reward > 0),
  token_reward     INTEGER NOT NULL DEFAULT 0,
  action_spec      JSONB NOT NULL DEFAULT '{}',
  validation_rules JSONB NOT NULL DEFAULT '{}',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  season_id        UUID REFERENCES seasons(id),
  icon_key         TEXT,
  sort_order       SMALLINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quest_templates_type ON quest_templates(quest_type, is_active);

-- ── Daily Quest Assignments ────────────────────────────────
-- FIX: expired_at als normale Spalte + Trigger (kein GENERATED ALWAYS AS)

CREATE TABLE daily_quest_assignments (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id        UUID NOT NULL REFERENCES quest_templates(id),
  quest_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  season_id          UUID REFERENCES seasons(id),
  status             quest_status NOT NULL DEFAULT 'available',
  assigned_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  expired_at         TIMESTAMPTZ,
  xp_granted         INTEGER CHECK (xp_granted > 0),
  energy_spent       SMALLINT CHECK (energy_spent > 0),
  completion_time_ms INTEGER,
  completion_nonce   TEXT UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, template_id, quest_date),
  CONSTRAINT daily_quest_nonce_on_complete
    CHECK (status != 'completed' OR completion_nonce IS NOT NULL)
);

-- Trigger: expired_at = nächster Tag Mitternacht UTC
CREATE OR REPLACE FUNCTION fn_set_quest_expired_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.expired_at IS NULL THEN
    NEW.expired_at := (NEW.quest_date + 1)::TIMESTAMP AT TIME ZONE 'UTC';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_daily_quest_expired_at
  BEFORE INSERT ON daily_quest_assignments
  FOR EACH ROW EXECUTE FUNCTION fn_set_quest_expired_at();

CREATE INDEX idx_daily_quests_user_date ON daily_quest_assignments(user_id, quest_date);
-- FIX: Kein NOW() im Index-Prädikat
CREATE INDEX idx_daily_quests_status ON daily_quest_assignments(status, quest_date);
CREATE UNIQUE INDEX idx_daily_quests_nonce ON daily_quest_assignments(completion_nonce)
  WHERE completion_nonce IS NOT NULL;

-- ── Weekly Quest Assignments ───────────────────────────────

CREATE TABLE weekly_quest_assignments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id      UUID NOT NULL REFERENCES quest_templates(id),
  season_id        UUID REFERENCES seasons(id),
  iso_year         SMALLINT NOT NULL,
  iso_week         SMALLINT NOT NULL CHECK (iso_week BETWEEN 1 AND 53),
  status           quest_status NOT NULL DEFAULT 'available',
  assigned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  xp_granted       INTEGER CHECK (xp_granted > 0),
  energy_spent     SMALLINT CHECK (energy_spent > 0),
  completion_nonce TEXT UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, template_id, iso_year, iso_week)
);

CREATE INDEX idx_weekly_quests_user ON weekly_quest_assignments(user_id, iso_year, iso_week);

-- ── Action Nonces ──────────────────────────────────────────

CREATE TABLE action_nonces (
  nonce         TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type   TEXT NOT NULL,
  action_ref_id UUID,
  used_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  ip_hash       TEXT
);

-- FIX: Kein NOW() im Index-Prädikat
CREATE INDEX idx_nonces_expiry    ON action_nonces(expires_at);
CREATE INDEX idx_nonces_user_type ON action_nonces(user_id, action_type);

-- ── XP Logs ────────────────────────────────────────────────

CREATE TABLE xp_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id     UUID REFERENCES seasons(id) ON DELETE SET NULL,
  source_type   xp_source_type NOT NULL,
  source_ref_id UUID,
  xp_base       INTEGER NOT NULL CHECK (xp_base > 0),
  xp_bonus      INTEGER NOT NULL DEFAULT 0 CHECK (xp_bonus >= 0),
  xp_granted    INTEGER NOT NULL CHECK (xp_granted >= xp_base),
  boost_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (boost_percent BETWEEN 0 AND 25),
  boost_capped  BOOLEAN NOT NULL DEFAULT FALSE,
  soft_capped   BOOLEAN NOT NULL DEFAULT FALSE,
  xp_before_cap INTEGER,
  level_before  SMALLINT NOT NULL,
  level_after   SMALLINT NOT NULL,
  leveled_up    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT xp_logs_level_valid CHECK (level_after >= level_before)
);

CREATE INDEX idx_xp_logs_user   ON xp_logs(user_id, created_at DESC);
CREATE INDEX idx_xp_logs_season ON xp_logs(season_id, user_id)
  WHERE season_id IS NOT NULL;

-- ── Energy Logs ────────────────────────────────────────────

CREATE TABLE energy_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta         SMALLINT NOT NULL CHECK (delta != 0),
  reason        TEXT NOT NULL,
  reason_ref_id UUID,
  energy_before SMALLINT NOT NULL CHECK (energy_before BETWEEN 0 AND 100),
  energy_after  SMALLINT NOT NULL CHECK (energy_after BETWEEN 0 AND 100),
  session_id    UUID,
  ip_hash       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT energy_logs_math CHECK (
    energy_after = LEAST(100, GREATEST(0, energy_before + delta))
  )
);

CREATE INDEX idx_energy_logs_user ON energy_logs(user_id, created_at DESC);

-- ── Level History ──────────────────────────────────────────

CREATE TABLE level_history (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_level     SMALLINT NOT NULL CHECK (from_level BETWEEN 1 AND 29),
  to_level       SMALLINT NOT NULL CHECK (to_level BETWEEN 2 AND 30),
  xp_log_id      UUID NOT NULL REFERENCES xp_logs(id),
  league_changed BOOLEAN NOT NULL DEFAULT FALSE,
  new_league     league_tier,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, to_level),
  CONSTRAINT level_progression CHECK (to_level = from_level + 1)
);

-- ── Ecosystem Support ──────────────────────────────────────

CREATE TABLE ecosystem_support (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id          UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  tx_id              UUID NOT NULL UNIQUE REFERENCES ton_transactions(id),
  tier               ecosystem_tier NOT NULL,
  ton_amount         NUMERIC(18,9) NOT NULL CHECK (ton_amount > 0),
  xp_boost_percent   NUMERIC(5,2) NOT NULL CHECK (xp_boost_percent BETWEEN 0 AND 25),
  boost_active_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  boost_active_until TIMESTAMPTZ NOT NULL,
  is_active          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ecosystem_boost_window CHECK (boost_active_until > boost_active_from)
);

CREATE INDEX idx_ecosystem_user_active
  ON ecosystem_support(user_id, is_active, boost_active_until)
  WHERE is_active = TRUE;

-- ── Referrals ──────────────────────────────────────────────

CREATE TABLE referrals (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id               UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  referral_code_used       TEXT NOT NULL,
  is_valid                 BOOLEAN NOT NULL DEFAULT FALSE,
  validation_failed_reason TEXT,
  referee_wallet_ok        BOOLEAN NOT NULL DEFAULT FALSE,
  referee_level_ok         BOOLEAN NOT NULL DEFAULT FALSE,
  referee_xp_ok            BOOLEAN NOT NULL DEFAULT FALSE,
  referee_active_days_ok   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at             TIMESTAMPTZ,
  CONSTRAINT referrals_no_self CHECK (referrer_id != referee_id)
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);

-- ── Leaderboard Cache ──────────────────────────────────────

CREATE TABLE leaderboard_cache (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_type   TEXT NOT NULL,
  season_id    UUID REFERENCES seasons(id) ON DELETE CASCADE,
  league       league_tier,
  rank         INTEGER NOT NULL CHECK (rank > 0),
  entity_id    UUID NOT NULL,
  entity_type  TEXT NOT NULL DEFAULT 'user',
  display_name TEXT NOT NULL,
  avatar_url   TEXT,
  score        BIGINT NOT NULL,
  level        SMALLINT,
  metadata     JSONB NOT NULL DEFAULT '{}',
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cache_type, season_id, league, rank)
);

CREATE INDEX idx_leaderboard_season_global
  ON leaderboard_cache(cache_type, season_id, rank)
  WHERE cache_type = 'season_global';

-- ── Anti-Bot ───────────────────────────────────────────────

CREATE TABLE antibot_scores (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  score             SMALLINT NOT NULL DEFAULT 100 CHECK (score BETWEEN 0 AND 100),
  velocity_score    SMALLINT NOT NULL DEFAULT 100,
  pattern_score     SMALLINT NOT NULL DEFAULT 100,
  wallet_score      SMALLINT NOT NULL DEFAULT 100,
  timing_score      SMALLINT NOT NULL DEFAULT 100,
  xp_cap_hits_today SMALLINT NOT NULL DEFAULT 0,
  replay_attempts   SMALLINT NOT NULL DEFAULT 0,
  review_required   BOOLEAN NOT NULL DEFAULT FALSE,
  auto_flagged      BOOLEAN NOT NULL DEFAULT FALSE,
  flag_reason       TEXT,
  last_scored_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE antibot_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type   antibot_event_type NOT NULL,
  severity     flag_severity NOT NULL DEFAULT 'low',
  score_impact SMALLINT NOT NULL DEFAULT 0,
  details      JSONB NOT NULL DEFAULT '{}',
  ip_hash      TEXT,
  session_id   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_antibot_events_user ON antibot_events(user_id, created_at DESC);

CREATE TABLE flag_reviews (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status       flag_status NOT NULL DEFAULT 'open',
  triggered_by TEXT NOT NULL,
  auto_score   SMALLINT NOT NULL,
  reviewer_id  UUID,
  reviewed_at  TIMESTAMPTZ,
  resolution   TEXT,
  action_taken TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── System Events ──────────────────────────────────────────

CREATE TABLE system_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  success       BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Request Logs ───────────────────────────────────────────

CREATE TABLE request_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  ip_hash     TEXT,
  endpoint    TEXT NOT NULL,
  method      VARCHAR(10) NOT NULL,
  status_code SMALLINT,
  response_ms INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FIX: Kein NOW() im Index-Prädikat
CREATE INDEX idx_request_logs_user ON request_logs(user_id, endpoint, created_at DESC);

-- ── Abschlusskontrolle ─────────────────────────────────────

DO $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM information_schema.tables
  WHERE table_schema = 'public';
  RAISE NOTICE '✅ Migration 1 fertig! % Tabellen erstellt.', v_count;
END;
$$;