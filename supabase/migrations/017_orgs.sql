-- Multi-tenancy: organisations + membership
-- Run in Supabase SQL Editor after 016_employees.sql

-- ─── 1. Core tables ────────────────────────────────────────────────────────────

create table orgs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  created_at timestamptz default now()
);

create table user_orgs (
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id  uuid not null references orgs(id)       on delete cascade,
  role    text not null default 'member',          -- 'admin' | 'member'
  primary key (user_id, org_id)
);

alter table orgs      enable row level security;
alter table user_orgs enable row level security;

-- Users can see orgs they belong to
create policy "users see their orgs"
  on orgs for select
  using (id in (select org_id from user_orgs where user_id = auth.uid()));

-- Users can see their own memberships
create policy "users see own memberships"
  on user_orgs for select
  using (user_id = auth.uid());

-- ─── 2. Seed orgs ──────────────────────────────────────────────────────────────

insert into orgs (name, slug) values
  ('Oriol Healthcare', 'oriol'),
  ('Demo',             'demo');

-- ─── 3. Add org_id to shared data tables ──────────────────────────────────────

alter table assets    add column org_id uuid references orgs(id);
alter table incidents add column org_id uuid references orgs(id);
alter table employees add column org_id uuid references orgs(id);

-- ─── 4. Migrate all existing data to Oriol ─────────────────────────────────────

update assets    set org_id = (select id from orgs where slug = 'oriol');
update incidents set org_id = (select id from orgs where slug = 'oriol');
update employees set org_id = (select id from orgs where slug = 'oriol');

-- ─── 5. Enforce org_id going forward ──────────────────────────────────────────

alter table assets    alter column org_id set not null;
alter table incidents alter column org_id set not null;
alter table employees alter column org_id set not null;

-- ─── 6. assets: replace user_id policies with org policies ────────────────────

drop policy "Users see own assets"    on assets;
drop policy "Users insert own assets" on assets;
drop policy "Users update own assets" on assets;
drop policy "Users delete own assets" on assets;

create policy "org members see assets"
  on assets for select
  using (org_id in (select org_id from user_orgs where user_id = auth.uid()));

create policy "org members insert assets"
  on assets for insert
  with check (org_id in (select org_id from user_orgs where user_id = auth.uid()));

create policy "org members update assets"
  on assets for update
  using (org_id in (select org_id from user_orgs where user_id = auth.uid()));

create policy "org members delete assets"
  on assets for delete
  using (org_id in (select org_id from user_orgs where user_id = auth.uid()));

-- ─── 7. incidents: replace user_id policies with org policies ─────────────────

drop policy "Users can read own incidents"   on incidents;
drop policy "Users can insert own incidents" on incidents;
drop policy "Users can update own incidents" on incidents;

create policy "org members see incidents"
  on incidents for select
  using (org_id in (select org_id from user_orgs where user_id = auth.uid()));

create policy "org members insert incidents"
  on incidents for insert
  with check (org_id in (select org_id from user_orgs where user_id = auth.uid()));

create policy "org members update incidents"
  on incidents for update
  using (org_id in (select org_id from user_orgs where user_id = auth.uid()));

create policy "org members delete incidents"
  on incidents for delete
  using (org_id in (select org_id from user_orgs where user_id = auth.uid()));

-- ─── 8. incident_updates: replace user_id policies with org-via-parent ─────────

drop policy "Users can read own incident updates"   on incident_updates;
drop policy "Users can insert own incident updates" on incident_updates;

create policy "org members see incident updates"
  on incident_updates for select
  using (incident_id in (
    select id from incidents
    where org_id in (select org_id from user_orgs where user_id = auth.uid())
  ));

create policy "org members insert incident updates"
  on incident_updates for insert
  with check (incident_id in (
    select id from incidents
    where org_id in (select org_id from user_orgs where user_id = auth.uid())
  ));

-- ─── 9. employees: replace open-to-all policies with org policies ──────────────

drop policy "authenticated users can read employees"   on employees;
drop policy "authenticated users can insert employees" on employees;
drop policy "authenticated users can update employees" on employees;
drop policy "authenticated users can delete employees" on employees;

create policy "org members see employees"
  on employees for select
  using (org_id in (select org_id from user_orgs where user_id = auth.uid()));

create policy "org members insert employees"
  on employees for insert
  with check (org_id in (select org_id from user_orgs where user_id = auth.uid()));

create policy "org members update employees"
  on employees for update
  using (org_id in (select org_id from user_orgs where user_id = auth.uid()));

create policy "org members delete employees"
  on employees for delete
  using (org_id in (select org_id from user_orgs where user_id = auth.uid()));

-- ─── 10. Seed memberships ──────────────────────────────────────────────────────
-- Add jmcdrmtt00@gmail.com as admin of both orgs

insert into user_orgs (user_id, org_id, role)
select u.id, o.id, 'admin'
from auth.users u
cross join orgs o
where u.email = 'jmcdrmtt00@gmail.com'
  and o.slug in ('oriol', 'demo');

-- To add Judy, run:
--   insert into user_orgs (user_id, org_id, role)
--   select u.id, o.id, 'admin'
--   from auth.users u cross join orgs o
--   where u.email = 'JUDY_EMAIL_HERE'
--     and o.slug in ('oriol', 'demo');
--
-- To add Bruce (read-only Oriol):
--   insert into user_orgs (user_id, org_id, role)
--   select u.id, o.id, 'member'
--   from auth.users u cross join orgs o
--   where u.email = 'BRUCE_EMAIL_HERE'
--     and o.slug = 'oriol';
