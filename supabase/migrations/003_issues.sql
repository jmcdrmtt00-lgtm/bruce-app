-- Bruce IT: issue tracker
-- Run in Supabase SQL Editor after 002_onboarding.sql

-- ============================================================
-- Table: incidents
-- One row per IT problem reported
-- ============================================================
CREATE TABLE IF NOT EXISTS incidents (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT,                   -- AI-generated short summary
  description  TEXT        NOT NULL,   -- voice transcript of the problem
  reported_by  TEXT,                   -- who told Bruce about it
  status       TEXT        NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Table: incident_updates
-- Timestamped voice notes added to an incident over time
-- ============================================================
CREATE TABLE IF NOT EXISTS incident_updates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  UUID        NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL CHECK (type IN ('approach', 'progress', 'resolved')),
  note         TEXT        NOT NULL,   -- voice transcript
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_user_id            ON incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status             ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incident_updates_incident_id ON incident_updates(incident_id);

ALTER TABLE incidents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own incidents"
  ON incidents FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own incidents"
  ON incidents FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own incidents"
  ON incidents FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can read own incident updates"
  ON incident_updates FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own incident updates"
  ON incident_updates FOR INSERT WITH CHECK (auth.uid() = user_id);
