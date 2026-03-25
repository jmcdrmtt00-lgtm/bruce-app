-- Expand the incidents source check constraint to include nurse and IT-submitted sources.

ALTER TABLE incidents DROP CONSTRAINT incidents_source_check;

ALTER TABLE incidents ADD CONSTRAINT incidents_source_check
  CHECK (source IN (
    'issue',
    'onboarding',
    'ticket',
    'email',
    'submitted by IT',
    'submitted by nurse adequate info',
    'submitted by nurse needs more info',
    'submitted by nurse fixed by nurse',
    'nurse_self_fix',
    'nurse'
  ));
