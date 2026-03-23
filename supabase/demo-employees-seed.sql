-- Demo org — 100 fictional employees seed
-- Paste into Supabase SQL Editor and run.
-- Safe to re-run: uses INSERT ... WHERE NOT EXISTS on ee_number + org_id.

DO $$
DECLARE
  demo_org_id uuid;
BEGIN
  SELECT id INTO demo_org_id FROM orgs WHERE slug = 'demo';
  IF demo_org_id IS NULL THEN
    RAISE EXCEPTION 'Demo org not found — check that slug = ''demo'' exists in orgs table';
  END IF;

  INSERT INTO employees (org_id, email, first_name, last_name, ee_number, site, position, hours_per_week, shift, is_approved_submitter)
  SELECT demo_org_id, v.email, v.first_name, v.last_name, v.ee_number, v.site, v.position, v.hours_per_week, v.shift, v.is_approved_submitter
  FROM (VALUES
    -- ── CNA / Floor Clinical — Holden (18) ───────────────────────────────
    ('maria.rodriguez@demo-health.com',   'Maria',     'Rodriguez',  'E001', 'Holden (HRSNC)', 'CNA / Floor Clinical',      40, 'Day',     false),
    ('angela.thompson@demo-health.com',   'Angela',    'Thompson',   'E002', 'Holden (HRSNC)', 'CNA / Floor Clinical',      40, 'Day',     false),
    ('keisha.williams@demo-health.com',   'Keisha',    'Williams',   'E003', 'Holden (HRSNC)', 'CNA / Floor Clinical',      40, 'Evening', false),
    ('jennifer.cruz@demo-health.com',     'Jennifer',  'Cruz',       'E004', 'Holden (HRSNC)', 'CNA / Floor Clinical',      32, 'Evening', false),
    ('tanya.moore@demo-health.com',       'Tanya',     'Moore',      'E005', 'Holden (HRSNC)', 'CNA / Floor Clinical',      40, 'Night',   false),
    ('rosa.gonzalez@demo-health.com',     'Rosa',      'Gonzalez',   'E006', 'Holden (HRSNC)', 'CNA / Floor Clinical',      32, 'Day',     false),
    ('destiny.jackson@demo-health.com',   'Destiny',   'Jackson',    'E007', 'Holden (HRSNC)', 'CNA / Floor Clinical',      40, 'Evening', false),
    ('latoya.harris@demo-health.com',     'Latoya',    'Harris',     'E008', 'Holden (HRSNC)', 'CNA / Floor Clinical',      32, 'Night',   false),
    ('carmen.perez@demo-health.com',      'Carmen',    'Perez',      'E009', 'Holden (HRSNC)', 'CNA / Floor Clinical',      40, 'Day',     false),
    ('shaniqua.davis@demo-health.com',    'Shaniqua',  'Davis',      'E010', 'Holden (HRSNC)', 'CNA / Floor Clinical',      24, 'Evening', false),
    ('patricia.brown@demo-health.com',    'Patricia',  'Brown',      'E011', 'Holden (HRSNC)', 'CNA / Floor Clinical',      40, 'Night',   false),
    ('michelle.lee@demo-health.com',      'Michelle',  'Lee',        'E012', 'Holden (HRSNC)', 'CNA / Floor Clinical',      40, 'Day',     false),
    ('yolanda.martinez@demo-health.com',  'Yolanda',   'Martinez',   'E013', 'Holden (HRSNC)', 'CNA / Floor Clinical',      32, 'Evening', false),
    ('denise.taylor@demo-health.com',     'Denise',    'Taylor',     'E014', 'Holden (HRSNC)', 'CNA / Floor Clinical',      40, 'Night',   false),
    ('crystal.johnson@demo-health.com',   'Crystal',   'Johnson',    'E015', 'Holden (HRSNC)', 'CNA / Floor Clinical',      40, 'Day',     false),
    ('brenda.wilson@demo-health.com',     'Brenda',    'Wilson',     'E016', 'Holden (HRSNC)', 'CNA / Floor Clinical',      40, 'Evening', false),
    ('tamika.white@demo-health.com',      'Tamika',    'White',      'E017', 'Holden (HRSNC)', 'CNA / Floor Clinical',      32, 'Night',   false),
    ('sandra.thomas@demo-health.com',     'Sandra',    'Thomas',     'E018', 'Holden (HRSNC)', 'CNA / Floor Clinical',      40, 'Day',     false),
    -- ── CNA / Floor Clinical — Oakdale (12) ──────────────────────────────
    ('melissa.garcia@demo-health.com',    'Melissa',   'Garcia',     'E019', 'Oakdale (ORSNC)', 'CNA / Floor Clinical',     40, 'Day',     false),
    ('vanessa.hernandez@demo-health.com', 'Vanessa',   'Hernandez',  'E020', 'Oakdale (ORSNC)', 'CNA / Floor Clinical',     40, 'Evening', false),
    ('felicia.rivera@demo-health.com',    'Felicia',   'Rivera',     'E021', 'Oakdale (ORSNC)', 'CNA / Floor Clinical',     40, 'Night',   false),
    ('jasmine.robinson@demo-health.com',  'Jasmine',   'Robinson',   'E022', 'Oakdale (ORSNC)', 'CNA / Floor Clinical',     32, 'Day',     false),
    ('tracey.walker@demo-health.com',     'Tracey',    'Walker',     'E023', 'Oakdale (ORSNC)', 'CNA / Floor Clinical',     40, 'Evening', false),
    ('stephanie.young@demo-health.com',   'Stephanie', 'Young',      'E024', 'Oakdale (ORSNC)', 'CNA / Floor Clinical',     24, 'Night',   false),
    ('nicole.allen@demo-health.com',      'Nicole',    'Allen',      'E025', 'Oakdale (ORSNC)', 'CNA / Floor Clinical',     40, 'Day',     false),
    ('lisa.king@demo-health.com',         'Lisa',      'King',       'E026', 'Oakdale (ORSNC)', 'CNA / Floor Clinical',     32, 'Evening', false),
    ('amy.scott@demo-health.com',         'Amy',       'Scott',      'E027', 'Oakdale (ORSNC)', 'CNA / Floor Clinical',     40, 'Night',   false),
    ('dawn.torres@demo-health.com',       'Dawn',      'Torres',     'E028', 'Oakdale (ORSNC)', 'CNA / Floor Clinical',     40, 'Day',     false),
    ('gina.hill@demo-health.com',         'Gina',      'Hill',       'E029', 'Oakdale (ORSNC)', 'CNA / Floor Clinical',     40, 'Evening', false),
    ('regina.flores@demo-health.com',     'Regina',    'Flores',     'E030', 'Oakdale (ORSNC)', 'CNA / Floor Clinical',     32, 'Night',   false),
    -- ── Kitchen / Food Services — Holden (5) ─────────────────────────────
    ('jose.ramirez@demo-health.com',      'Jose',      'Ramirez',    'E031', 'Holden (HRSNC)', 'Kitchen / Food Services',   40, 'Day',     false),
    ('miguel.santos@demo-health.com',     'Miguel',    'Santos',     'E032', 'Holden (HRSNC)', 'Kitchen / Food Services',   40, 'Day',     false),
    ('elena.morales@demo-health.com',     'Elena',     'Morales',    'E033', 'Holden (HRSNC)', 'Kitchen / Food Services',   32, 'Evening', false),
    ('roberto.diaz@demo-health.com',      'Roberto',   'Diaz',       'E034', 'Holden (HRSNC)', 'Kitchen / Food Services',   24, 'Day',     false),
    ('lucia.reyes@demo-health.com',       'Lucia',     'Reyes',      'E035', 'Holden (HRSNC)', 'Kitchen / Food Services',   32, 'Evening', false),
    -- ── Kitchen / Food Services — Oakdale (5) ────────────────────────────
    ('carlos.mendoza@demo-health.com',    'Carlos',    'Mendoza',    'E036', 'Oakdale (ORSNC)', 'Kitchen / Food Services',  40, 'Day',     false),
    ('ana.castillo@demo-health.com',      'Ana',       'Castillo',   'E037', 'Oakdale (ORSNC)', 'Kitchen / Food Services',  32, 'Day',     false),
    ('pedro.vargas@demo-health.com',      'Pedro',     'Vargas',     'E038', 'Oakdale (ORSNC)', 'Kitchen / Food Services',  40, 'Evening', false),
    ('gloria.romero@demo-health.com',     'Gloria',    'Romero',     'E039', 'Oakdale (ORSNC)', 'Kitchen / Food Services',  24, 'Day',     false),
    ('francisco.guerrero@demo-health.com','Francisco', 'Guerrero',   'E040', 'Oakdale (ORSNC)', 'Kitchen / Food Services',  32, 'Evening', false),
    -- ── Maintenance — Holden (3) ──────────────────────────────────────────
    ('james.parker@demo-health.com',      'James',     'Parker',     'E041', 'Holden (HRSNC)', 'Maintenance',               40, 'Day',     false),
    ('kevin.brooks@demo-health.com',      'Kevin',     'Brooks',     'E042', 'Holden (HRSNC)', 'Maintenance',               40, 'Day',     false),
    ('derek.coleman@demo-health.com',     'Derek',     'Coleman',    'E043', 'Holden (HRSNC)', 'Maintenance',               40, 'Day',     false),
    -- ── Maintenance — Oakdale (3) ─────────────────────────────────────────
    ('marcus.powell@demo-health.com',     'Marcus',    'Powell',     'E044', 'Oakdale (ORSNC)', 'Maintenance',              40, 'Day',     false),
    ('gerald.long@demo-health.com',       'Gerald',    'Long',       'E045', 'Oakdale (ORSNC)', 'Maintenance',              40, 'Day',     false),
    ('raymond.bennett@demo-health.com',   'Raymond',   'Bennett',    'E046', 'Oakdale (ORSNC)', 'Maintenance',              40, 'Day',     false),
    -- ── Executive ─────────────────────────────────────────────────────────
    ('robert.sterling@demo-health.com',   'Robert',    'Sterling',   'E047', 'Business Office (OHC)', 'Executive',          40, 'Day',     true),
    ('catherine.walsh@demo-health.com',   'Catherine', 'Walsh',      'E048', 'Business Office (OHC)', 'Executive',          40, 'Day',     true),
    ('margaret.foster@demo-health.com',   'Margaret',  'Foster',     'E049', 'Holden (HRSNC)', 'Executive',                 40, 'Day',     true),
    -- ── IT ────────────────────────────────────────────────────────────────
    ('david.chen@demo-health.com',        'David',     'Chen',       'E050', 'Business Office (OHC)', 'IT',                 40, 'Day',     true),
    ('jason.park@demo-health.com',        'Jason',     'Park',       'E051', 'Business Office (OHC)', 'IT',                 40, 'Day',     true),
    -- ── Business Office (12) ──────────────────────────────────────────────
    ('barbara.clark@demo-health.com',     'Barbara',   'Clark',      'E052', 'Business Office (OHC)', 'Business Office',    40, 'Day',     false),
    ('susan.mitchell@demo-health.com',    'Susan',     'Mitchell',   'E053', 'Business Office (OHC)', 'Business Office',    40, 'Day',     false),
    ('nancy.roberts@demo-health.com',     'Nancy',     'Roberts',    'E054', 'Business Office (OHC)', 'Business Office',    40, 'Day',     false),
    ('karen.turner@demo-health.com',      'Karen',     'Turner',     'E055', 'Business Office (OHC)', 'Business Office',    40, 'Day',     false),
    ('linda.phillips@demo-health.com',    'Linda',     'Phillips',   'E056', 'Business Office (OHC)', 'Business Office',    40, 'Day',     false),
    ('helen.campbell@demo-health.com',    'Helen',     'Campbell',   'E057', 'Business Office (OHC)', 'Business Office',    40, 'Day',     false),
    ('ruth.anderson@demo-health.com',     'Ruth',      'Anderson',   'E058', 'Business Office (OHC)', 'Business Office',    40, 'Day',     false),
    ('dorothy.turner@demo-health.com',    'Dorothy',   'Turner',     'E059', 'Business Office (OHC)', 'Business Office',    32, 'Day',     false),
    ('betty.evans@demo-health.com',       'Betty',     'Evans',      'E060', 'Business Office (OHC)', 'Business Office',    40, 'Day',     false),
    ('frances.edwards@demo-health.com',   'Frances',   'Edwards',    'E061', 'Business Office (OHC)', 'Business Office',    40, 'Day',     false),
    ('alice.collins@demo-health.com',     'Alice',     'Collins',    'E062', 'Business Office (OHC)', 'Business Office',    32, 'Day',     false),
    ('grace.stewart@demo-health.com',     'Grace',     'Stewart',    'E063', 'Business Office (OHC)', 'Business Office',    40, 'Day',     false),
    -- ── DON / ADON (2 per site) ───────────────────────────────────────────
    ('patricia.burke@demo-health.com',    'Patricia',  'Burke',      'E064', 'Holden (HRSNC)', 'DON / ADON',               40, 'Day',     false),
    ('wanda.pierce@demo-health.com',      'Wanda',     'Pierce',     'E065', 'Holden (HRSNC)', 'DON / ADON',               40, 'Day',     false),
    ('shirley.murray@demo-health.com',    'Shirley',   'Murray',     'E066', 'Oakdale (ORSNC)', 'DON / ADON',              40, 'Day',     false),
    ('cynthia.ross@demo-health.com',      'Cynthia',   'Ross',       'E067', 'Oakdale (ORSNC)', 'DON / ADON',              40, 'Day',     false),
    -- ── Social Services / Case Mgr ────────────────────────────────────────
    ('deborah.hayes@demo-health.com',     'Deborah',   'Hayes',      'E068', 'Holden (HRSNC)', 'Social Services / Case Mgr', 40, 'Day',   false),
    ('carolyn.griffin@demo-health.com',   'Carolyn',   'Griffin',    'E069', 'Holden (HRSNC)', 'Social Services / Case Mgr', 40, 'Day',   false),
    ('judith.reed@demo-health.com',       'Judith',    'Reed',       'E070', 'Oakdale (ORSNC)', 'Social Services / Case Mgr',40, 'Day',   false),
    ('marilyn.cook@demo-health.com',      'Marilyn',   'Cook',       'E071', 'Oakdale (ORSNC)', 'Social Services / Case Mgr',40, 'Day',   false),
    -- ── Activities ────────────────────────────────────────────────────────
    ('joan.bailey@demo-health.com',       'Joan',      'Bailey',     'E072', 'Holden (HRSNC)', 'Activities',               40, 'Day',     false),
    ('anne.rivera@demo-health.com',       'Anne',      'Rivera',     'E073', 'Holden (HRSNC)', 'Activities',               32, 'Day',     false),
    ('diane.cooper@demo-health.com',      'Diane',     'Cooper',     'E074', 'Oakdale (ORSNC)', 'Activities',              40, 'Day',     false),
    ('evelyn.richardson@demo-health.com', 'Evelyn',    'Richardson', 'E075', 'Oakdale (ORSNC)', 'Activities',              32, 'Day',     false),
    ('kathleen.cox@demo-health.com',      'Kathleen',  'Cox',        'E076', 'Business Office (OHC)', 'Activities',         40, 'Day',     false),
    -- ── Admissions ────────────────────────────────────────────────────────
    ('henry.ward@demo-health.com',        'Henry',     'Ward',       'E077', 'Holden (HRSNC)', 'Admissions',               40, 'Day',     false),
    ('frank.peterson@demo-health.com',    'Frank',     'Peterson',   'E078', 'Holden (HRSNC)', 'Admissions',               40, 'Day',     false),
    ('george.gray@demo-health.com',       'George',    'Gray',       'E079', 'Oakdale (ORSNC)', 'Admissions',              40, 'Day',     false),
    ('thomas.ramirez@demo-health.com',    'Thomas',    'Ramirez',    'E080', 'Oakdale (ORSNC)', 'Admissions',              40, 'Day',     false),
    -- ── Human Resources ───────────────────────────────────────────────────
    ('ronald.james@demo-health.com',      'Ronald',    'James',      'E081', 'Business Office (OHC)', 'Human Resources',   40, 'Day',     false),
    ('timothy.watson@demo-health.com',    'Timothy',   'Watson',     'E082', 'Business Office (OHC)', 'Human Resources',   40, 'Day',     false),
    ('kenneth.brooks@demo-health.com',    'Kenneth',   'Brooks',     'E083', 'Business Office (OHC)', 'Human Resources',   40, 'Day',     false),
    ('sharon.kelly@demo-health.com',      'Sharon',    'Kelly',      'E084', 'Business Office (OHC)', 'Human Resources',   32, 'Day',     false),
    -- ── SDC ───────────────────────────────────────────────────────────────
    ('steven.price@demo-health.com',      'Steven',    'Price',      'E085', 'Holden (HRSNC)', 'SDC',                      40, 'Day',     false),
    ('daniel.sanders@demo-health.com',    'Daniel',    'Sanders',    'E086', 'Holden (HRSNC)', 'SDC',                      40, 'Day',     false),
    ('mark.bennett@demo-health.com',      'Mark',      'Bennett',    'E087', 'Oakdale (ORSNC)', 'SDC',                     40, 'Day',     false),
    ('paul.wood@demo-health.com',         'Paul',      'Wood',       'E088', 'Oakdale (ORSNC)', 'SDC',                     40, 'Day',     false),
    -- ── Concierge ─────────────────────────────────────────────────────────
    ('mary.barnes@demo-health.com',       'Mary',      'Barnes',     'E089', 'Holden (HRSNC)', 'Concierge',                40, 'Day',     false),
    ('sarah.ross@demo-health.com',        'Sarah',     'Ross',       'E090', 'Holden (HRSNC)', 'Concierge',                40, 'Evening', false),
    ('jessica.howard@demo-health.com',    'Jessica',   'Howard',     'E091', 'Oakdale (ORSNC)', 'Concierge',               40, 'Day',     false),
    ('ashley.turner@demo-health.com',     'Ashley',    'Turner',     'E092', 'Oakdale (ORSNC)', 'Concierge',               40, 'Evening', false),
    ('megan.coleman@demo-health.com',     'Megan',     'Coleman',    'E093', 'Business Office (OHC)', 'Concierge',          40, 'Day',     false),
    -- ── Home Healthcare ───────────────────────────────────────────────────
    ('brian.hughes@demo-health.com',      'Brian',     'Hughes',     'E094', 'Holden (HRSNC)', 'Home Healthcare',           40, 'Day',     false),
    ('andrew.simmons@demo-health.com',    'Andrew',    'Simmons',    'E095', 'Holden (HRSNC)', 'Home Healthcare',           40, 'Day',     false),
    ('ryan.foster@demo-health.com',       'Ryan',      'Foster',     'E096', 'Oakdale (ORSNC)', 'Home Healthcare',          40, 'Day',     false),
    ('eric.patterson@demo-health.com',    'Eric',      'Patterson',  'E097', 'Oakdale (ORSNC)', 'Home Healthcare',          40, 'Day',     false),
    ('jonathan.hughes@demo-health.com',   'Jonathan',  'Hughes',     'E098', 'Oakdale (ORSNC)', 'Home Healthcare',          32, 'Day',     false),
    ('scott.griffin@demo-health.com',     'Scott',     'Griffin',    'E099', 'Holden (HRSNC)', 'Home Healthcare',           40, 'Day',     false),
    ('christopher.diaz@demo-health.com',  'Christopher','Diaz',      'E100', 'Business Office (OHC)', 'Home Healthcare',    40, 'Day',     false)
  ) AS v(email, first_name, last_name, ee_number, site, position, hours_per_week, shift, is_approved_submitter)
  WHERE NOT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.org_id = demo_org_id AND e.ee_number = v.ee_number
  );

  RAISE NOTICE 'Done. Rows inserted: %', (SELECT count(*) FROM employees WHERE org_id = demo_org_id);
END $$;
```
