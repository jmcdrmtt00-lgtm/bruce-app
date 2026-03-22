-- Allow 'email' as an incident source (for tickets created by the Gmail poller)
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_source_check;
ALTER TABLE incidents ADD CONSTRAINT incidents_source_check
  CHECK (source IN ('issue', 'onboarding', 'email'));
