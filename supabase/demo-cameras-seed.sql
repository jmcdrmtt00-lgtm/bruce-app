-- Demo org — camera assets seed
-- Paste into Supabase SQL Editor and run.
-- Safe to re-run: skips rows where serial_number + org_id already exists.
--
-- Holden only — surveillance system installed 2022.
-- Oakdale and Business Office have no cameras yet.

DO $$
DECLARE
  demo_org_id  uuid;
  seed_user_id uuid;
BEGIN
  SELECT id INTO demo_org_id  FROM orgs       WHERE slug  = 'demo';
  SELECT id INTO seed_user_id FROM auth.users WHERE email = 'jmcdrmtt00@gmail.com';

  IF demo_org_id  IS NULL THEN RAISE EXCEPTION 'Demo org not found';  END IF;
  IF seed_user_id IS NULL THEN RAISE EXCEPTION 'Seed user not found'; END IF;

  INSERT INTO assets (
    org_id, user_id, category, name, site, status,
    make, model, serial_number, asset_number,
    os, ram, purchased, price, install_date, warranty_expires, notes
  )
  SELECT
    demo_org_id, seed_user_id,
    'Camera', v.name, v.site, v.status,
    v.make, v.model, v.serial_number, v.asset_number,
    NULL, NULL, v.purchased::date, v.price::numeric,
    v.install_date::date, v.warranty_expires::date, v.notes
  FROM (VALUES

    -- ══ NVR (Network Video Recorder) ══════════════════════════════════════════════
    ('HNH-NVR-01',       'Holden (HRSNC)', 'active', 'Hikvision','DS-7616NXI-I2/S',  'SN-NVR-001','C-101', '2022-09-14',1299.00,'2022-09-18','2025-09-18','16-channel NVR — 4 TB storage — IP: 10.10.1.80 — IDF room'),

    -- ══ Interior cameras ══════════════════════════════════════════════════════════
    ('HNH-CAM-01',       'Holden (HRSNC)', 'active', 'Hikvision','DS-2CD2143G2-I',   'SN-CAM-001', 'C-102', '2022-09-14', 159.00,'2022-09-18','2025-09-18','Main entrance — 4MP dome — PoE'),
    ('HNH-CAM-02',       'Holden (HRSNC)', 'active', 'Hikvision','DS-2CD2143G2-I',   'SN-CAM-002', 'C-103', '2022-09-14', 159.00,'2022-09-18','2025-09-18','Front lobby — 4MP dome — PoE'),
    ('HNH-CAM-03',       'Holden (HRSNC)', 'active', 'Hikvision','DS-2CD2143G2-I',   'SN-CAM-003', 'C-104', '2022-09-14', 159.00,'2022-09-18','2025-09-18','Corridor A — 4MP dome — PoE'),
    ('HNH-CAM-04',       'Holden (HRSNC)', 'active', 'Hikvision','DS-2CD2143G2-I',   'SN-CAM-004', 'C-105', '2022-09-14', 159.00,'2022-09-18','2025-09-18','Corridor B — 4MP dome — PoE'),
    ('HNH-CAM-05',       'Holden (HRSNC)', 'active', 'Hikvision','DS-2CD2143G2-I',   'SN-CAM-005', 'C-106', '2022-09-14', 159.00,'2022-09-18','2025-09-18','Medication room — 4MP dome — PoE — compliance requirement'),
    ('HNH-CAM-06',       'Holden (HRSNC)', 'active', 'Hikvision','DS-2CD2143G2-I',   'SN-CAM-006', 'C-107', '2022-09-14', 159.00,'2022-09-18','2025-09-18','Staff break room — 4MP dome — PoE'),
    ('HNH-CAM-07',       'Holden (HRSNC)', 'active', 'Hikvision','DS-2CD2143G2-I',   'SN-CAM-007', 'C-108', '2022-10-05', 159.00,'2022-10-08','2025-10-08','Side entrance — 4MP dome — added after initial install'),

    -- ══ Exterior cameras ══════════════════════════════════════════════════════════
    ('HNH-CAM-EXT-01',   'Holden (HRSNC)', 'active', 'Hikvision','DS-2CD2T47G2-L',   'SN-CAM-008', 'C-109', '2022-09-14', 219.00,'2022-09-18','2025-09-18','Front parking lot — 4MP ColorVu bullet — PoE'),
    ('HNH-CAM-EXT-02',   'Holden (HRSNC)', 'active', 'Hikvision','DS-2CD2T47G2-L',   'SN-CAM-009', 'C-110', '2022-09-14', 219.00,'2022-09-18','2025-09-18','Rear entrance / loading dock — 4MP ColorVu bullet — PoE'),
    ('HNH-CAM-EXT-03',   'Holden (HRSNC)', 'active', 'Hikvision','DS-2CD2T47G2-L',   'SN-CAM-010', 'C-111', '2022-09-14', 219.00,'2022-09-18','2025-09-18','Side lot — 4MP ColorVu bullet — PoE — image occasionally washed out in direct sun, noted for review')

  ) AS v(name, site, status, make, model, serial_number, asset_number, purchased, price, install_date, warranty_expires, notes)
  WHERE NOT EXISTS (
    SELECT 1 FROM assets a
    WHERE a.org_id = demo_org_id AND a.serial_number = v.serial_number
  );

  RAISE NOTICE 'Done. Total demo camera assets: %', (SELECT count(*) FROM assets WHERE org_id = demo_org_id AND category = 'Camera');
END $$;
