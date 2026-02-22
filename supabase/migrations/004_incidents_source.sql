-- Bruce IT: add source tracking to incidents
-- Run in Supabase SQL Editor after 003_issues.sql

ALTER TABLE incidents
  ADD COLUMN source TEXT NOT NULL DEFAULT 'issue'
    CHECK (source IN ('issue', 'onboarding')),
  ADD COLUMN onboarding_session_id UUID
    REFERENCES onboarding_sessions(id) ON DELETE SET NULL;
