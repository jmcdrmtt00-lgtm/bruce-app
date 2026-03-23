-- Store the Gmail message ID on email-sourced incidents.
-- The unique constraint prevents duplicate tickets if the same email
-- is processed more than once (e.g. mark-as-read failed on a prior run).

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS gmail_message_id text;

ALTER TABLE incidents
  ADD CONSTRAINT incidents_gmail_message_id_unique UNIQUE (gmail_message_id);
