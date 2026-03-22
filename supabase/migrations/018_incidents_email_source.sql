-- Allow 'email' as an incident source (for tickets created by the Gmail poller)
-- Drop any existing source check constraint (name may vary)
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'incidents'::regclass
      AND contype  = 'c'
      AND conname  LIKE '%source%'
  LOOP
    EXECUTE 'ALTER TABLE incidents DROP CONSTRAINT ' || quote_ident(c);
  END LOOP;
END $$;

ALTER TABLE incidents ADD CONSTRAINT incidents_source_check
  CHECK (source IN ('issue', 'onboarding', 'ticket', 'email'));
