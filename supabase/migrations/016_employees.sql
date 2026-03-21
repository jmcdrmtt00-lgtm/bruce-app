-- Replace nurse_profiles with a full employees table.
-- nurse_profiles (014/015) had no production data, so we simply drop it.
drop table if exists nurse_profiles;

create table if not exists employees (
  id                   uuid primary key default gen_random_uuid(),
  email                text unique not null,
  first_name           text not null,
  last_name            text not null,
  ee_number            text,
  site                 text not null,
  position             text,
  hours_per_week       numeric,
  shift                text,
  is_approved_submitter boolean not null default false,
  created_at           timestamptz default now()
);

alter table employees enable row level security;

-- Any authenticated user can read (Submit Ticket lookup needs this)
create policy "authenticated users can read employees"
  on employees for select
  to authenticated
  using (true);

create policy "authenticated users can insert employees"
  on employees for insert
  to authenticated
  with check (true);

create policy "authenticated users can update employees"
  on employees for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can delete employees"
  on employees for delete
  to authenticated
  using (true);
