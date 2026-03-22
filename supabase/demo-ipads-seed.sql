-- Demo org — iPad assets seed
-- Paste into Supabase SQL Editor and run.
-- Safe to re-run: skips rows where serial_number + org_id already exists.
--
-- Mix of current iPad 10th gen, mid-age iPad 7th gen, ageing iPad 6th gen,
-- and a couple of iPad Air 2s that really should be retired.
-- Shared floor iPads named by station; individually assigned ones by person.

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
    'iPad', v.name, v.site, v.status,
    v.make, v.model, v.serial_number, v.asset_number,
    v.os, v.ram, v.purchased::date, v.price::numeric,
    v.install_date::date, v.warranty_expires::date, v.notes
  FROM (VALUES

    -- ══ iPad 10th Generation (2022-2023) — current ════════════════════════════════

    -- Holden — assigned to DON / ADON and one shared nursing station
    ('Patricia Burke',    'Holden (HRSNC)',       'active', 'Apple','iPad (10th gen)','SN-IPAD10-001','I-101','iPadOS 17.4','4 GB','2023-02-10', 449.00,'2023-02-15','2025-02-15','DON — 64 GB Wi-Fi — MDM enrolled'),
    ('Wanda Pierce',      'Holden (HRSNC)',       'active', 'Apple','iPad (10th gen)','SN-IPAD10-002','I-102','iPadOS 17.4','4 GB','2023-02-10', 449.00,'2023-02-15','2025-02-15','ADON — 64 GB Wi-Fi — MDM enrolled'),
    ('HNH — Station 1',  'Holden (HRSNC)',       'active', 'Apple','iPad (10th gen)','SN-IPAD10-003','I-103','iPadOS 17.4','4 GB','2023-04-18', 449.00,'2023-04-22','2025-04-22','Shared — nursing station 1 — 64 GB Wi-Fi — MDM enrolled'),
    ('HNH — Station 2',  'Holden (HRSNC)',       'active', 'Apple','iPad (10th gen)','SN-IPAD10-004','I-104','iPadOS 17.4','4 GB','2023-04-18', 449.00,'2023-04-22','2025-04-22','Shared — nursing station 2 — 64 GB Wi-Fi — MDM enrolled'),

    -- Oakdale — assigned to DON / ADON and one shared station
    ('Shirley Murray',    'Oakdale (ORSNC)',      'active', 'Apple','iPad (10th gen)','SN-IPAD10-005','I-105','iPadOS 17.4','4 GB','2023-03-07', 449.00,'2023-03-12','2025-03-12','DON — 64 GB Wi-Fi — MDM enrolled'),
    ('Cynthia Ross',      'Oakdale (ORSNC)',      'active', 'Apple','iPad (10th gen)','SN-IPAD10-006','I-106','iPadOS 17.4','4 GB','2023-03-07', 449.00,'2023-03-12','2025-03-12','ADON — 64 GB Wi-Fi — MDM enrolled'),
    ('ORSNC — Station 1','Oakdale (ORSNC)',      'active', 'Apple','iPad (10th gen)','SN-IPAD10-007','I-107','iPadOS 17.4','4 GB','2023-05-02', 449.00,'2023-05-06','2025-05-06','Shared — nursing station — 64 GB Wi-Fi — MDM enrolled'),

    -- Business Office — spare / float
    ('BUS — Float',      'Business Office (OHC)','active', 'Apple','iPad (10th gen)','SN-IPAD10-008','I-108','iPadOS 17.4','4 GB','2023-06-20', 449.00,'2023-06-24','2025-06-24','Float device — lent to new hires during onboarding — MDM enrolled'),

    -- ══ iPad (7th Generation, 2019) — mid-age, iPadOS 16 ═════════════════════════

    ('HNH — Med Cart A', 'Holden (HRSNC)',       'active', 'Apple','iPad (7th gen)', 'SN-IPAD7-001', 'I-201','iPadOS 16.7','3 GB','2020-01-15', 329.00,'2020-01-20','2022-01-20','Med cart A — 32 GB — battery at 84% — MDM enrolled'),
    ('HNH — Med Cart B', 'Holden (HRSNC)',       'active', 'Apple','iPad (7th gen)', 'SN-IPAD7-002', 'I-202','iPadOS 16.7','3 GB','2020-01-15', 329.00,'2020-01-20','2022-01-20','Med cart B — 32 GB — battery at 79% — screen protector cracked'),
    ('HNH — Med Cart C', 'Holden (HRSNC)',       'active', 'Apple','iPad (7th gen)', 'SN-IPAD7-003', 'I-203','iPadOS 16.7','3 GB','2020-03-10', 329.00,'2020-03-14','2022-03-14','Med cart C — 32 GB — MDM enrolled'),
    ('ORSNC — Med Cart A','Oakdale (ORSNC)',     'active', 'Apple','iPad (7th gen)', 'SN-IPAD7-004', 'I-204','iPadOS 16.7','3 GB','2020-02-18', 329.00,'2020-02-22','2022-02-22','Med cart A — 32 GB — battery at 81%'),
    ('ORSNC — Med Cart B','Oakdale (ORSNC)',     'active', 'Apple','iPad (7th gen)', 'SN-IPAD7-005', 'I-205','iPadOS 16.7','3 GB','2020-02-18', 329.00,'2020-02-22','2022-02-22','Med cart B — 32 GB — charging port intermittent, reported by staff'),
    ('Brian Hughes',      'Holden (HRSNC)',       'active', 'Apple','iPad (7th gen)', 'SN-IPAD7-006', 'I-206','iPadOS 16.7','3 GB','2020-06-05', 329.00,'2020-06-09','2022-06-09','Home Health — 64 GB cellular — MDM enrolled'),

    -- ══ iPad (6th Generation, 2018) — ageing, getting slow ═══════════════════════

    ('HNH — Station 3',  'Holden (HRSNC)',       'active', 'Apple','iPad (6th gen)', 'SN-IPAD6-001', 'I-301','iPadOS 16.7','3 GB','2019-04-08', 299.00,'2019-04-11','2021-04-11','Station 3 — 32 GB — slow on PCC, staff complaints — battery 71%'),
    ('ORSNC — Station 2','Oakdale (ORSNC)',      'active', 'Apple','iPad (6th gen)', 'SN-IPAD6-002', 'I-302','iPadOS 16.7','3 GB','2019-04-08', 299.00,'2019-04-11','2021-04-11','Station 2 — 32 GB — performance issues noted — replace next cycle'),
    ('ORSNC — Station 3','Oakdale (ORSNC)',      'active', 'Apple','iPad (6th gen)', 'SN-IPAD6-003', 'I-303','iPadOS 16.7','3 GB','2018-11-20', 299.00,'2018-11-24','2020-11-24','Station 3 — 32 GB — cracked corner, still functional — battery 68%'),
    ('HNH — Spare',      'Holden (HRSNC)',       'active', 'Apple','iPad (6th gen)', 'SN-IPAD6-004', 'I-304','iPadOS 16.7','3 GB','2018-11-20', 299.00,'2018-11-24','2020-11-24','Backup device — 32 GB — battery 65%, recommend replacement'),

    -- ══ iPad Air 2 (2015-2016) — end of life ══════════════════════════════════════
    -- Max OS is iPadOS 15 — incompatible with latest PCC app requirements

    ('HNH — Break Room',  'Holden (HRSNC)',      'active', 'Apple','iPad Air 2',     'SN-IPADA2-001','I-401','iPadOS 15.8','2 GB','2016-02-14', 399.00,'2016-02-17', NULL,         'Break room — 16 GB — stuck on iPadOS 15, some apps incompatible — replace ASAP'),
    (NULL,                'Holden (HRSNC)',       'retired','Apple','iPad Air 2',     'SN-IPADA2-002','I-402','iPadOS 15.8','2 GB','2015-09-30', 399.00, NULL,         NULL,         'Retired 2023 — battery non-functional, screen delaminating'),
    (NULL,                'Oakdale (ORSNC)',      'retired','Apple','iPad Air 2',     'SN-IPADA2-003','I-403','iPadOS 15.8','2 GB','2015-09-30', 399.00, NULL,         NULL,         'Retired 2023 — dropped, digitizer cracked')

  ) AS v(name, site, status, make, model, serial_number, asset_number, os, ram, purchased, price, install_date, warranty_expires, notes)
  WHERE NOT EXISTS (
    SELECT 1 FROM assets a
    WHERE a.org_id = demo_org_id AND a.serial_number = v.serial_number
  );

  RAISE NOTICE 'Done. Total demo iPad assets: %', (SELECT count(*) FROM assets WHERE org_id = demo_org_id AND category = 'iPad');
END $$;
