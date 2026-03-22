-- Drop the name column from assets.
-- It was a legacy field that duplicated assigned_to with no clear meaning.
-- Before dropping: copy any non-null name values into assigned_to where assigned_to is not yet set.

UPDATE assets
SET assigned_to = name
WHERE name IS NOT NULL
  AND (assigned_to IS NULL OR assigned_to = '');

ALTER TABLE assets DROP COLUMN IF EXISTS name;
