-- Add task management fields to incidents
-- Run after 004_incidents_source.sql

-- 1. Update status CHECK constraint to allow 'pending' (tasks waiting in queue)
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_status_check;
ALTER TABLE incidents ADD CONSTRAINT incidents_status_check
  CHECK (status IN ('open', 'in_progress', 'resolved', 'pending'));

-- 2. Add priority, screen, and task_number columns
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS priority    TEXT CHECK (priority IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS screen      TEXT,
  ADD COLUMN IF NOT EXISTS task_number INTEGER;

-- 3. Function to auto-assign a per-user incrementing task number on insert
CREATE OR REPLACE FUNCTION assign_task_number()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(task_number), 0) + 1 INTO NEW.task_number
  FROM incidents
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_task_number ON incidents;
CREATE TRIGGER set_task_number
  BEFORE INSERT ON incidents
  FOR EACH ROW EXECUTE FUNCTION assign_task_number();

-- 4. Backfill task_number for any existing rows
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
  FROM incidents
  WHERE task_number IS NULL
)
UPDATE incidents
SET    task_number = numbered.rn
FROM   numbered
WHERE  incidents.id = numbered.id;
