-- Replace the computers table with a generic assets table

CREATE TABLE IF NOT EXISTS assets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category         TEXT NOT NULL DEFAULT 'Computer',  -- Computer, Printer, Phone, iPad, Camera, Network, etc.
  name             TEXT,           -- person name, desk label, or asset identifier
  site             TEXT,           -- Holden, Oakdale, Business Office, IT Office, Shared
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  make             TEXT,           -- brand (HP, Lenovo, ThinkCentre, Polycom, etc.)
  model            TEXT,           -- model name or machine type
  serial_number    TEXT,
  asset_number     TEXT,
  os               TEXT,           -- primarily for computers / tablets
  ram              TEXT,           -- primarily for computers
  purchased        DATE,
  price            NUMERIC(10,2),
  install_date     DATE,
  warranty_expires DATE,
  notes            TEXT,
  extra            JSONB,          -- flexible bucket for asset-type-specific fields
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate existing computer data
INSERT INTO assets (
  id, user_id, category, name, site, status,
  make, model, serial_number, asset_number,
  os, ram, purchased, price, install_date,
  notes, created_at
)
SELECT
  id, user_id, 'Computer', user_name, site, status,
  machine_brand, machine_type, serial_number, asset_number,
  os, ram, purchased, price, install_date,
  notes, created_at
FROM computers;

-- Drop the old table
DROP TABLE computers;

-- RLS
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own assets"
  ON assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own assets"
  ON assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own assets"
  ON assets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own assets"
  ON assets FOR DELETE
  USING (auth.uid() = user_id);
