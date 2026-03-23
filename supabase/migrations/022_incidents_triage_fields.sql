-- Add triage result and draft reply fields to incidents.
-- triage_result: 'adequate' | 'needs_info' (set by the Gmail poller after AI triage)
-- draft_reply:   the reply text IT Buddy drafted for Bruce to review before sending

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS triage_result text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS draft_reply   text;
