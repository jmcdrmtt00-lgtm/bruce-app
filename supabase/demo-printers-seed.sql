-- Demo org — printer assets seed
-- Paste into Supabase SQL Editor and run.
-- Safe to re-run: skips rows where serial_number + org_id already exists.
--
-- Mix of current network MFPs, nursing-station lasers, Zebra label printers,
-- and a couple of ageing workhorses that generate most of the helpdesk tickets.

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
    'Printer', v.name, v.site, v.status,
    v.make, v.model, v.serial_number, v.asset_number,
    NULL, NULL, v.purchased::date, v.price::numeric,
    v.install_date::date, v.warranty_expires::date, v.notes
  FROM (VALUES

    -- ══ HOLDEN ════════════════════════════════════════════════════════════════════

    -- MFP / admin
    ('HNH-PR-ADMIN',     'Holden (HRSNC)', 'active',  'HP',    'LaserJet Pro MFP M428fdw','SN-PR-001','P-101','2021-07-12', 429.00,'2021-07-15','2024-07-15','Admin office — IP: 10.10.1.90 — print/scan/fax — toner replaced 2024-01'),
    ('HNH-PR-COLOR',     'Holden (HRSNC)', 'active',  'Xerox', 'WorkCentre 6515',         'SN-PR-002','P-102','2020-03-18', 549.00,'2020-03-22','2023-03-22','DON office — color MFP — IP: 10.10.1.91 — cyan toner low, staff notified 2024-02 — not yet replaced'),

    -- Nursing stations
    ('HNH-PR-STATION1',  'Holden (HRSNC)', 'active',  'HP',    'LaserJet Pro M404n',      'SN-PR-003','P-103','2019-11-05', 299.00,'2019-11-08','2022-11-08','Nursing station 1 — IP: 10.10.1.92 — paper jams 2-3x/week, roller worn'),
    ('HNH-PR-STATION2',  'Holden (HRSNC)', 'active',  'HP',    'LaserJet Pro M404n',      'SN-PR-004','P-104','2021-04-14', 299.00,'2021-04-17','2024-04-17','Nursing station 2 — IP: 10.10.1.93'),

    -- Label printer (medication labels / patient wristbands)
    ('HNH-PR-LABEL',     'Holden (HRSNC)', 'active',  'Zebra', 'ZD420',                   'SN-PR-005','P-105','2021-09-20', 349.00,'2021-09-23','2024-09-23','Medication room — wristband and label printing — USB + network — ribbon replaced 2024-03'),

    -- The troublemaker — old HP that refuses to die
    ('HNH-PR-OLD',       'Holden (HRSNC)', 'active',  'HP',    'LaserJet P2035',           'SN-PR-006','P-106','2013-08-14', 199.00,'2013-08-16', NULL,        'Break room — purchased 2013 — USB only, shared via print server — jams constantly, fuser worn — replacement approved but not yet ordered'),

    -- ══ OAKDALE ═══════════════════════════════════════════════════════════════════

    ('ORSNC-PR-ADMIN',   'Oakdale (ORSNC)','active',  'HP',    'LaserJet Pro MFP M428fdw','SN-PR-007','P-201','2021-08-30', 429.00,'2021-09-03','2024-09-03','Admin / DON office — IP: 10.10.2.90 — print/scan/fax'),
    ('ORSNC-PR-STATION1','Oakdale (ORSNC)','active',  'HP',    'LaserJet Pro M404n',      'SN-PR-008','P-202','2020-06-11', 299.00,'2020-06-15','2023-06-15','Nursing station — IP: 10.10.2.91 — toner at 12%, order pending'),

    -- Label printer
    ('ORSNC-PR-LABEL',   'Oakdale (ORSNC)','active',  'Zebra', 'ZD420',                   'SN-PR-009','P-203','2022-02-08', 349.00,'2022-02-11','2025-02-11','Medication room — wristband and label printing'),

    -- Old Brother — constant source of tickets
    ('ORSNC-PR-OLD',     'Oakdale (ORSNC)','active',  'Brother','HL-2270DW',              'SN-PR-010','P-204','2015-04-22', 129.00,'2015-04-25', NULL,        'Back hallway — wireless unreliable, staff frequently re-add to laptops — drum unit overdue — 3 tickets in last 6 months'),

    -- ══ BUSINESS OFFICE ═══════════════════════════════════════════════════════════

    ('BUS-PR-MAIN',      'Business Office (OHC)','active', 'Xerox','WorkCentre 6515',     'SN-PR-011','P-301','2022-05-10', 549.00,'2022-05-13','2025-05-13','Main office — color MFP — IP: 10.10.3.90 — print/scan/copy — heavily used'),
    ('BUS-PR-EXEC',      'Business Office (OHC)','active', 'HP',   'LaserJet Pro M404n',  'SN-PR-012','P-302','2022-05-10', 299.00,'2022-05-13','2025-05-13','Executive area — IP: 10.10.3.91 — light use'),

    -- ══ RETIRED ═══════════════════════════════════════════════════════════════════

    (NULL,               'Holden (HRSNC)', 'retired', 'HP',    'LaserJet 4200n',           'SN-PR-013','P-901','2011-03-30', 799.00, NULL,        NULL,        'Retired 2021 — formatter board failed, parts unavailable — replaced by M428fdw'),
    (NULL,               'Oakdale (ORSNC)','retired', 'Xerox', 'WorkCentre 5335',          'SN-PR-014','P-902','2012-07-15',2199.00, NULL,        NULL,        'Retired 2022 — fuser failed, repair cost exceeded replacement — was the main copier')

  ) AS v(name, site, status, make, model, serial_number, asset_number, purchased, price, install_date, warranty_expires, notes)
  WHERE NOT EXISTS (
    SELECT 1 FROM assets a
    WHERE a.org_id = demo_org_id AND a.serial_number = v.serial_number
  );

  RAISE NOTICE 'Done. Total demo printer assets: %', (SELECT count(*) FROM assets WHERE org_id = demo_org_id AND category = 'Printer');
END $$;
