-- Demo org — computer assets seed
-- Paste into Supabase SQL Editor and run.
-- Safe to re-run: skips rows where serial_number + org_id already exists.
--
-- Scenario baked in:
--   • IT prefers Dell Latitude 5540 laptops for nursing/clinical staff
--   • All 8 units are assigned — 0 spares → onboarding a new nurse requires ordering one
--   • Several old HP Compaq 8200 and Dell OptiPlex 3020 machines still in service (red flag)
--   • Retired machines shown as status = 'retired'

DO $$
DECLARE
  demo_org_id  uuid;
  seed_user_id uuid;
BEGIN
  SELECT id INTO demo_org_id  FROM orgs        WHERE slug  = 'demo';
  SELECT id INTO seed_user_id FROM auth.users  WHERE email = 'jmcdrmtt00@gmail.com';

  IF demo_org_id  IS NULL THEN RAISE EXCEPTION 'Demo org not found';  END IF;
  IF seed_user_id IS NULL THEN RAISE EXCEPTION 'Seed user not found'; END IF;

  INSERT INTO assets (
    org_id, user_id, category, name, site, status,
    make, model, serial_number, asset_number,
    os, ram, purchased, price, install_date, warranty_expires, notes
  )
  SELECT
    demo_org_id, seed_user_id,
    v.category, v.name, v.site, v.status,
    v.make, v.model, v.serial_number, v.asset_number,
    v.os, v.ram, v.purchased::date, v.price::numeric,
    v.install_date::date, v.warranty_expires::date, v.notes
  FROM (VALUES

    -- ══ Dell Latitude 5540 — preferred nurse laptop (ALL assigned, 0 spare) ══════
    -- Assigned to DON / ADON and Social Services who need mobile access to PCC
    ('Computer','Patricia Burke',     'Holden (HRSNC)',       'active',  'Dell','Latitude 5540','SN-LAT55-001','A-101','Windows 11 Pro','16 GB','2023-02-10',1249.00,'2023-02-15','2026-02-15','DON — preferred model'),
    ('Computer','Wanda Pierce',       'Holden (HRSNC)',       'active',  'Dell','Latitude 5540','SN-LAT55-002','A-102','Windows 11 Pro','16 GB','2023-02-10',1249.00,'2023-02-15','2026-02-15','ADON'),
    ('Computer','Shirley Murray',     'Oakdale (ORSNC)',      'active',  'Dell','Latitude 5540','SN-LAT55-003','A-103','Windows 11 Pro','16 GB','2023-03-05',1249.00,'2023-03-10','2026-03-10','DON'),
    ('Computer','Cynthia Ross',       'Oakdale (ORSNC)',      'active',  'Dell','Latitude 5540','SN-LAT55-004','A-104','Windows 11 Pro','16 GB','2023-03-05',1249.00,'2023-03-10','2026-03-10','ADON'),
    ('Computer','Deborah Hayes',      'Holden (HRSNC)',       'active',  'Dell','Latitude 5540','SN-LAT55-005','A-105','Windows 11 Pro','16 GB','2022-11-18',1199.00,'2022-11-22','2025-11-22',NULL),
    ('Computer','Carolyn Griffin',    'Holden (HRSNC)',       'active',  'Dell','Latitude 5540','SN-LAT55-006','A-106','Windows 11 Pro','16 GB','2022-11-18',1199.00,'2022-11-22','2025-11-22',NULL),
    ('Computer','Judith Reed',        'Oakdale (ORSNC)',      'active',  'Dell','Latitude 5540','SN-LAT55-007','A-107','Windows 11 Pro','16 GB','2022-12-01',1199.00,'2022-12-05','2025-12-05',NULL),
    ('Computer','Marilyn Cook',       'Oakdale (ORSNC)',      'active',  'Dell','Latitude 5540','SN-LAT55-008','A-108','Windows 11 Pro','16 GB','2022-12-01',1199.00,'2022-12-05','2025-12-05',NULL),

    -- ══ Dell Latitude 7440 — executive laptops ════════════════════════════════════
    ('Computer','Robert Sterling',    'Business Office (OHC)','active',  'Dell','Latitude 7440','SN-LAT74-001','A-201','Windows 11 Pro','32 GB','2023-06-12',1699.00,'2023-06-15','2026-06-15','CEO'),
    ('Computer','Catherine Walsh',    'Business Office (OHC)','active',  'Dell','Latitude 7440','SN-LAT74-002','A-202','Windows 11 Pro','32 GB','2023-06-12',1699.00,'2023-06-15','2026-06-15',NULL),
    ('Computer','Margaret Foster',    'Holden (HRSNC)',       'active',  'Dell','Latitude 7440','SN-LAT74-003','A-203','Windows 11 Pro','32 GB','2023-07-20',1699.00,'2023-07-24','2026-07-24',NULL),

    -- ══ Dell OptiPlex 7090 — current desktop (2021-2022) ════════════════════════
    ('Computer','Barbara Clark',      'Business Office (OHC)','active',  'Dell','OptiPlex 7090','SN-OPX70-001','A-301','Windows 11 Pro','16 GB','2021-09-08', 879.00,'2021-09-12','2024-09-12',NULL),
    ('Computer','Susan Mitchell',     'Business Office (OHC)','active',  'Dell','OptiPlex 7090','SN-OPX70-002','A-302','Windows 11 Pro','16 GB','2021-09-08', 879.00,'2021-09-12','2024-09-12',NULL),
    ('Computer','Nancy Roberts',      'Business Office (OHC)','active',  'Dell','OptiPlex 7090','SN-OPX70-003','A-303','Windows 11 Pro','16 GB','2021-09-08', 879.00,'2021-09-12','2024-09-12',NULL),
    ('Computer','Karen Turner',       'Business Office (OHC)','active',  'Dell','OptiPlex 7090','SN-OPX70-004','A-304','Windows 11 Pro','16 GB','2022-01-14', 899.00,'2022-01-18','2025-01-18',NULL),
    ('Computer','Linda Phillips',     'Business Office (OHC)','active',  'Dell','OptiPlex 7090','SN-OPX70-005','A-305','Windows 11 Pro','16 GB','2022-01-14', 899.00,'2022-01-18','2025-01-18',NULL),
    ('Computer','Ronald James',       'Business Office (OHC)','active',  'Dell','OptiPlex 7090','SN-OPX70-006','A-306','Windows 11 Pro','16 GB','2022-03-22', 899.00,'2022-03-25','2025-03-25','HR'),
    ('Computer','Timothy Watson',     'Business Office (OHC)','active',  'Dell','OptiPlex 7090','SN-OPX70-007','A-307','Windows 11 Pro','16 GB','2022-03-22', 899.00,'2022-03-25','2025-03-25','HR'),
    ('Computer','Kenneth Brooks',     'Business Office (OHC)','active',  'Dell','OptiPlex 7090','SN-OPX70-008','A-308','Windows 11 Pro','16 GB','2022-04-10', 899.00,'2022-04-14','2025-04-14','HR'),
    ('Computer','Henry Ward',         'Holden (HRSNC)',       'active',  'Dell','OptiPlex 7090','SN-OPX70-009','A-309','Windows 11 Pro','16 GB','2022-06-01', 879.00,'2022-06-05','2025-06-05','Admissions'),
    ('Computer','Frank Peterson',     'Holden (HRSNC)',       'active',  'Dell','OptiPlex 7090','SN-OPX70-010','A-310','Windows 11 Pro','16 GB','2022-06-01', 879.00,'2022-06-05','2025-06-05','Admissions'),
    ('Computer','George Gray',        'Oakdale (ORSNC)',      'active',  'Dell','OptiPlex 7090','SN-OPX70-011','A-311','Windows 11 Pro','16 GB','2022-06-15', 879.00,'2022-06-20','2025-06-20','Admissions'),
    ('Computer','Thomas Ramirez',     'Oakdale (ORSNC)',      'active',  'Dell','OptiPlex 7090','SN-OPX70-012','A-312','Windows 11 Pro','16 GB','2022-06-15', 879.00,'2022-06-20','2025-06-20','Admissions'),
    -- 2 unassigned Dell OptiPlex 7090 spares
    ('Computer', NULL,                'Holden (HRSNC)',       'active',  'Dell','OptiPlex 7090','SN-OPX70-013','A-313','Windows 11 Pro','16 GB','2022-09-30', 879.00,'2022-10-03','2025-10-03','Spare'),
    ('Computer', NULL,                'Business Office (OHC)','active',  'Dell','OptiPlex 7090','SN-OPX70-014','A-314','Windows 11 Pro','16 GB','2022-09-30', 879.00,'2022-10-03','2025-10-03','Spare'),

    -- ══ HP EliteDesk 800 G8 — current desktop (2021-2022) ═══════════════════════
    ('Computer','Joan Bailey',        'Holden (HRSNC)',       'active',  'HP','EliteDesk 800 G8','SN-ELD8-001','A-401','Windows 11 Pro','16 GB','2021-11-10', 849.00,'2021-11-15','2024-11-15','Activities'),
    ('Computer','Anne Rivera',        'Holden (HRSNC)',       'active',  'HP','EliteDesk 800 G8','SN-ELD8-002','A-402','Windows 11 Pro','16 GB','2021-11-10', 849.00,'2021-11-15','2024-11-15','Activities'),
    ('Computer','Diane Cooper',       'Oakdale (ORSNC)',      'active',  'HP','EliteDesk 800 G8','SN-ELD8-003','A-403','Windows 11 Pro','16 GB','2022-02-07', 869.00,'2022-02-10','2025-02-10','Activities'),
    ('Computer','Steven Price',       'Holden (HRSNC)',       'active',  'HP','EliteDesk 800 G8','SN-ELD8-004','A-404','Windows 11 Pro','16 GB','2022-05-18', 869.00,'2022-05-22','2025-05-22','SDC'),
    ('Computer','Daniel Sanders',     'Holden (HRSNC)',       'active',  'HP','EliteDesk 800 G8','SN-ELD8-005','A-405','Windows 11 Pro','16 GB','2022-05-18', 869.00,'2022-05-22','2025-05-22','SDC'),
    ('Computer','Mark Bennett',       'Oakdale (ORSNC)',      'active',  'HP','EliteDesk 800 G8','SN-ELD8-006','A-406','Windows 11 Pro','16 GB','2022-07-11', 869.00,'2022-07-14','2025-07-14','SDC'),
    ('Computer','Paul Wood',          'Oakdale (ORSNC)',      'active',  'HP','EliteDesk 800 G8','SN-ELD8-007','A-407','Windows 11 Pro','16 GB','2022-07-11', 869.00,'2022-07-14','2025-07-14','SDC'),

    -- ══ Lenovo ThinkCentre M90n — decent, 2020 ═══════════════════════════════════
    ('Computer','James Parker',       'Holden (HRSNC)',       'active',  'Lenovo','ThinkCentre M90n','SN-M90N-001','A-501','Windows 10 Pro','16 GB','2020-04-06', 749.00,'2020-04-10','2023-04-10','Maintenance'),
    ('Computer','Kevin Brooks',       'Holden (HRSNC)',       'active',  'Lenovo','ThinkCentre M90n','SN-M90N-002','A-502','Windows 10 Pro','16 GB','2020-04-06', 749.00,'2020-04-10','2023-04-10','Maintenance'),
    ('Computer','Marcus Powell',      'Oakdale (ORSNC)',      'active',  'Lenovo','ThinkCentre M90n','SN-M90N-003','A-503','Windows 10 Pro','16 GB','2020-05-15', 749.00,'2020-05-19','2023-05-19','Maintenance'),
    ('Computer','Gerald Long',        'Oakdale (ORSNC)',      'active',  'Lenovo','ThinkCentre M90n','SN-M90N-004','A-504','Windows 10 Pro','16 GB','2020-05-15', 749.00,'2020-05-19','2023-05-19','Maintenance'),

    -- ══ OLD MACHINES — HP Compaq 8200 Elite (2012-2014) ══════════════════════════
    -- Still in service — should be flagged for replacement
    ('Computer','Betty Evans',        'Business Office (OHC)','active',  'HP','Compaq 8200 Elite','SN-C820-001','A-601','Windows 10 Pro', '8 GB','2013-03-12', 549.00,'2013-03-15', NULL,        'Overdue for replacement — warranty long expired'),
    ('Computer','Frances Edwards',    'Business Office (OHC)','active',  'HP','Compaq 8200 Elite','SN-C820-002','A-602','Windows 10 Pro', '4 GB','2013-03-12', 549.00,'2013-03-15', NULL,        'Only 4 GB RAM — very slow'),
    ('Computer','Helen Campbell',     'Business Office (OHC)','active',  'HP','Compaq 8200 Elite','SN-C820-003','A-603','Windows 10 Pro', '8 GB','2014-01-08', 529.00,'2014-01-10', NULL,        'Overdue for replacement'),
    -- Two retired HP Compaq 8200 sitting in storage
    ('Computer', NULL,                'Holden (HRSNC)',       'retired', 'HP','Compaq 8200 Elite','SN-C820-004','A-604','Windows 7 Pro',  '4 GB','2012-08-20', 499.00, NULL,        NULL,        'Retired — Windows 7, non-functional HDD'),
    ('Computer', NULL,                'Oakdale (ORSNC)',      'retired', 'HP','Compaq 8200 Elite','SN-C820-005','A-605','Windows 7 Pro',  '4 GB','2012-08-20', 499.00, NULL,        NULL,        'Retired — Windows 7'),

    -- ══ OLD MACHINES — Dell OptiPlex 3020 (2014-2016) ════════════════════════════
    ('Computer','Mary Barnes',        'Holden (HRSNC)',       'active',  'Dell','OptiPlex 3020','SN-OPX30-001','A-701','Windows 10 Pro', '8 GB','2015-06-03', 579.00,'2015-06-06', NULL,        'Concierge desk — slow, needs upgrade'),
    ('Computer','Sarah Ross',         'Holden (HRSNC)',       'active',  'Dell','OptiPlex 3020','SN-OPX30-002','A-702','Windows 10 Pro', '8 GB','2015-06-03', 579.00,'2015-06-06', NULL,        'Evening concierge'),
    ('Computer','Jessica Howard',     'Oakdale (ORSNC)',      'active',  'Dell','OptiPlex 3020','SN-OPX30-003','A-703','Windows 10 Pro', '8 GB','2016-02-11', 599.00,'2016-02-15', NULL,        'Concierge — fan loud, monitor flickers occasionally'),
    ('Computer', NULL,                'Oakdale (ORSNC)',      'retired', 'Dell','OptiPlex 3020','SN-OPX30-004','A-704','Windows 10 Pro', '4 GB','2014-09-30', 559.00, NULL,        NULL,        'Retired — motherboard failed')

  ) AS v(category, name, site, status, make, model, serial_number, asset_number, os, ram, purchased, price, install_date, warranty_expires, notes)
  WHERE NOT EXISTS (
    SELECT 1 FROM assets a
    WHERE a.org_id = demo_org_id AND a.serial_number = v.serial_number
  );

  RAISE NOTICE 'Done. Total demo assets: %', (SELECT count(*) FROM assets WHERE org_id = demo_org_id);
END $$;
