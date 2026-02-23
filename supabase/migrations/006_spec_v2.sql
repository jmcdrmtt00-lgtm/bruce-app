-- Migration 006: Spec v2 schema changes
-- 1. Add date_due, date_completed, auto_suggested to incidents
-- 2. Drop medium priority (high / low / null only)
-- 3. Create computers table

-- ── incidents: new columns ────────────────────────────────────────────────
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS date_due       DATE,
  ADD COLUMN IF NOT EXISTS date_completed DATE,
  ADD COLUMN IF NOT EXISTS auto_suggested BOOLEAN NOT NULL DEFAULT FALSE;

-- Drop old priority constraint and replace without 'medium'
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_priority_check;
UPDATE incidents SET priority = NULL WHERE priority = 'medium';
ALTER TABLE incidents
  ADD CONSTRAINT incidents_priority_check
  CHECK (priority IN ('high', 'low'));

-- ── computers table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS computers (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name      TEXT,
  notes          TEXT,
  machine_brand  TEXT,
  machine_type   TEXT,
  os             TEXT,
  serial_number  TEXT,
  asset_number   TEXT,
  ram            TEXT,
  purchased      DATE,
  price          NUMERIC(10,2),
  install_date   DATE,
  site           TEXT,
  status         TEXT        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'retired')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE computers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own computers"
  ON computers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
