-- Expand the incident_updates type constraint.
-- The original constraint only allowed 'approach', 'progress', 'resolved',
-- but the application also saves 'ai_response' (AI diagnosis results),
-- 'user_reply' (follow-up answers), and 'details' (task info fields).
-- Without this fix those inserts silently fail, so AI-generated state is
-- lost when the user leaves and returns to a task.

ALTER TABLE incident_updates DROP CONSTRAINT IF EXISTS incident_updates_type_check;
ALTER TABLE incident_updates ADD CONSTRAINT incident_updates_type_check
  CHECK (type IN ('approach', 'progress', 'resolved', 'ai_response', 'user_reply', 'details'));
