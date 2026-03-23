-- Demo org — network assets seed
-- Paste into Supabase SQL Editor and run.
-- Safe to re-run: skips rows where serial_number + org_id already exists.
--
-- Three sites: Holden (largest), Oakdale (medium), Business Office (small)
-- Mix of current Meraki cloud-managed gear and ageing Cisco / HP switches
-- still in production — a few clearly overdue for replacement.

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
    'Network', v.name, v.site, v.status,
    v.make, v.model, v.serial_number, v.asset_number,
    v.os, v.ram, v.purchased::date, v.price::numeric,
    v.install_date::date, v.warranty_expires::date, v.notes
  FROM (VALUES

    -- ══ FIREWALLS ═════════════════════════════════════════════════════════════════

    ('HNH-FW-01',    'Holden (HRSNC)',       'active',  'Cisco Meraki','MX68',          'SN-MX68-001','N-101', 'MX 18.211.2', NULL, '2021-08-15',  949.00,'2021-08-20','2024-08-20', 'WAN: ISP circuit 1 — LAN: 10.10.1.1 — primary firewall'),
    ('ORSNC-FW-01',  'Oakdale (ORSNC)',      'active',  'Cisco Meraki','MX68',          'SN-MX68-002','N-102', 'MX 18.211.2', NULL, '2021-09-03',  949.00,'2021-09-08','2024-09-08', 'LAN: 10.10.2.1'),
    ('BUS-FW-01',    'Business Office (OHC)','active',  'Cisco Meraki','MX67',          'SN-MX67-001','N-103', 'MX 18.211.2', NULL, '2022-02-14',  749.00,'2022-02-18','2025-02-18', 'LAN: 10.10.3.1 — smaller office'),

    -- ══ CORE SWITCHES — current (2022) ═══════════════════════════════════════════

    ('HNH-SW-CORE',  'Holden (HRSNC)',       'active',  'Cisco','Catalyst 9200L-24P',  'SN-CAT92-001','N-201','IOS-XE 17.9.3',NULL,'2022-03-10',3499.00,'2022-03-14','2025-03-14','Mgmt: 10.10.1.2 — 24-port PoE core switch, IDF room'),
    ('ORSNC-SW-CORE','Oakdale (ORSNC)',      'active',  'Cisco','Catalyst 9200L-24P',  'SN-CAT92-002','N-202','IOS-XE 17.9.3',NULL,'2022-04-05',3499.00,'2022-04-09','2025-04-09','Mgmt: 10.10.2.2'),
    ('BUS-SW-CORE',  'Business Office (OHC)','active',  'Cisco','Catalyst 9200L-24P',  'SN-CAT92-003','N-203','IOS-XE 17.9.3',NULL,'2022-04-05',3499.00,'2022-04-09','2025-04-09','Mgmt: 10.10.3.2'),

    -- ══ FLOOR / ACCESS SWITCHES — ageing Cisco 2960 (2016-2017) ══════════════════
    -- Still running — no critical issues yet but end-of-support approaching

    ('HNH-SW-01',    'Holden (HRSNC)',       'active',  'Cisco','Catalyst 2960-24TT-L','SN-C2960-001','N-301','IOS 15.2(7)',  NULL,'2016-05-12', 899.00,'2016-05-16', NULL,         'Mgmt: 10.10.1.10 — Wing A closet — end-of-support 2026'),
    ('HNH-SW-02',    'Holden (HRSNC)',       'active',  'Cisco','Catalyst 2960-24TT-L','SN-C2960-002','N-302','IOS 15.2(7)',  NULL,'2016-05-12', 899.00,'2016-05-16', NULL,         'Mgmt: 10.10.1.11 — Wing B closet — end-of-support 2026'),
    ('HNH-SW-03',    'Holden (HRSNC)',       'active',  'Cisco','Catalyst 2960-48TT-L','SN-C2960-003','N-303','IOS 15.2(7)',  NULL,'2017-01-19',1249.00,'2017-01-23', NULL,         'Mgmt: 10.10.1.12 — main floor — 48-port'),
    ('ORSNC-SW-01',  'Oakdale (ORSNC)',      'active',  'Cisco','Catalyst 2960-24TT-L','SN-C2960-004','N-304','IOS 15.2(7)',  NULL,'2017-03-08', 899.00,'2017-03-12', NULL,         'Mgmt: 10.10.2.10 — single floor closet'),

    -- ══ VERY OLD SWITCH — HP ProCurve still in production ════════════════════════

    ('BUS-SW-01',    'Business Office (OHC)','active',  'HP','ProCurve 2510-24',       'SN-HPC25-001','N-305','K.13.57',      NULL,'2013-06-18', 429.00,'2013-06-20', NULL,         'Mgmt: 10.10.3.10 — purchased 2013, no warranty — replace soon'),

    -- ══ RETIRED SWITCHES ══════════════════════════════════════════════════════════

    ('HNH-SW-OLD',   'Holden (HRSNC)',       'retired', 'Netgear','GS724Tv4',          'SN-NGS7-001', 'N-306',NULL,          NULL,'2014-02-27', 219.00, NULL,         NULL,         'Retired 2022 — replaced by core switch'),
    ('ORSNC-SW-OLD', 'Oakdale (ORSNC)',      'retired', 'HP','ProCurve 2510-48',       'SN-HPC25-002','N-307','K.13.57',      NULL,'2013-06-18', 589.00, NULL,         NULL,         'Retired 2022 — port failures'),

    -- ══ WIRELESS ACCESS POINTS — Meraki MR46 (current) ═══════════════════════════

    ('HNH-AP-01',    'Holden (HRSNC)',       'active',  'Cisco Meraki','MR46',          'SN-MR46-001','N-401', 'MR 29.7.1',   NULL,'2021-08-15',  649.00,'2021-08-20','2024-08-20', '10.10.1.50 — lobby'),
    ('HNH-AP-02',    'Holden (HRSNC)',       'active',  'Cisco Meraki','MR46',          'SN-MR46-002','N-402', 'MR 29.7.1',   NULL,'2021-08-15',  649.00,'2021-08-20','2024-08-20', '10.10.1.51 — Wing A'),
    ('HNH-AP-03',    'Holden (HRSNC)',       'active',  'Cisco Meraki','MR46',          'SN-MR46-003','N-403', 'MR 29.7.1',   NULL,'2022-06-10',  679.00,'2022-06-14','2025-06-14', '10.10.1.52 — Wing B'),
    ('HNH-AP-04',    'Holden (HRSNC)',       'active',  'Cisco Meraki','MR46',          'SN-MR46-004','N-404', 'MR 29.7.1',   NULL,'2022-06-10',  679.00,'2022-06-14','2025-06-14', '10.10.1.53 — dining / common area'),
    ('ORSNC-AP-01',  'Oakdale (ORSNC)',      'active',  'Cisco Meraki','MR46',          'SN-MR46-005','N-405', 'MR 29.7.1',   NULL,'2022-04-22',  679.00,'2022-04-26','2025-04-26', '10.10.2.50 — lobby'),
    ('ORSNC-AP-02',  'Oakdale (ORSNC)',      'active',  'Cisco Meraki','MR46',          'SN-MR46-006','N-406', 'MR 29.7.1',   NULL,'2022-04-22',  679.00,'2022-04-26','2025-04-26', '10.10.2.51 — main floor'),
    ('ORSNC-AP-03',  'Oakdale (ORSNC)',      'active',  'Cisco Meraki','MR46',          'SN-MR46-007','N-407', 'MR 29.7.1',   NULL,'2022-04-22',  679.00,'2022-04-26','2025-04-26', '10.10.2.52 — east wing'),
    ('BUS-AP-01',    'Business Office (OHC)','active',  'Cisco Meraki','MR46',          'SN-MR46-008','N-408', 'MR 29.7.1',   NULL,'2022-05-03',  679.00,'2022-05-07','2025-05-07', '10.10.3.50 — open office'),
    ('BUS-AP-02',    'Business Office (OHC)','active',  'Cisco Meraki','MR46',          'SN-MR46-009','N-409', 'MR 29.7.1',   NULL,'2022-05-03',  679.00,'2022-05-07','2025-05-07', '10.10.3.51 — conference room'),

    -- ══ OLD WIRELESS APs — Cisco Aironet still in service ════════════════════════
    -- 802.11ac Wave 1 only, no Wi-Fi 6 — slow for PCC on tablets

    ('HNH-AP-OLD-01','Holden (HRSNC)',       'active',  'Cisco','Aironet 2702i',        'SN-AIR27-001','N-410','AIR 15.3.3',  NULL,'2015-03-30',  629.00,'2015-04-02', NULL,         'Wing C — old 802.11ac, no Wi-Fi 6 — tablet performance issues'),
    ('HNH-AP-OLD-02','Holden (HRSNC)',       'active',  'Cisco','Aironet 2702i',        'SN-AIR27-002','N-411','AIR 15.3.3',  NULL,'2015-03-30',  629.00,'2015-04-02', NULL,         'Nurses station 2 — end-of-support 2020, replace when budget allows'),
    ('ORSNC-AP-OLD', 'Oakdale (ORSNC)',      'active',  'Cisco','Aironet 2702i',        'SN-AIR27-003','N-412','AIR 15.3.3',  NULL,'2015-05-14',  629.00,'2015-05-18', NULL,         'Back hallway — last remaining old AP at this site')

  ) AS v(name, site, status, make, model, serial_number, asset_number, os, ram, purchased, price, install_date, warranty_expires, notes)
  WHERE NOT EXISTS (
    SELECT 1 FROM assets a
    WHERE a.org_id = demo_org_id AND a.serial_number = v.serial_number
  );

  RAISE NOTICE 'Done. Total demo network assets: %', (SELECT count(*) FROM assets WHERE org_id = demo_org_id AND category = 'Network');
END $$;
