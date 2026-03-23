-- Migration 013: Add assigned_to column to incidents table

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS assigned_to TEXT;
