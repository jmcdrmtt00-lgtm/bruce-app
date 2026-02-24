CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  role             TEXT NOT NULL,
  site             TEXT NOT NULL,
  start_date       DATE,
  next_asset_number TEXT,
  computer_name    TEXT,
  notes            TEXT,
  login_id         TEXT,
  systems          JSONB,
  computer_type    TEXT,
  status           TEXT NOT NULL DEFAULT 'in_progress'
                     CHECK (status IN ('in_progress', 'complete')),
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own onboarding sessions"
  ON onboarding_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own onboarding sessions"
  ON onboarding_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own onboarding sessions"
  ON onboarding_sessions FOR UPDATE
  USING (auth.uid() = user_id);
