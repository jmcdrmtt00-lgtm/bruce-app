-- ── Step 1: Run this first to get jmcdrmtt00's user UUID ────────────────────
select id, email from auth.users where email = 'jmcdrmtt00@gmail.com';

-- ── Step 2: Set is_admin flag on jmcdrmtt00 ──────────────────────────────────
update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"is_admin": true}'::jsonb
where email = 'jmcdrmtt00@gmail.com';

-- ── Step 3: Replace YOUR_JMCDRMTT00_UUID below with the id from Step 1 ───────
-- Then run Steps 3 and 4 together.

-- Allow DemoITbuddy1 to read jmcdrmtt00's assets
drop policy if exists "Demo user can read admin assets" on assets;
create policy "Demo user can read admin assets"
  on assets for select
  using (
    auth.uid() = user_id
    OR (
      auth.jwt() -> 'user_metadata' ->> 'is_demo' = 'true'
      AND user_id = 'YOUR_JMCDRMTT00_UUID'
    )
  );

-- Allow DemoITbuddy1 to write (update) jmcdrmtt00's assets
drop policy if exists "Demo user can update admin assets" on assets;
create policy "Demo user can update admin assets"
  on assets for update
  using (
    auth.uid() = user_id
    OR (
      auth.jwt() -> 'user_metadata' ->> 'is_demo' = 'true'
      AND user_id = 'YOUR_JMCDRMTT00_UUID'
    )
  );

-- Allow DemoITbuddy1 to read jmcdrmtt00's incidents (shown on Dashboard)
drop policy if exists "Demo user can read admin incidents" on incidents;
create policy "Demo user can read admin incidents"
  on incidents for select
  using (
    auth.uid() = user_id
    OR (
      auth.jwt() -> 'user_metadata' ->> 'is_demo' = 'true'
      AND user_id = 'YOUR_JMCDRMTT00_UUID'
    )
  );

-- Allow DemoITbuddy1 to read incident_updates for jmcdrmtt00's incidents
drop policy if exists "Demo user can read admin incident updates" on incident_updates;
create policy "Demo user can read admin incident updates"
  on incident_updates for select
  using (
    auth.uid() = user_id
    OR (
      auth.jwt() -> 'user_metadata' ->> 'is_demo' = 'true'
      AND incident_id IN (
        SELECT id FROM incidents WHERE user_id = 'YOUR_JMCDRMTT00_UUID'
      )
    )
  );

-- ── tasks table policies (kept for reference) ────────────────────────────────

-- Allow DemoITbuddy1 to read jmcdrmtt00's tasks
drop policy if exists "Demo user can read admin tasks" on tasks;
create policy "Demo user can read admin tasks"
  on tasks for select
  using (
    auth.uid() = user_id
    OR (
      auth.jwt() -> 'user_metadata' ->> 'is_demo' = 'true'
      AND user_id = 'YOUR_JMCDRMTT00_UUID'
    )
  );
