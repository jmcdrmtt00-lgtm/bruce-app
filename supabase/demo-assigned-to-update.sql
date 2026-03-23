-- Demo org — set assigned_to for all assets
-- Computers and iPads: assigned_to = name (person name or station label already there)
-- Printers, Network, Cameras: assigned_to = human-readable location label
-- Paste into Supabase SQL Editor and run. Safe to re-run.

DO $$
DECLARE
  demo_org_id uuid;
BEGIN
  SELECT id INTO demo_org_id FROM orgs WHERE slug = 'demo';
  IF demo_org_id IS NULL THEN RAISE EXCEPTION 'Demo org not found'; END IF;

  -- ── Computers & iPads: person name / station label is already in name column ──
  UPDATE assets
  SET assigned_to = name
  WHERE org_id = demo_org_id
    AND category IN ('Computer', 'iPad')
    AND name IS NOT NULL
    AND status IN ('active', 'retired');

  -- ── Printers: location labels ─────────────────────────────────────────────────
  UPDATE assets SET assigned_to = v.location
  FROM (VALUES
    ('SN-PR-001', 'Admin Office'),
    ('SN-PR-002', 'DON Office'),
    ('SN-PR-003', 'Nursing Station 1'),
    ('SN-PR-004', 'Nursing Station 2'),
    ('SN-PR-005', 'Medication Room'),
    ('SN-PR-006', 'Break Room'),
    ('SN-PR-007', 'Admin / DON Office'),
    ('SN-PR-008', 'Nursing Station'),
    ('SN-PR-009', 'Medication Room'),
    ('SN-PR-010', 'Back Hallway'),
    ('SN-PR-011', 'Main Office'),
    ('SN-PR-012', 'Executive Area')
  ) AS v(serial_number, location)
  WHERE assets.org_id = demo_org_id
    AND assets.serial_number = v.serial_number;

  -- ── Network: room / closet labels ────────────────────────────────────────────
  UPDATE assets SET assigned_to = v.location
  FROM (VALUES
    ('SN-MX68-001', 'IDF Room'),
    ('SN-MX68-002', 'IDF Room'),
    ('SN-MX67-001', 'IDF Room'),
    ('SN-CAT92-001', 'IDF Room'),
    ('SN-CAT92-002', 'IDF Room'),
    ('SN-CAT92-003', 'IDF Room'),
    ('SN-C2960-001', 'Wing A Wiring Closet'),
    ('SN-C2960-002', 'Wing B Wiring Closet'),
    ('SN-C2960-003', 'Main Floor Wiring Closet'),
    ('SN-C2960-004', 'Floor Wiring Closet'),
    ('SN-HPC25-001', 'Wiring Closet'),
    ('SN-MR46-001', 'Lobby'),
    ('SN-MR46-002', 'Wing A'),
    ('SN-MR46-003', 'Wing B'),
    ('SN-MR46-004', 'Dining / Common Area'),
    ('SN-MR46-005', 'Lobby'),
    ('SN-MR46-006', 'Main Floor'),
    ('SN-MR46-007', 'East Wing'),
    ('SN-MR46-008', 'Open Office'),
    ('SN-MR46-009', 'Conference Room'),
    ('SN-AIR27-001', 'Wing C'),
    ('SN-AIR27-002', 'Nursing Station 2'),
    ('SN-AIR27-003', 'Back Hallway')
  ) AS v(serial_number, location)
  WHERE assets.org_id = demo_org_id
    AND assets.serial_number = v.serial_number;

  -- ── Cameras: installation location ───────────────────────────────────────────
  UPDATE assets SET assigned_to = v.location
  FROM (VALUES
    ('SN-NVR-001',  'IDF Room'),
    ('SN-CAM-001',  'Main Entrance'),
    ('SN-CAM-002',  'Front Lobby'),
    ('SN-CAM-003',  'Corridor A'),
    ('SN-CAM-004',  'Corridor B'),
    ('SN-CAM-005',  'Medication Room'),
    ('SN-CAM-006',  'Staff Break Room'),
    ('SN-CAM-007',  'Side Entrance'),
    ('SN-CAM-008',  'Front Parking Lot'),
    ('SN-CAM-009',  'Rear Entrance / Loading Dock'),
    ('SN-CAM-010',  'Side Lot')
  ) AS v(serial_number, location)
  WHERE assets.org_id = demo_org_id
    AND assets.serial_number = v.serial_number;

  RAISE NOTICE 'Done. Assets with assigned_to set: %',
    (SELECT count(*) FROM assets WHERE org_id = demo_org_id AND assigned_to IS NOT NULL);
END $$;
