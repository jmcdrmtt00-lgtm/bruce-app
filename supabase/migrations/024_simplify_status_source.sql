-- 024_simplify_status_source.sql
-- Simplify status to open/completed; source to it/email/direct_ticket
-- Add awaiting_reply and self_fixed columns

-- 1. Add new columns
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS awaiting_reply boolean NOT NULL DEFAULT false;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS self_fixed     boolean NOT NULL DEFAULT false;

-- 2. Drop old constraints before migrating data
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_status_check;
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_source_check;

-- 3. Migrate status values
UPDATE incidents SET status = 'open'      WHERE status IN ('in_progress', 'pending', 'needs_info');
UPDATE incidents SET status = 'completed' WHERE status = 'resolved';

-- 4. Mark self_fixed before migrating source
UPDATE incidents SET self_fixed = true
  WHERE source IN ('nurse_self_fix', 'submitted by nurse fixed by nurse');

-- 5. Migrate source values
UPDATE incidents SET source = 'it'
  WHERE source IN ('issue', 'onboarding', 'submitted by IT') OR source IS NULL;

UPDATE incidents SET source = 'direct_ticket'
  WHERE source IN (
    'ticket', 'nurse',
    'submitted by nurse adequate info',
    'submitted by nurse needs more info',
    'submitted by nurse fixed by nurse',
    'nurse_self_fix'
  );

-- email stays as 'email' — no update needed

-- 6. Add new constraints
ALTER TABLE incidents ADD CONSTRAINT incidents_status_check
  CHECK (status IN ('open', 'completed'));

ALTER TABLE incidents ADD CONSTRAINT incidents_source_check
  CHECK (source IN ('it', 'email', 'direct_ticket'));
