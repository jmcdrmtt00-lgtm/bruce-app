-- Bruce IT: onboarding sessions
-- Run in Supabase SQL Editor after 001_bruce_init.sql

CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name        TEXT        NOT NULL,
  last_name         TEXT        NOT NULL,
  role              TEXT        NOT NULL,
  site              TEXT        NOT NULL,
  start_date        DATE,
  next_asset_number TEXT,
  computer_name     TEXT,
  notes             TEXT,
  login_id          TEXT        NOT NULL,
  systems           TEXT[]      NOT NULL DEFAULT '{}',
  computer_type     TEXT        NOT NULL DEFAULT 'none',
  status            TEXT        NOT NULL DEFAULT 'in_progress'
                                CHECK (status IN ('in_progress', 'complete')),
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_user_id ON onboarding_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_status  ON onboarding_sessions(status);

ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own onboarding sessions"
  ON onboarding_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding sessions"
  ON onboarding_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding sessions"
  ON onboarding_sessions FOR UPDATE
  USING (auth.uid() = user_id);
