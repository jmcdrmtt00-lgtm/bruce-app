-- Add assigned_to column to assets table
-- Maps to the headerless first column in Bruce's Excel sheets (person name, role, or location)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS assigned_to text;
